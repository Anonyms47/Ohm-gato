-- Numéros de commande lisibles : OHM<fournée>-<numéro sur 4 chiffres>, dans l'ordre des
-- commandes de chaque fournée (OHM1-0001, OHM1-0002…). Les commandes déjà passées gardent
-- leur numéro ; le compteur de chaque fournée reprend après elles.

create table public.order_reference_counters (
  cycle_id uuid primary key references public.production_cycles (id) on delete cascade,
  last_value int not null default 0 check (last_value >= 0)
);
alter table public.order_reference_counters enable row level security;
revoke all on public.order_reference_counters from public, anon, authenticated;

insert into public.order_reference_counters (cycle_id, last_value)
  select cycle_id, count(*) from public.orders group by cycle_id;

-- Prochain numéro de la fournée. Le verrou sur la ligne du compteur dure jusqu'à la fin de
-- la commande : deux commandes simultanées ne reçoivent jamais le même numéro, et une
-- commande refusée ne consomme pas de numéro (le compteur revient en arrière avec elle).
create function public.next_order_reference(p_cycle_id uuid, p_cycle_number int)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_value int;
begin
  insert into public.order_reference_counters (cycle_id, last_value) values (p_cycle_id, 1)
    on conflict (cycle_id) do update set last_value = public.order_reference_counters.last_value + 1
    returning last_value into v_value;
  return 'OHM' || p_cycle_number || '-' || lpad(v_value::text, greatest(4, length(v_value::text)), '0');
end $$;
revoke all on function public.next_order_reference(uuid, int) from public, anon, authenticated;
grant execute on function public.next_order_reference(uuid, int) to service_role;

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

  -- Lignes : prix et unités relus en base (accumulées dans v_lines, sans table temporaire)

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

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_variant.product_id, 'variant_id', v_variant.id, 'flavor_id', v_flavor_id,
      'product_name', v_variant.product_name, 'variant_label', v_variant.label, 'flavor_name', v_flavor_name,
      'units_per_item', v_variant.units_consumed, 'quantity', v_qty, 'unit_price', v_variant.price_fcfa
    ));
    v_subtotal := v_subtotal + v_variant.price_fcfa * v_qty;
  end loop;

  -- Vérification du stock, produits verrouillés dans un ordre stable (pas d'interblocage).
  if v_status = 'pending_payment' then
    for v_needed in
      select product_id, sum(units_per_item * quantity)::int as units, min(product_name) as product_name
      from jsonb_to_recordset(v_lines) as l(product_id uuid, variant_id uuid, flavor_id uuid, product_name text, variant_label text, flavor_name text, units_per_item int, quantity int, unit_price int) group by product_id order by product_id
    loop
      -- Précommande : aucune limite de stock, la production suit la demande.
      if v_kind = 'preorder' then
        insert into public.inventory_units (cycle_id, product_id)
          values (v_cycle.id, v_needed.product_id)
          on conflict do nothing;
      end if;
      select * into v_inv from public.inventory_units
        where cycle_id = v_cycle.id and product_id = v_needed.product_id for update;
      if v_kind = 'surplus' and (not found or v_inv.total_units - v_inv.reserved_units - v_inv.sold_units < v_needed.units) then
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

  -- Numéro lisible et suivi par fournée : OHM1-0001, OHM1-0002…
  loop
    v_reference := public.next_order_reference(v_cycle.id, v_cycle.number);
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
  from jsonb_to_recordset(v_lines) as l(product_id uuid, variant_id uuid, flavor_id uuid, product_name text, variant_label text, flavor_name text, units_per_item int, quantity int, unit_price int);

  if v_status = 'pending_payment' then
    for v_needed in
      select product_id, sum(units_per_item * quantity)::int as units
      from jsonb_to_recordset(v_lines) as l(product_id uuid, variant_id uuid, flavor_id uuid, product_name text, variant_label text, flavor_name text, units_per_item int, quantity int, unit_price int) group by product_id order by product_id
    loop
      update public.inventory_units
        set reserved_units = reserved_units + v_needed.units,
            -- Précommande : le total suit les unités engagées (aucun plafond).
            total_units = case when v_kind = 'preorder'
              then greatest(total_units, reserved_units + sold_units + v_needed.units)
              else total_units end
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
