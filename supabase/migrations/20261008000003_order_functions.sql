-- OHMEGATO — fonctions transactionnelles : commande, stock, paiement.
-- Toutes sont SECURITY DEFINER et réservées au service_role (serveur Next.js).
-- Les prix sont toujours recalculés ici : le navigateur n'envoie que des identifiants et des quantités.

create or replace function public.random_code(p_length int)
returns text language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; -- sans 0/O/1/I/L
  bytes bytea := extensions.gen_random_bytes(p_length);
  result text := '';
begin
  for i in 0 .. p_length - 1 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return result;
end $$;

create or replace function public.raise_order_error(p_code text, p_detail jsonb default '{}')
returns void language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = 'P0001', message = p_code, detail = p_detail::text;
end $$;

-- ---------------------------------------------------------------------------
-- Libération des réservations
-- ---------------------------------------------------------------------------
create or replace function public.release_order_reservations(p_order_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in
    select * from public.stock_reservations
    where order_id = p_order_id and status = 'active'
    order by product_id
    for update
  loop
    update public.inventory_units
      set reserved_units = reserved_units - r.units
      where cycle_id = r.cycle_id and product_id = r.product_id;
    update public.stock_reservations set status = 'released' where id = r.id;
    insert into public.inventory_movements (cycle_id, product_id, kind, units, order_id, reason)
      values (r.cycle_id, r.product_id, 'release', r.units, p_order_id, p_reason);
  end loop;
end $$;

-- Expire les commandes provisoires dont la réservation est échue.
create or replace function public.expire_stale_orders()
returns int language plpgsql security definer set search_path = '' as $$
declare
  o record;
  n int := 0;
begin
  for o in
    select id from public.orders
    where status = 'pending_payment' and payment_status = 'pending'
      and reservation_expires_at < now()
    for update skip locked
  loop
    perform public.release_order_reservations(o.id, 'réservation expirée');
    update public.orders set status = 'expired', payment_status = 'expired' where id = o.id;
    update public.payments set status = 'expired' where order_id = o.id and status = 'pending';
    insert into public.order_status_history (order_id, status, note)
      values (o.id, 'expired', 'Délai de paiement dépassé');
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Création d'une commande provisoire (atomique)
-- ---------------------------------------------------------------------------
create or replace function public.place_order(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_idem uuid := (p ->> 'idempotency_key')::uuid;
  v_existing public.orders;
  v_cycle public.production_cycles;
  v_slot public.delivery_slots;
  v_fulfillment public.fulfillment_method := (p ->> 'fulfillment')::public.fulfillment_method;
  v_zone public.delivery_zones;
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

  -- Fournée ouverte uniquement (verrou partagé : la clôture attend la fin de la transaction).
  select * into v_cycle from public.production_cycles where id = (p ->> 'cycle_id')::uuid for share;
  if not found or v_cycle.status <> 'open' or now() < v_cycle.opens_at or now() >= v_cycle.closes_at then
    perform public.raise_order_error('CYCLE_NOT_OPEN');
  end if;

  -- Créneau
  select * into v_slot from public.delivery_slots where id = (p ->> 'slot_id')::uuid for update;
  if not found or v_slot.cycle_id <> v_cycle.id or not v_slot.is_active
     or (v_slot.kind <> 'both' and v_slot.kind::text <> v_fulfillment::text) then
    perform public.raise_order_error('SLOT_INVALID');
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
    if p #>> '{delivery,zone_id}' is not null then
      select * into v_zone from public.delivery_zones
        where id = (p #>> '{delivery,zone_id}')::uuid and is_active;
      if not found then
        perform public.raise_order_error('ZONE_INVALID');
      end if;
      v_fee := v_zone.fee_fcfa; -- null = tarif à valider par l'équipe
    end if;
  else
    v_fee := 0;
  end if;

  v_status := case
    when v_fulfillment = 'delivery' and v_fee is null then 'awaiting_validation'
    else 'pending_payment'
  end;

  -- Lignes : prix et unités relus en base
  drop table if exists pg_temp._lines;
  create temporary table _lines (
    product_id uuid, variant_id uuid, flavor_id uuid, product_name text, variant_label text,
    flavor_name text, units_per_item int, quantity int, unit_price int
  ) on commit drop;

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

    if v_cycle.capacity_units is not null then
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
    subtotal_fcfa, delivery_fee_fcfa, total_fcfa, reservation_expires_at
  ) values (
    v_order_id, v_reference, p ->> 'tracking_token_hash', v_idem, (p ->> 'user_id')::uuid, v_cycle.id, v_status,
    v_fulfillment, v_slot.id, p #>> '{customer,name}', p #>> '{customer,phone}', nullif(p #>> '{customer,email}', ''),
    case when v_fulfillment = 'delivery' then v_zone.id end,
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
    v_subtotal, v_fee, v_subtotal + coalesce(v_fee, 0),
    case when v_status = 'pending_payment' then v_expires end
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
        values (v_cycle.id, v_needed.product_id, 'reserve', v_needed.units, v_order_id, 'commande provisoire');
    end loop;
  end if;

  insert into public.order_status_history (order_id, status) values (v_order_id, v_status);

  return jsonb_build_object(
    'order_id', v_order_id, 'reference', v_reference, 'status', v_status,
    'total_fcfa', v_subtotal + coalesce(v_fee, 0), 'replayed', false
  );
end $$;

-- ---------------------------------------------------------------------------
-- Enregistrement d'un paiement créé chez le fournisseur
-- ---------------------------------------------------------------------------
create or replace function public.create_payment(
  p_order_id uuid, p_provider public.payment_provider
) returns public.payments language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_payment public.payments;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then perform public.raise_order_error('ORDER_NOT_FOUND'); end if;
  if v_order.status <> 'pending_payment' or v_order.payment_status <> 'pending' then
    perform public.raise_order_error('ORDER_NOT_PAYABLE', jsonb_build_object('status', v_order.status));
  end if;
  if v_order.reservation_expires_at <= now() then
    perform public.raise_order_error('ORDER_NOT_PAYABLE', jsonb_build_object('status', 'expired'));
  end if;

  -- Reprise : si un paiement est déjà en cours chez ce fournisseur, on le réutilise.
  select * into v_payment from public.payments
    where order_id = p_order_id and provider = p_provider and status = 'pending'
    order by created_at desc limit 1;
  if found then return v_payment; end if;

  insert into public.payments (order_id, provider, amount_fcfa)
    values (p_order_id, p_provider, v_order.total_fcfa)
    returning * into v_payment;
  return v_payment;
end $$;

create or replace function public.attach_payment_session(
  p_payment_id uuid, p_session_id text, p_checkout_url text
) returns void language sql security definer set search_path = '' as $$
  update public.payments
    set provider_session_id = p_session_id, checkout_url = p_checkout_url
    where id = p_payment_id and status = 'pending';
$$;

-- ---------------------------------------------------------------------------
-- Application d'un événement de paiement (webhook) — idempotent
-- ---------------------------------------------------------------------------
create or replace function public.apply_payment_event(
  p_provider public.payment_provider,
  p_event_id text,
  p_event_type text,
  p_payment_id uuid,
  p_status public.payment_status,
  p_amount_fcfa int,
  p_provider_reference text,
  p_signature_valid boolean,
  p_payload jsonb
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_event_id bigint;
  v_payment public.payments;
  v_order public.orders;
  v_outcome text;
  v_line record;
  v_inv public.inventory_units;
  v_reserved int;
  v_missing int;
  v_conflict boolean := false;
begin
  -- payment_id n'est relié que s'il existe (un événement peut viser un paiement inconnu).
  insert into public.payment_events (provider, event_id, event_type, payment_id, signature_valid, payload)
    values (p_provider, p_event_id, p_event_type,
            (select id from public.payments where id = p_payment_id), p_signature_valid, p_payload)
    on conflict (provider, event_id) do nothing
    returning id into v_event_id;
  if v_event_id is null then
    return 'duplicate';
  end if;

  if not p_signature_valid then
    update public.payment_events set outcome = 'rejected_signature' where id = v_event_id;
    return 'rejected_signature';
  end if;

  select * into v_payment from public.payments
    where id = p_payment_id and provider = p_provider for update;
  if not found then
    update public.payment_events set outcome = 'unknown_payment' where id = v_event_id;
    return 'unknown_payment';
  end if;
  select * into v_order from public.orders where id = v_payment.order_id for update;

  if p_status = 'paid' then
    if v_payment.status = 'paid' then
      v_outcome := 'already_paid';
    elsif p_amount_fcfa is distinct from v_payment.amount_fcfa
          or v_payment.amount_fcfa <> v_order.total_fcfa then
      update public.orders set status = 'needs_attention' where id = v_order.id;
      insert into public.order_status_history (order_id, status, note)
        values (v_order.id, 'needs_attention', 'Montant payé différent du montant attendu');
      v_outcome := 'amount_mismatch';
    else
      update public.payments
        set status = 'paid', paid_at = now(), provider_reference = p_provider_reference
        where id = v_payment.id;

      -- Réservé → vendu ; si la réservation avait expiré, on reprend du stock disponible.
      for v_line in
        select product_id, sum(units_per_item * quantity)::int as units
        from public.order_items where order_id = v_order.id
        group by product_id order by product_id
      loop
        select * into v_inv from public.inventory_units
          where cycle_id = v_order.cycle_id and product_id = v_line.product_id for update;
        select coalesce(sum(units), 0) into v_reserved from public.stock_reservations
          where order_id = v_order.id and product_id = v_line.product_id and status = 'active';
        v_missing := v_line.units - v_reserved;

        if v_missing > 0 and v_inv.total_units - v_inv.reserved_units - v_inv.sold_units < v_missing then
          v_conflict := true;
        else
          update public.inventory_units
            set reserved_units = reserved_units - v_reserved,
                sold_units = sold_units + v_line.units
            where cycle_id = v_order.cycle_id and product_id = v_line.product_id;
          update public.stock_reservations set status = 'consumed'
            where order_id = v_order.id and product_id = v_line.product_id and status = 'active';
          insert into public.inventory_movements (cycle_id, product_id, kind, units, order_id, reason)
            values (v_order.cycle_id, v_line.product_id, 'sell', v_line.units, v_order.id, 'paiement confirmé');
        end if;
      end loop;

      if v_conflict then
        -- Rien ne doit rester bloqué : l'équipe arbitre (remboursement ou production en plus).
        perform public.release_order_reservations(v_order.id, 'conflit de stock après paiement');
      end if;

      update public.orders
        set payment_status = 'paid', paid_at = now(),
            status = case when v_conflict then 'needs_attention'::public.order_status else 'confirmed' end
        where id = v_order.id;
      insert into public.order_status_history (order_id, status, note)
        values (v_order.id,
                case when v_conflict then 'needs_attention'::public.order_status else 'confirmed' end,
                case when v_conflict then 'Paiement reçu après expiration : stock insuffisant' end);
      v_outcome := case when v_conflict then 'paid_stock_conflict' else 'paid' end;
    end if;

  elsif p_status in ('failed', 'cancelled', 'expired') then
    if v_payment.status = 'paid' or v_order.payment_status = 'paid' then
      v_outcome := 'ignored_after_paid';
    else
      update public.payments set status = p_status where id = v_payment.id;
      perform public.release_order_reservations(v_order.id, 'paiement ' || p_status::text);
      update public.orders
        set payment_status = p_status,
            status = case when p_status = 'expired' then 'expired'::public.order_status else 'cancelled' end
        where id = v_order.id and status in ('pending_payment', 'expired');
      if found then
        insert into public.order_status_history (order_id, status, note)
          values (v_order.id,
                  case when p_status = 'expired' then 'expired'::public.order_status else 'cancelled' end,
                  'Paiement ' || p_status::text);
      end if;
      v_outcome := p_status::text;
    end if;

  elsif p_status = 'refunded' then
    if v_payment.status = 'paid' then
      update public.payments set status = 'refunded' where id = v_payment.id;
      update public.orders set payment_status = 'refunded', status = 'refunded' where id = v_order.id;
      insert into public.order_status_history (order_id, status, note)
        values (v_order.id, 'refunded', 'Remboursement confirmé par le fournisseur');
      v_outcome := 'refunded';
    else
      v_outcome := 'ignored_refund';
    end if;
  else
    v_outcome := 'noop';
  end if;

  update public.payment_events set outcome = v_outcome where id = v_event_id;
  return v_outcome;
end $$;

-- ---------------------------------------------------------------------------
-- Limitation de débit (OTP, commande, paiement, formulaires)
-- ---------------------------------------------------------------------------
create or replace function public.check_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits int;
begin
  insert into public.rate_limits (key, window_start, hits) values (p_key, v_window, 1)
    on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
    returning hits into v_hits;
  delete from public.rate_limits where window_start < now() - interval '1 day';
  return v_hits <= p_limit;
end $$;

-- ---------------------------------------------------------------------------
-- Droits : uniquement le serveur (service_role)
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.random_code(int)',
    'public.raise_order_error(text, jsonb)',
    'public.release_order_reservations(uuid, text)',
    'public.expire_stale_orders()',
    'public.place_order(jsonb)',
    'public.create_payment(uuid, public.payment_provider)',
    'public.attach_payment_session(uuid, text, text)',
    'public.apply_payment_event(public.payment_provider, text, text, uuid, public.payment_status, int, text, boolean, jsonb)',
    'public.check_rate_limit(text, int, int)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
