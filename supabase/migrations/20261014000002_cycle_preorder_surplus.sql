-- OHMEGATO — logique officielle des fournées : précommande puis surplus.
--
-- 1. Précommandes avant la date limite (statut « open »). La demande enregistrée guide la
--    production ; les commandes payées et confirmées sont prioritaires.
-- 2. Après la date limite, plus aucune précommande (vérifié côté serveur à chaque commande).
-- 3. Alima saisit la production réelle et les pertes, puis publie elle-même le surplus :
--    rien n'est jamais publié automatiquement.
-- 4. Les commandes de surplus (order_kind = 'surplus') ne peuvent consommer que le surplus
--    publié : le stock réservé aux précommandes n'est jamais proposé aux retardataires.
-- 5. Une précommande annulée pendant la vente du surplus rend ses unités au stock interne,
--    jamais au surplus public : Alima décide de les republier.
-- Aucune donnée existante n'est supprimée ; les nouvelles colonnes ont des valeurs par défaut.

-- ---------------------------------------------------------------------------
-- Colonnes
-- ---------------------------------------------------------------------------
alter table public.production_cycles
  add column production_days int check (production_days between 1 and 7),
  add column production_dates date[] not null default '{}',
  add column timezone text not null default 'Africa/Dakar' check (timezone = 'Africa/Dakar'),
  add column surplus_ends_at timestamptz,
  add column surplus_delivery_allowed boolean not null default false,
  add column closed_at timestamptz,
  add column production_started_at timestamptz,
  add column fulfillment_started_at timestamptz,
  add column surplus_opened_at timestamptz,
  add column completed_at timestamptz;

alter table public.orders
  add column order_kind text not null default 'preorder' check (order_kind in ('preorder', 'surplus'));
create index orders_cycle_kind_idx on public.orders (cycle_id, order_kind);

alter table public.delivery_slots
  add column phase text not null default 'preorder' check (phase in ('preorder', 'surplus'));

alter table public.inventory_units
  add column extra_units int not null default 0 check (extra_units >= 0),
  add column produced_units int check (produced_units >= 0),
  add column lost_units int not null default 0 check (lost_units >= 0),
  add column surplus_published_units int not null default 0 check (surplus_published_units >= 0),
  add column production_note text check (char_length(production_note) <= 500),
  add column production_recorded_at timestamptz,
  add column production_recorded_by uuid references auth.users (id) on delete set null,
  add constraint inventory_units_lost_within_produced check (produced_units is null or lost_units <= produced_units);

-- Les données de production (quantités produites, pertes, note interne) ne sont jamais lisibles
-- par les clients : seules les colonnes utiles à la disponibilité restent publiques.
revoke select on public.inventory_units from anon, authenticated;
grant select (cycle_id, product_id, total_units, reserved_units, sold_units, updated_at)
  on public.inventory_units to anon, authenticated;

create or replace function public.place_order(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_idem uuid := (p ->> 'idempotency_key')::uuid;
  v_existing public.orders;
  v_cycle public.production_cycles;
  v_slot public.delivery_slots;
  v_fulfillment public.fulfillment_method := (p ->> 'fulfillment')::public.fulfillment_method;
  v_item jsonb;
  v_variant record;
  v_flavor_id uuid;
  v_flavor_name text;
  v_cp public.cycle_products;
  v_qty int;
  v_subtotal int := 0;
  v_fee int;
  v_status public.order_status;
  v_order_id uuid := gen_random_uuid();
  v_reference text;
  v_expires timestamptz := now() + make_interval(mins => coalesce((p ->> 'reservation_minutes')::int, 30));
  v_needed record;
  v_inv public.inventory_units;
  v_slot_orders int;
  v_cycle_used int;
  v_cycle_new int := 0;
  v_lines jsonb := '[]';
  v_kind text;
begin
  -- Idempotence : un double envoi renvoie la même commande.
  select * into v_existing from public.orders where idempotency_key = v_idem;
  if found then
    return jsonb_build_object(
      'order_id', v_existing.id, 'reference', v_existing.reference,
      'status', v_existing.status, 'total_fcfa', v_existing.total_fcfa, 'replayed', true
    );
  end if;

  perform public.expire_stale_orders();

  if jsonb_typeof(p -> 'items') <> 'array' or jsonb_array_length(p -> 'items') = 0 then
    perform public.raise_order_error('EMPTY_CART');
  end if;
  if jsonb_array_length(p -> 'items') > 30 then
    perform public.raise_order_error('TOO_MANY_LINES');
  end if;

  -- Précommande (fournée ouverte, avant la date limite) ou commande de surplus (surplus publié
  -- par Alima). Verrou partagé : un changement de phase attend la fin de la transaction.
  select * into v_cycle from public.production_cycles where id = (p ->> 'cycle_id')::uuid for share;
  if not found then
    perform public.raise_order_error('CYCLE_NOT_OPEN');
  end if;
  if v_cycle.status = 'open' then
    if now() < v_cycle.opens_at then
      perform public.raise_order_error('CYCLE_NOT_OPEN');
    end if;
    if now() >= v_cycle.closes_at then
      perform public.raise_order_error('PREORDER_CLOSED');
    end if;
    v_kind := 'preorder';
  elsif v_cycle.status = 'surplus' then
    if v_cycle.surplus_ends_at is not null and now() >= v_cycle.surplus_ends_at then
      perform public.raise_order_error('SURPLUS_CLOSED');
    end if;
    v_kind := 'surplus';
  elsif v_cycle.status in ('closed', 'preparing', 'delivering') then
    perform public.raise_order_error('PREORDER_CLOSED');
  else
    perform public.raise_order_error('CYCLE_NOT_OPEN');
  end if;

  -- Créneau
  select * into v_slot from public.delivery_slots where id = (p ->> 'slot_id')::uuid for update;
  if not found or v_slot.cycle_id <> v_cycle.id or not v_slot.is_active
     or (v_slot.kind <> 'both' and v_slot.kind::text <> v_fulfillment::text)
     or v_slot.phase <> v_kind
     or (v_kind = 'surplus' and v_slot.ends_at <= now()) then
    perform public.raise_order_error('SLOT_INVALID');
  end if;
  -- Surplus : livraison seulement si Alima l'a ouverte pour les commandes tardives.
  if v_kind = 'surplus' and v_fulfillment = 'delivery' and not v_cycle.surplus_delivery_allowed then
    perform public.raise_order_error('DELIVERY_UNAVAILABLE');
  end if;
  if v_slot.capacity_orders is not null then
    select count(*) into v_slot_orders from public.orders
      where slot_id = v_slot.id
        and status not in ('cancelled', 'expired', 'refunded');
    if v_slot_orders >= v_slot.capacity_orders then
      perform public.raise_order_error('SLOT_FULL');
    end if;
  end if;

  -- Livraison
  if v_fulfillment = 'delivery' then
    if coalesce(trim(p #>> '{delivery,address_line}'), '') = ''
       or coalesce(trim(p #>> '{delivery,recipient_phone}'), '') = '' then
      perform public.raise_order_error('ADDRESS_REQUIRED');
    end if;
    -- Position exacte obligatoire : elle est transmise à OHMEGATO pour organiser la livraison.
    if p #>> '{delivery,latitude}' is null or p #>> '{delivery,longitude}' is null then
      perform public.raise_order_error('POSITION_REQUIRED');
    end if;
    -- Frais de livraison réglés directement au livreur : jamais inclus dans le paiement.
    v_fee := null;
  else
    v_fee := 0; -- retrait gratuit
  end if;

  v_status := 'pending_payment';

  -- Lignes : prix et unités relus en base
  create temporary table if not exists _lines (
    product_id uuid, variant_id uuid, flavor_id uuid, product_name text, variant_label text,
    flavor_name text, units_per_item int, quantity int, unit_price int
  );
  truncate pg_temp._lines;

  for v_item in select * from jsonb_array_elements(p -> 'items') loop
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty < 1 or v_qty > 50 then
      perform public.raise_order_error('QUANTITY_INVALID');
    end if;

    select v.id, v.label, v.units_consumed, v.price_fcfa, v.is_active,
           pr.id as product_id, pr.name as product_name, pr.slug, pr.is_active as product_active
      into v_variant
      from public.product_variants v join public.products pr on pr.id = v.product_id
      where v.id = (v_item ->> 'variant_id')::uuid;
    if not found or not v_variant.is_active or not v_variant.product_active then
      perform public.raise_order_error('ITEM_UNAVAILABLE', jsonb_build_object('variant_id', v_item ->> 'variant_id'));
    end if;

    select * into v_cp from public.cycle_products
      where cycle_id = v_cycle.id and product_id = v_variant.product_id;
    if not found or v_variant.id = any (v_cp.disabled_variant_ids) then
      perform public.raise_order_error('NOT_IN_CYCLE', jsonb_build_object('product', v_variant.slug));
    end if;

    -- Parfum : obligatoire si le produit en propose, interdit sinon.
    v_flavor_id := null;
    v_flavor_name := null;
    if exists (select 1 from public.product_flavors where product_id = v_variant.product_id) then
      if v_item ->> 'flavor_id' is null then
        perform public.raise_order_error('FLAVOR_REQUIRED', jsonb_build_object('product', v_variant.slug));
      end if;
      select f.id, f.name into v_flavor_id, v_flavor_name
        from public.product_flavors pf join public.flavors f on f.id = pf.flavor_id
        where pf.product_id = v_variant.product_id and f.id = (v_item ->> 'flavor_id')::uuid
          and (v_cp.available_flavor_ids is null or f.id = any (v_cp.available_flavor_ids));
      if not found then
        perform public.raise_order_error('FLAVOR_UNAVAILABLE', jsonb_build_object('product', v_variant.slug));
      end if;
    elsif v_item ->> 'flavor_id' is not null then
      perform public.raise_order_error('FLAVOR_UNAVAILABLE', jsonb_build_object('product', v_variant.slug));
    end if;

    insert into _lines values (
      v_variant.product_id, v_variant.id, v_flavor_id, v_variant.product_name, v_variant.label,
      v_flavor_name, v_variant.units_consumed, v_qty, v_variant.price_fcfa
    );
    v_subtotal := v_subtotal + v_variant.price_fcfa * v_qty;
  end loop;

  -- Vérification du stock, produits verrouillés dans un ordre stable (pas d'interblocage).
  if v_status = 'pending_payment' then
    for v_needed in
      select product_id, sum(units_per_item * quantity)::int as units, min(product_name) as product_name
      from _lines group by product_id order by product_id
    loop
      select * into v_inv from public.inventory_units
        where cycle_id = v_cycle.id and product_id = v_needed.product_id for update;
      if not found or v_inv.total_units - v_inv.reserved_units - v_inv.sold_units < v_needed.units then
        perform public.raise_order_error('INSUFFICIENT_STOCK', jsonb_build_object(
          'product_id', v_needed.product_id,
          'product_name', v_needed.product_name,
          'available', greatest(coalesce(v_inv.total_units - v_inv.reserved_units - v_inv.sold_units, 0), 0)
        ));
      end if;
      v_cycle_new := v_cycle_new + v_needed.units;
    end loop;

    if v_kind = 'preorder' and v_cycle.capacity_units is not null then
      select coalesce(sum(reserved_units + sold_units), 0) into v_cycle_used
        from public.inventory_units where cycle_id = v_cycle.id;
      if v_cycle_used + v_cycle_new > v_cycle.capacity_units then
        perform public.raise_order_error('CYCLE_FULL');
      end if;
    end if;
  end if;

  loop
    v_reference := 'OHM' || v_cycle.number || '-' || public.random_code(5);
    exit when not exists (select 1 from public.orders where reference = v_reference);
  end loop;

  insert into public.orders (
    id, reference, tracking_token_hash, idempotency_key, user_id, cycle_id, status,
    fulfillment, slot_id, customer_name, customer_phone, customer_email,
    zone_id, address_line, district, landmark, floor_door, recipient_name, recipient_phone,
    delivery_instructions, latitude, longitude, pickup_code, notes,
    subtotal_fcfa, delivery_fee_fcfa, total_fcfa, reservation_expires_at, order_kind
  ) values (
    v_order_id, v_reference, p ->> 'tracking_token_hash', v_idem, (p ->> 'user_id')::uuid, v_cycle.id, v_status,
    v_fulfillment, v_slot.id, p #>> '{customer,name}', p #>> '{customer,phone}', nullif(p #>> '{customer,email}', ''),
    null, -- zone : plus utilisée pour la tarification
    case when v_fulfillment = 'delivery' then p #>> '{delivery,address_line}' end,
    case when v_fulfillment = 'delivery' then p #>> '{delivery,district}' end,
    case when v_fulfillment = 'delivery' then nullif(p #>> '{delivery,landmark}', '') end,
    case when v_fulfillment = 'delivery' then nullif(p #>> '{delivery,floor_door}', '') end,
    case when v_fulfillment = 'delivery' then p #>> '{delivery,recipient_name}' end,
    case when v_fulfillment = 'delivery' then p #>> '{delivery,recipient_phone}' end,
    case when v_fulfillment = 'delivery' then nullif(p #>> '{delivery,instructions}', '') end,
    case when v_fulfillment = 'delivery' then (p #>> '{delivery,latitude}')::numeric end,
    case when v_fulfillment = 'delivery' then (p #>> '{delivery,longitude}')::numeric end,
    case when v_fulfillment = 'pickup' then public.random_code(6) end,
    nullif(p ->> 'notes', ''),
    v_subtotal, v_fee, v_subtotal,
    case when v_status = 'pending_payment' then v_expires end,
    v_kind
  );

  insert into public.order_items (
    order_id, product_id, variant_id, flavor_id, product_name, variant_label, flavor_name,
    units_per_item, quantity, unit_price_fcfa, line_total_fcfa
  )
  select v_order_id, product_id, variant_id, flavor_id, product_name, variant_label, flavor_name,
         units_per_item, quantity, unit_price, unit_price * quantity
  from _lines;

  if v_status = 'pending_payment' then
    for v_needed in
      select product_id, sum(units_per_item * quantity)::int as units
      from _lines group by product_id order by product_id
    loop
      update public.inventory_units
        set reserved_units = reserved_units + v_needed.units
        where cycle_id = v_cycle.id and product_id = v_needed.product_id;
      insert into public.stock_reservations (order_id, cycle_id, product_id, units, expires_at)
        values (v_order_id, v_cycle.id, v_needed.product_id, v_needed.units, v_expires);
      insert into public.inventory_movements (cycle_id, product_id, kind, units, order_id, reason)
        values (v_cycle.id, v_needed.product_id, 'reserve', v_needed.units, v_order_id,
                case when v_kind = 'surplus' then 'commande de surplus provisoire' else 'précommande provisoire' end);
    end loop;
  end if;

  insert into public.order_status_history (order_id, status) values (v_order_id, v_status);

  return jsonb_build_object(
    'order_id', v_order_id, 'reference', v_reference, 'status', v_status,
    'total_fcfa', v_subtotal, 'replayed', false, 'order_kind', v_kind
  );
end $$;


revoke all on function public.place_order(jsonb) from public, anon, authenticated;
grant execute on function public.place_order(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Cycle de vie de la fournée
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_cycle_status(
  p_cycle_id uuid, p_status public.cycle_status, p_actor uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_cycle public.production_cycles;
  v_allowed public.cycle_status[];
  o record;
  v_inv record;
begin
  select * into v_cycle from public.production_cycles where id = p_cycle_id for update;
  if not found then perform public.raise_order_error('CYCLE_NOT_FOUND'); end if;

  -- « surplus » ne s'atteint que par la publication explicite du surplus (admin_publish_surplus).
  v_allowed := case v_cycle.status
    when 'draft' then array['scheduled', 'open', 'cancelled']::public.cycle_status[]
    when 'scheduled' then array['draft', 'open', 'cancelled']::public.cycle_status[]
    when 'open' then array['closed', 'cancelled']::public.cycle_status[]
    when 'closed' then array['open', 'preparing', 'cancelled']::public.cycle_status[]
    when 'preparing' then array['delivering', 'done']::public.cycle_status[]
    when 'delivering' then array['done']::public.cycle_status[]
    when 'surplus' then array['done']::public.cycle_status[]
    else array[]::public.cycle_status[]
  end;
  if not (p_status = any (v_allowed)) then
    perform public.raise_order_error('TRANSITION_INVALID', jsonb_build_object('from', v_cycle.status, 'to', p_status));
  end if;

  if p_status = 'open' then
    if exists (select 1 from public.production_cycles where status in ('open', 'surplus') and id <> p_cycle_id) then
      perform public.raise_order_error('ANOTHER_CYCLE_OPEN');
    end if;
    if not exists (select 1 from public.cycle_products where cycle_id = p_cycle_id) then
      perform public.raise_order_error('CYCLE_EMPTY');
    end if;
    if v_cycle.closes_at <= now() then
      perform public.raise_order_error('CYCLE_DATES_PAST');
    end if;
    -- Chaque produit proposé doit avoir une capacité de précommande saisie par Alima.
    if exists (
      select 1 from public.cycle_products cp
      left join public.inventory_units i on i.cycle_id = cp.cycle_id and i.product_id = cp.product_id
      where cp.cycle_id = p_cycle_id and coalesce(i.total_units, 0) = 0
    ) then
      perform public.raise_order_error('CYCLE_STOCK_MISSING');
    end if;
    if not exists (
      select 1 from public.delivery_slots
      where cycle_id = p_cycle_id and phase = 'preorder' and is_active
    ) then
      perform public.raise_order_error('CYCLE_SLOTS_MISSING');
    end if;
  end if;

  if p_status = 'cancelled' then
    -- Rien ne reste bloqué : provisoires libérées, payées signalées pour remboursement.
    for o in select id, payment_status from public.orders where cycle_id = p_cycle_id
      and status not in ('cancelled', 'expired', 'refunded', 'delivered', 'picked_up') for update
    loop
      if o.payment_status = 'paid' then
        update public.orders set status = 'needs_attention' where id = o.id;
        insert into public.order_status_history (order_id, status, note, actor_id)
          values (o.id, 'needs_attention', 'Fournée annulée : remboursement à organiser', p_actor);
      else
        perform public.release_order_reservations(o.id, 'fournée annulée');
        update public.orders set status = 'cancelled', payment_status = 'cancelled' where id = o.id;
        update public.payments set status = 'cancelled' where order_id = o.id and status = 'pending';
        insert into public.order_status_history (order_id, status, note, actor_id)
          values (o.id, 'cancelled', 'Fournée annulée', p_actor);
      end if;
    end loop;
  end if;

  -- Fin de la fournée : plus rien n'est disponible à la vente.
  if p_status = 'done' then
    for v_inv in
      select product_id, total_units - reserved_units - sold_units as free_units
      from public.inventory_units where cycle_id = p_cycle_id order by product_id for update
    loop
      if v_inv.free_units > 0 and v_cycle.status = 'surplus' then
        update public.inventory_units set total_units = reserved_units + sold_units
          where cycle_id = p_cycle_id and product_id = v_inv.product_id;
        insert into public.inventory_movements (cycle_id, product_id, kind, units, reason, actor_id)
          values (p_cycle_id, v_inv.product_id, 'surplus_withdraw', -v_inv.free_units, 'fournée terminée', p_actor);
      end if;
    end loop;
  end if;

  update public.production_cycles set
    status = p_status,
    opens_at = case when p_status = 'open' then least(opens_at, now()) else opens_at end,
    closed_at = case when p_status = 'closed' then now() else closed_at end,
    production_started_at = case when p_status = 'preparing' then now() else production_started_at end,
    fulfillment_started_at = case when p_status = 'delivering' then now() else fulfillment_started_at end,
    completed_at = case when p_status in ('done', 'cancelled') then now() else completed_at end
  where id = p_cycle_id;
  perform public.write_audit(p_actor, 'cycle.status', 'production_cycles', p_cycle_id::text,
    jsonb_build_object('from', v_cycle.status, 'to', p_status));
end $$;

-- ---------------------------------------------------------------------------
-- Précommande annulée pendant la vente du surplus : unités gardées en stock interne
-- ---------------------------------------------------------------------------
create or replace function public.withhold_released_preorder_units()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_status public.cycle_status;
  v_kind text;
begin
  if new.order_id is null or new.kind not in ('release', 'cancel_sale') or new.units <= 0 then
    return new;
  end if;
  select status into v_status from public.production_cycles where id = new.cycle_id;
  if v_status is distinct from 'surplus' then return new; end if;
  select order_kind into v_kind from public.orders where id = new.order_id;
  if v_kind is distinct from 'preorder' then return new; end if;
  -- Les unités libérées ne deviennent pas disponibles : Alima décide de les republier.
  update public.inventory_units set total_units = total_units - new.units
    where cycle_id = new.cycle_id and product_id = new.product_id;
  insert into public.inventory_movements (cycle_id, product_id, kind, units, order_id, reason)
    values (new.cycle_id, new.product_id, 'withhold', -new.units, new.order_id,
            'précommande annulée : gardé en stock interne, à republier par Alima');
  return new;
end $$;
create trigger inventory_movements_withhold after insert on public.inventory_movements
  for each row execute function public.withhold_released_preorder_units();

-- ---------------------------------------------------------------------------
-- Quantité supplémentaire décidée par Alima (prévision de production)
-- ---------------------------------------------------------------------------
create or replace function public.admin_plan_extra(
  p_cycle_id uuid, p_product_id uuid, p_extra int, p_actor uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare v_old int;
begin
  if p_extra is null or p_extra < 0 then perform public.raise_order_error('STOCK_INVALID'); end if;
  if not exists (select 1 from public.cycle_products where cycle_id = p_cycle_id and product_id = p_product_id) then
    perform public.raise_order_error('NOT_IN_CYCLE');
  end if;
  insert into public.inventory_units (cycle_id, product_id, total_units)
    values (p_cycle_id, p_product_id, 0) on conflict do nothing;
  select extra_units into v_old from public.inventory_units
    where cycle_id = p_cycle_id and product_id = p_product_id for update;
  if v_old = p_extra then return; end if;
  update public.inventory_units set extra_units = p_extra where cycle_id = p_cycle_id and product_id = p_product_id;
  perform public.write_audit(p_actor, 'cycle.extra', 'inventory_units', p_cycle_id || ':' || p_product_id,
    jsonb_build_object('from', v_old, 'to', p_extra));
end $$;

-- ---------------------------------------------------------------------------
-- Production réelle et pertes (après la clôture des précommandes)
-- ---------------------------------------------------------------------------
create or replace function public.admin_record_production(
  p_cycle_id uuid, p_product_id uuid, p_produced int, p_lost int, p_note text, p_actor uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_cycle public.production_cycles;
  v_inv public.inventory_units;
begin
  select * into v_cycle from public.production_cycles where id = p_cycle_id;
  if not found then perform public.raise_order_error('CYCLE_NOT_FOUND'); end if;
  if v_cycle.status not in ('closed', 'preparing', 'delivering', 'surplus') then
    perform public.raise_order_error('PRODUCTION_NOT_ALLOWED', jsonb_build_object('status', v_cycle.status));
  end if;
  if p_produced is null or p_produced < 0 or coalesce(p_lost, 0) < 0 or coalesce(p_lost, 0) > p_produced then
    perform public.raise_order_error('PRODUCTION_INVALID');
  end if;
  if not exists (select 1 from public.cycle_products where cycle_id = p_cycle_id and product_id = p_product_id) then
    perform public.raise_order_error('NOT_IN_CYCLE');
  end if;
  insert into public.inventory_units (cycle_id, product_id, total_units)
    values (p_cycle_id, p_product_id, 0) on conflict do nothing;
  select * into v_inv from public.inventory_units
    where cycle_id = p_cycle_id and product_id = p_product_id for update;
  -- Pendant la vente du surplus, la production commercialisable doit couvrir ce qui est déjà
  -- vendu, réservé et publié.
  if v_cycle.status = 'surplus' and p_produced - coalesce(p_lost, 0) < v_inv.total_units then
    perform public.raise_order_error('PRODUCTION_BELOW_COMMITTED', jsonb_build_object('committed', v_inv.total_units));
  end if;
  update public.inventory_units set
    produced_units = p_produced,
    lost_units = coalesce(p_lost, 0),
    production_note = nullif(trim(coalesce(p_note, '')), ''),
    production_recorded_at = now(),
    production_recorded_by = p_actor
  where cycle_id = p_cycle_id and product_id = p_product_id;
  perform public.write_audit(p_actor, 'cycle.production', 'inventory_units', p_cycle_id || ':' || p_product_id,
    jsonb_build_object('produced', p_produced, 'lost', coalesce(p_lost, 0),
                       'previous_produced', v_inv.produced_units, 'previous_lost', v_inv.lost_units));
end $$;

-- ---------------------------------------------------------------------------
-- Publication du surplus : uniquement par Alima, jamais automatique
-- ---------------------------------------------------------------------------
-- p_items : [{ "product_id": uuid, "units": int }] — unités à ajouter au surplus publié.
create or replace function public.admin_publish_surplus(
  p_cycle_id uuid, p_items jsonb, p_ends_at timestamptz, p_delivery_allowed boolean, p_actor uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_cycle public.production_cycles;
  v_item record;
  v_inv public.inventory_units;
  v_committed int;
  v_base int;
  v_max int;
  v_total_units int := 0;
begin
  select * into v_cycle from public.production_cycles where id = p_cycle_id for update;
  if not found then perform public.raise_order_error('CYCLE_NOT_FOUND'); end if;
  if v_cycle.status not in ('preparing', 'delivering', 'surplus') then
    perform public.raise_order_error('TRANSITION_INVALID', jsonb_build_object('from', v_cycle.status, 'to', 'surplus'));
  end if;
  if p_ends_at is null or p_ends_at <= now() then
    perform public.raise_order_error('SURPLUS_END_INVALID');
  end if;
  if exists (select 1 from public.production_cycles where status in ('open', 'surplus') and id <> p_cycle_id) then
    perform public.raise_order_error('ANOTHER_CYCLE_OPEN');
  end if;
  if not exists (
    select 1 from public.delivery_slots
    where cycle_id = p_cycle_id and phase = 'surplus' and is_active and ends_at > now()
      and (kind <> 'delivery' or coalesce(p_delivery_allowed, false))
  ) then
    perform public.raise_order_error('SURPLUS_SLOTS_MISSING');
  end if;
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    perform public.raise_order_error('SURPLUS_INVALID');
  end if;

  -- Première ouverture : aucune capacité de précommande restante ne devient disponible.
  if v_cycle.status <> 'surplus' then
    update public.inventory_units set total_units = reserved_units + sold_units
      where cycle_id = p_cycle_id and total_units > reserved_units + sold_units;
  end if;

  for v_item in
    select (e ->> 'product_id')::uuid as product_id, (e ->> 'units')::int as units
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e
    order by 1
  loop
    if v_item.units is null or v_item.units < 0 then
      perform public.raise_order_error('SURPLUS_INVALID');
    end if;
    if v_item.units = 0 then continue; end if;
    select * into v_inv from public.inventory_units
      where cycle_id = p_cycle_id and product_id = v_item.product_id for update;
    if not found then perform public.raise_order_error('NOT_IN_CYCLE'); end if;
    if v_inv.produced_units is null then
      perform public.raise_order_error('PRODUCTION_MISSING', jsonb_build_object('product_id', v_item.product_id));
    end if;
    v_committed := v_inv.reserved_units + v_inv.sold_units;
    v_base := v_inv.total_units - v_committed; -- surplus déjà publié et encore disponible
    v_max := (v_inv.produced_units - v_inv.lost_units) - v_committed - v_base;
    if v_item.units > v_max then
      perform public.raise_order_error('SURPLUS_EXCEEDS', jsonb_build_object(
        'product_id', v_item.product_id, 'max', greatest(v_max, 0)));
    end if;
    update public.inventory_units set
      total_units = total_units + v_item.units,
      surplus_published_units = surplus_published_units + v_item.units
    where cycle_id = p_cycle_id and product_id = v_item.product_id;
    insert into public.inventory_movements (cycle_id, product_id, kind, units, reason, actor_id)
      values (p_cycle_id, v_item.product_id, 'surplus_publish', v_item.units, 'surplus publié par Alima', p_actor);
    v_total_units := v_total_units + v_item.units;
  end loop;

  if v_cycle.status <> 'surplus' and v_total_units = 0 then
    perform public.raise_order_error('SURPLUS_EMPTY');
  end if;

  update public.production_cycles set
    status = 'surplus',
    surplus_opened_at = coalesce(surplus_opened_at, now()),
    surplus_ends_at = p_ends_at,
    surplus_delivery_allowed = coalesce(p_delivery_allowed, false)
  where id = p_cycle_id;
  perform public.write_audit(p_actor, 'cycle.surplus_publish', 'production_cycles', p_cycle_id::text,
    jsonb_build_object('items', coalesce(p_items, '[]'::jsonb), 'ends_at', p_ends_at,
                       'delivery_allowed', coalesce(p_delivery_allowed, false), 'from', v_cycle.status));
end $$;

-- Retirer un produit du surplus (ses unités restantes repassent en stock interne).
create or replace function public.admin_withdraw_surplus(
  p_cycle_id uuid, p_product_id uuid, p_actor uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_status public.cycle_status;
  v_inv public.inventory_units;
  v_free int;
begin
  select status into v_status from public.production_cycles where id = p_cycle_id for update;
  if not found then perform public.raise_order_error('CYCLE_NOT_FOUND'); end if;
  if v_status <> 'surplus' then
    perform public.raise_order_error('TRANSITION_INVALID', jsonb_build_object('from', v_status, 'to', 'surplus'));
  end if;
  select * into v_inv from public.inventory_units
    where cycle_id = p_cycle_id and product_id = p_product_id for update;
  if not found then perform public.raise_order_error('NOT_IN_CYCLE'); end if;
  v_free := v_inv.total_units - v_inv.reserved_units - v_inv.sold_units;
  if v_free <= 0 then return; end if;
  update public.inventory_units set total_units = reserved_units + sold_units
    where cycle_id = p_cycle_id and product_id = p_product_id;
  insert into public.inventory_movements (cycle_id, product_id, kind, units, reason, actor_id)
    values (p_cycle_id, p_product_id, 'surplus_withdraw', -v_free, 'retiré du surplus par Alima', p_actor);
  perform public.write_audit(p_actor, 'cycle.surplus_withdraw', 'inventory_units', p_cycle_id || ':' || p_product_id,
    jsonb_build_object('units', v_free));
end $$;

revoke all on function public.admin_set_cycle_status(uuid, public.cycle_status, uuid) from public, anon, authenticated;
revoke all on function public.withhold_released_preorder_units() from public, anon, authenticated;
revoke all on function public.admin_plan_extra(uuid, uuid, int, uuid) from public, anon, authenticated;
revoke all on function public.admin_record_production(uuid, uuid, int, int, text, uuid) from public, anon, authenticated;
revoke all on function public.admin_publish_surplus(uuid, jsonb, timestamptz, boolean, uuid) from public, anon, authenticated;
revoke all on function public.admin_withdraw_surplus(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_set_cycle_status(uuid, public.cycle_status, uuid) to service_role;
grant execute on function public.admin_plan_extra(uuid, uuid, int, uuid) to service_role;
grant execute on function public.admin_record_production(uuid, uuid, int, int, text, uuid) to service_role;
grant execute on function public.admin_publish_surplus(uuid, jsonb, timestamptz, boolean, uuid) to service_role;
grant execute on function public.admin_withdraw_surplus(uuid, uuid, uuid) to service_role;
