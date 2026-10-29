-- Livraison par zones : un quartier appartient à une zone, la zone porte le tarif.
-- Les frais restent réglés directement au livreur : ils ne sont jamais ajoutés au total ni au paiement en ligne.
--   * quartiers comparés sans accents ni majuscules ; un quartier actif n'appartient qu'à une seule zone ;
--   * à la création d'une commande en livraison, la zone, son nom et son tarif sont copiés dans la commande
--     (instantané) : modifier ou désactiver une zone ne change jamais une ancienne commande ;
--   * sans zone correspondante, le tarif reste « à confirmer selon la position » (comportement actuel).
-- Migration additive : voir supabase/rollbacks/20261029000001_delivery_zones_pricing.down.sql.

-- Nom de lieu normalisé : minuscules, sans accents, ponctuation et espaces réduits.
create or replace function public.normalize_place(p text)
returns text language sql immutable set search_path = '' as $$
  select btrim(regexp_replace(
    translate(lower(coalesce(p, '')), 'àâäáãåéèêëíìîïóòôöõúùûüýÿçñ', 'aaaaaaeeeeiiiiooooouuuuyycn'),
    '[^a-z0-9]+', ' ', 'g'))
$$;

alter table public.delivery_zones
  add column note text check (note is null or char_length(note) <= 200),
  add column updated_at timestamptz not null default now(),
  add constraint delivery_zones_name_len check (char_length(btrim(name)) between 1 and 80),
  add constraint delivery_zones_districts_len check (cardinality(districts) <= 300);

create trigger delivery_zones_touch before update on public.delivery_zones
  for each row execute function public.touch_updated_at();

-- Quartiers nettoyés (vides et doublons retirés) ; jamais deux zones actives pour le même quartier.
create or replace function public.delivery_zones_check_districts()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_clash text;
begin
  select coalesce(array_agg(s.display order by s.ord), '{}') into new.districts
    from (
      select distinct on (public.normalize_place(x)) btrim(x) as display, o as ord
        from unnest(new.districts) with ordinality as t(x, o)
       where public.normalize_place(x) <> ''
       order by public.normalize_place(x), o
    ) s;
  if new.is_active then
    select z.name into v_clash
      from public.delivery_zones z
     where z.id <> new.id and z.is_active
       and exists (
         select 1 from unnest(z.districts) d
          where public.normalize_place(d) in (select public.normalize_place(x) from unnest(new.districts) x))
     limit 1;
    if found then
      raise exception 'ZONE_DISTRICT_CLASH' using errcode = '23505', detail = v_clash;
    end if;
  end if;
  return new;
end $$;

create trigger delivery_zones_districts before insert or update on public.delivery_zones
  for each row execute function public.delivery_zones_check_districts();

-- Instantané du tarif dans la commande.
alter table public.orders
  add column delivery_zone_name text check (delivery_zone_name is null or char_length(delivery_zone_name) <= 80);

comment on column public.orders.delivery_zone_name is
  'Nom de la zone de livraison au moment de la commande (instantané). zone_id et delivery_fee_fcfa complètent l''instantané.';
comment on column public.orders.delivery_fee_fcfa is
  'Frais de livraison au moment de la commande, réglés au livreur (jamais inclus dans total_fcfa). null = tarif confirmé selon la position ; 0 = retrait.';

-- La zone se déduit du quartier, côté base : le navigateur ne peut jamais imposer un tarif.
create or replace function public.orders_apply_delivery_zone()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_zone public.delivery_zones;
begin
  new.zone_id := null;
  new.delivery_zone_name := null;
  if new.fulfillment = 'delivery' then
    new.delivery_fee_fcfa := null;
    if public.normalize_place(new.district) <> '' then
      select z.* into v_zone
        from public.delivery_zones z
       where z.is_active
         and exists (select 1 from unnest(z.districts) d where public.normalize_place(d) = public.normalize_place(new.district))
       order by z.sort_order, z.created_at
       limit 1;
      if found then
        new.zone_id := v_zone.id;
        new.delivery_zone_name := v_zone.name;
        new.delivery_fee_fcfa := v_zone.fee_fcfa;
      end if;
    end if;
  end if;
  return new;
end $$;

create trigger orders_apply_delivery_zone before insert on public.orders
  for each row execute function public.orders_apply_delivery_zone();

-- Une commande garde son tarif : zone, nom de zone et frais ne peuvent plus changer après la création.
create or replace function public.orders_freeze_delivery_pricing()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.zone_id is distinct from old.zone_id
     or new.delivery_zone_name is distinct from old.delivery_zone_name
     or new.delivery_fee_fcfa is distinct from old.delivery_fee_fcfa then
    raise exception 'DELIVERY_PRICING_FROZEN' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger orders_freeze_delivery_pricing before update on public.orders
  for each row execute function public.orders_freeze_delivery_pricing();

revoke all on function public.orders_apply_delivery_zone() from public, anon, authenticated;
revoke all on function public.orders_freeze_delivery_pricing() from public, anon, authenticated;
revoke all on function public.delivery_zones_check_districts() from public, anon, authenticated;

-- Import d'une grille complète (CSV analysé côté serveur) : tout ou rien, dans une seule transaction.
-- Les quartiers des zones importées sont d'abord libérés : un quartier peut changer de zone dans le même fichier.
-- Les zones absentes du fichier ne sont ni modifiées ni supprimées.
create or replace function public.admin_import_delivery_zones(p_zones jsonb, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  z jsonb;
  v_id uuid;
  v_created int := 0;
  v_updated int := 0;
begin
  if jsonb_typeof(p_zones) <> 'array' or jsonb_array_length(p_zones) = 0 or jsonb_array_length(p_zones) > 200 then
    raise exception 'ZONES_INVALID' using errcode = 'P0001';
  end if;
  update public.delivery_zones set districts = '{}'
   where lower(btrim(name)) in (select lower(btrim(x ->> 'name')) from jsonb_array_elements(p_zones) x);
  for z in select * from jsonb_array_elements(p_zones) loop
    select id into v_id from public.delivery_zones where lower(btrim(name)) = lower(btrim(z ->> 'name'));
    if found then
      update public.delivery_zones set
        districts = array(select jsonb_array_elements_text(z -> 'districts')),
        fee_fcfa = nullif(z ->> 'fee_fcfa', '')::int,
        sort_order = coalesce(nullif(z ->> 'sort_order', '')::int, sort_order),
        is_active = coalesce((z ->> 'is_active')::boolean, true),
        note = nullif(btrim(z ->> 'note'), '')
       where id = v_id;
      v_updated := v_updated + 1;
    else
      insert into public.delivery_zones (name, districts, fee_fcfa, sort_order, is_active, note)
      values (btrim(z ->> 'name'), array(select jsonb_array_elements_text(z -> 'districts')),
              nullif(z ->> 'fee_fcfa', '')::int, coalesce(nullif(z ->> 'sort_order', '')::int, 0),
              coalesce((z ->> 'is_active')::boolean, true), nullif(btrim(z ->> 'note'), ''));
      v_created := v_created + 1;
    end if;
  end loop;
  perform public.write_audit(p_actor, 'zones.import', 'delivery_zones', null, jsonb_build_object('created', v_created, 'updated', v_updated));
  return jsonb_build_object('created', v_created, 'updated', v_updated);
end $$;

revoke all on function public.admin_import_delivery_zones(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.admin_import_delivery_zones(jsonb, uuid) to service_role;
