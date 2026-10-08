-- OHMEGATO — administration d'Alima : fournées, stock, commandes, livraisons, clients.
-- Toutes les opérations sensibles sont atomiques, réservées au service_role (le serveur
-- vérifie d'abord le rôle admin) et journalisées dans audit_logs.

alter table public.orders
  add column courier_name text,
  add column courier_phone text,
  add column handed_to_courier_at timestamptz,
  add column delivered_at timestamptz;

-- Notes internes sur un client (jamais visibles par le client).
create table public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_phone text not null,
  body text not null check (length(body) between 1 and 2000),
  author_id uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index customer_notes_phone_idx on public.customer_notes (customer_phone, created_at desc);
alter table public.customer_notes enable row level security;
alter table public.customer_notes force row level security;
create policy "notes internes admin" on public.customer_notes for select using (public.is_admin());

create index orders_created_idx on public.orders (created_at desc);
create index orders_phone_idx on public.orders (customer_phone);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

create or replace function public.write_audit(
  p_actor uuid, p_action text, p_entity text, p_entity_id text, p_details jsonb
) returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (p_actor, p_action, p_entity, p_entity_id, p_details);
$$;

-- ---------------------------------------------------------------------------
-- Fournées : cycle de vie
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_cycle_status(
  p_cycle_id uuid, p_status public.cycle_status, p_actor uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_cycle public.production_cycles;
  v_allowed public.cycle_status[];
  o record;
begin
  select * into v_cycle from public.production_cycles where id = p_cycle_id for update;
  if not found then perform public.raise_order_error('CYCLE_NOT_FOUND'); end if;

  v_allowed := case v_cycle.status
    when 'draft' then array['scheduled', 'open', 'cancelled']::public.cycle_status[]
    when 'scheduled' then array['draft', 'open', 'cancelled']::public.cycle_status[]
    when 'open' then array['closed', 'cancelled']::public.cycle_status[]
    when 'closed' then array['open', 'preparing', 'cancelled']::public.cycle_status[]
    when 'preparing' then array['delivering', 'done']::public.cycle_status[]
    when 'delivering' then array['done']::public.cycle_status[]
    else array[]::public.cycle_status[]
  end;
  if not (p_status = any (v_allowed)) then
    perform public.raise_order_error('TRANSITION_INVALID', jsonb_build_object('from', v_cycle.status, 'to', p_status));
  end if;

  if p_status = 'open' then
    if exists (select 1 from public.production_cycles where status = 'open' and id <> p_cycle_id) then
      perform public.raise_order_error('ANOTHER_CYCLE_OPEN');
    end if;
    if not exists (select 1 from public.cycle_products where cycle_id = p_cycle_id) then
      perform public.raise_order_error('CYCLE_EMPTY');
    end if;
    if v_cycle.closes_at <= now() then
      perform public.raise_order_error('CYCLE_DATES_PAST');
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

  update public.production_cycles set status = p_status where id = p_cycle_id;
  perform public.write_audit(p_actor, 'cycle.status', 'production_cycles', p_cycle_id::text,
    jsonb_build_object('from', v_cycle.status, 'to', p_status));
end $$;

-- ---------------------------------------------------------------------------
-- Stock : ajustement du total (unités réelles), jamais sous réservé + vendu
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_stock(
  p_cycle_id uuid, p_product_id uuid, p_total int, p_reason text, p_actor uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.inventory_units;
begin
  if p_total is null or p_total < 0 then perform public.raise_order_error('STOCK_INVALID'); end if;
  if not exists (select 1 from public.cycle_products where cycle_id = p_cycle_id and product_id = p_product_id) then
    perform public.raise_order_error('NOT_IN_CYCLE');
  end if;
  insert into public.inventory_units (cycle_id, product_id, total_units)
    values (p_cycle_id, p_product_id, 0) on conflict do nothing;
  select * into v_inv from public.inventory_units
    where cycle_id = p_cycle_id and product_id = p_product_id for update;
  if p_total < v_inv.reserved_units + v_inv.sold_units then
    perform public.raise_order_error('STOCK_BELOW_COMMITTED', jsonb_build_object(
      'committed', v_inv.reserved_units + v_inv.sold_units));
  end if;
  if p_total = v_inv.total_units then return; end if;
  update public.inventory_units set total_units = p_total
    where cycle_id = p_cycle_id and product_id = p_product_id;
  insert into public.inventory_movements (cycle_id, product_id, kind, units, reason, actor_id)
    values (p_cycle_id, p_product_id,
            case when v_inv.total_units = 0 and not exists (
              select 1 from public.inventory_movements where cycle_id = p_cycle_id and product_id = p_product_id
            ) then 'initial'::public.movement_kind else 'adjustment' end,
            p_total - v_inv.total_units, coalesce(nullif(p_reason, ''), 'ajustement'), p_actor);
  perform public.write_audit(p_actor, 'stock.set', 'inventory_units', p_cycle_id || ':' || p_product_id,
    jsonb_build_object('from', v_inv.total_units, 'to', p_total, 'reason', p_reason));
end $$;

-- ---------------------------------------------------------------------------
-- Commandes : statut, livreur
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_order_status(
  p_order_id uuid, p_status public.order_status, p_note text, p_actor uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_allowed public.order_status[];
  v_line record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then perform public.raise_order_error('ORDER_NOT_FOUND'); end if;

  v_allowed := case v_order.status
    when 'pending_payment' then array['cancelled']::public.order_status[]
    when 'confirmed' then array['preparing', 'cancelled']::public.order_status[]
    when 'preparing' then array['finishing', 'ready', 'cancelled']::public.order_status[]
    when 'finishing' then array['ready', 'cancelled']::public.order_status[]
    when 'ready' then case when v_order.fulfillment = 'delivery'
      then array['out_for_delivery', 'cancelled']::public.order_status[]
      else array['picked_up', 'cancelled']::public.order_status[] end
    when 'out_for_delivery' then array['delivered', 'ready']::public.order_status[]
    when 'needs_attention' then array['confirmed', 'cancelled', 'refunded']::public.order_status[]
    when 'cancelled' then case when v_order.payment_status = 'paid'
      then array['refunded']::public.order_status[] else array[]::public.order_status[] end
    else array[]::public.order_status[]
  end;
  if not (p_status = any (v_allowed)) then
    perform public.raise_order_error('TRANSITION_INVALID', jsonb_build_object('from', v_order.status, 'to', p_status));
  end if;

  if p_status = 'cancelled' then
    if v_order.payment_status = 'paid' then
      -- Les unités vendues reviennent au stock de la fournée ; le remboursement est à organiser.
      if v_order.custom_request_id is null and v_order.status <> 'needs_attention' then
        for v_line in
          select product_id, sum(units_per_item * quantity)::int as units
          from public.order_items where order_id = p_order_id and product_id is not null
          group by product_id order by product_id
        loop
          update public.inventory_units set sold_units = greatest(sold_units - v_line.units, 0)
            where cycle_id = v_order.cycle_id and product_id = v_line.product_id;
          insert into public.inventory_movements (cycle_id, product_id, kind, units, order_id, reason, actor_id)
            values (v_order.cycle_id, v_line.product_id, 'cancel_sale', v_line.units, p_order_id, 'commande annulée', p_actor);
        end loop;
      end if;
    else
      perform public.release_order_reservations(p_order_id, 'annulée par OHMEGATO');
      update public.payments set status = 'cancelled' where order_id = p_order_id and status = 'pending';
      update public.orders set payment_status = 'cancelled' where id = p_order_id;
    end if;
  end if;

  if p_status = 'refunded' then
    update public.payments set status = 'refunded' where order_id = p_order_id and status = 'paid';
    update public.orders set payment_status = 'refunded' where id = p_order_id;
  end if;

  update public.orders
    set status = p_status,
        delivered_at = case when p_status in ('delivered', 'picked_up') then now() else delivered_at end,
        handed_to_courier_at = case when p_status = 'out_for_delivery' then now()
                                    when p_status = 'ready' then null else handed_to_courier_at end
    where id = p_order_id;
  insert into public.order_status_history (order_id, status, note, actor_id)
    values (p_order_id, p_status, nullif(p_note, ''), p_actor);
  perform public.write_audit(p_actor, 'order.status', 'orders', p_order_id::text,
    jsonb_build_object('reference', v_order.reference, 'from', v_order.status, 'to', p_status, 'note', p_note));
end $$;

-- ---------------------------------------------------------------------------
-- Paiement : version tenant compte des commandes sur-mesure (sans stock)
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
  v_has_inv boolean;
begin
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

      if v_order.custom_request_id is null then
        -- Réservé → vendu ; si la réservation avait expiré, on reprend du stock disponible.
        for v_line in
          select product_id, sum(units_per_item * quantity)::int as units
          from public.order_items where order_id = v_order.id and product_id is not null
          group by product_id order by product_id
        loop
          select * into v_inv from public.inventory_units
            where cycle_id = v_order.cycle_id and product_id = v_line.product_id for update;
          v_has_inv := found;
          select coalesce(sum(units), 0) into v_reserved from public.stock_reservations
            where order_id = v_order.id and product_id = v_line.product_id and status = 'active';
          v_missing := v_line.units - v_reserved;

          if not v_has_inv or (v_missing > 0 and v_inv.total_units - v_inv.reserved_units - v_inv.sold_units < v_missing) then
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
          perform public.release_order_reservations(v_order.id, 'conflit de stock après paiement');
        end if;
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
    elsif v_order.custom_request_id is not null then
      -- Sur-mesure : la commande reste à payer, le client peut relancer le paiement.
      update public.payments set status = p_status where id = v_payment.id;
      insert into public.order_status_history (order_id, status, note)
        values (v_order.id, 'pending_payment', 'Paiement ' || p_status::text || ' : à relancer');
      v_outcome := p_status::text;
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

-- Paiement à relancer pour une commande sur-mesure : create_payment n'exige plus de réservation.
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
  if v_order.custom_request_id is null and v_order.reservation_expires_at <= now() then
    perform public.raise_order_error('ORDER_NOT_PAYABLE', jsonb_build_object('status', 'expired'));
  end if;

  select * into v_payment from public.payments
    where order_id = p_order_id and provider = p_provider and status = 'pending'
    order by created_at desc limit 1;
  if found then return v_payment; end if;

  insert into public.payments (order_id, provider, amount_fcfa)
    values (p_order_id, p_provider, v_order.total_fcfa)
    returning * into v_payment;
  return v_payment;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.write_audit(uuid, text, text, text, jsonb)',
    'public.admin_set_cycle_status(uuid, public.cycle_status, uuid)',
    'public.admin_set_stock(uuid, uuid, int, text, uuid)',
    'public.admin_set_order_status(uuid, public.order_status, text, uuid)',
    'public.apply_payment_event(public.payment_provider, text, text, uuid, public.payment_status, int, text, boolean, jsonb)',
    'public.create_payment(uuid, public.payment_provider)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- Médias éditoriaux (archives, photo d'Alima, audio) : lecture publique, écriture admin.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site', 'site', true, 10485760,
        array['image/webp', 'image/avif', 'image/png', 'image/jpeg', 'audio/mpeg', 'audio/mp4', 'audio/ogg'])
on conflict (id) do nothing;
create policy "médias du site lisibles" on storage.objects for select using (bucket_id = 'site');
create policy "médias du site gérés par l'admin" on storage.objects
  for all using (bucket_id = 'site' and public.is_admin())
  with check (bucket_id = 'site' and public.is_admin());
