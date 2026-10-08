-- Paiement par lien marchand Wave.
-- Décision d'OHMEGATO : la commande est confirmée dès que le client choisit Wave
-- (stock retenu comme vendu). Le paiement reste « en attente » jusqu'à ce qu'OHMEGATO
-- le constate dans son application Wave et l'enregistre ; sinon elle annule la commande,
-- ce qui rend le stock. Aucun « PAYÉE » n'est affiché avant cet enregistrement.

create or replace function public.confirm_order_awaiting_wave(p_order_id uuid, p_payment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_line record;
  v_inv public.inventory_units;
  v_reserved int;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then perform public.raise_order_error('ORDER_NOT_FOUND'); end if;
  if v_order.status = 'confirmed' and v_order.payment_status = 'pending' then
    return; -- déjà confirmée (double clic, reprise)
  end if;
  if v_order.status <> 'pending_payment' or v_order.payment_status <> 'pending' then
    perform public.raise_order_error('ORDER_NOT_PAYABLE', jsonb_build_object('status', v_order.status));
  end if;

  if v_order.custom_request_id is null then
    -- Réservé → vendu ; une réservation expirée reprend du stock s'il en reste.
    for v_line in
      select product_id, sum(units_per_item * quantity)::int as units
      from public.order_items where order_id = p_order_id and product_id is not null
      group by product_id order by product_id
    loop
      select * into v_inv from public.inventory_units
        where cycle_id = v_order.cycle_id and product_id = v_line.product_id for update;
      select coalesce(sum(units), 0) into v_reserved from public.stock_reservations
        where order_id = p_order_id and product_id = v_line.product_id and status = 'active';
      if v_line.units - v_reserved > 0
         and v_inv.total_units - v_inv.reserved_units - v_inv.sold_units < v_line.units - v_reserved then
        perform public.raise_order_error('INSUFFICIENT_STOCK', jsonb_build_object('product_id', v_line.product_id));
      end if;
      update public.inventory_units
        set reserved_units = reserved_units - v_reserved, sold_units = sold_units + v_line.units
        where cycle_id = v_order.cycle_id and product_id = v_line.product_id;
      update public.stock_reservations set status = 'consumed'
        where order_id = p_order_id and product_id = v_line.product_id and status = 'active';
      insert into public.inventory_movements (cycle_id, product_id, kind, units, order_id, reason)
        values (v_order.cycle_id, v_line.product_id, 'sell', v_line.units, p_order_id, 'confirmée, paiement Wave à vérifier');
    end loop;
  end if;

  update public.orders set status = 'confirmed', reservation_expires_at = null where id = p_order_id;
  insert into public.order_status_history (order_id, status, note)
    values (p_order_id, 'confirmed', 'Confirmée — paiement Wave à vérifier par OHMEGATO');
end $$;

-- OHMEGATO constate le paiement dans son application Wave.
create or replace function public.admin_record_payment(p_order_id uuid, p_reference text, p_actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_payment public.payments;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then perform public.raise_order_error('ORDER_NOT_FOUND'); end if;
  if v_order.payment_status = 'paid' then return; end if;
  if v_order.status in ('cancelled', 'expired', 'refunded') then
    perform public.raise_order_error('ORDER_NOT_PAYABLE', jsonb_build_object('status', v_order.status));
  end if;
  select * into v_payment from public.payments
    where order_id = p_order_id and status = 'pending' order by created_at desc limit 1 for update;
  if not found then perform public.raise_order_error('PAYMENT_NOT_FOUND'); end if;
  update public.payments
    set status = 'paid', paid_at = now(), provider_reference = nullif(trim(p_reference), '')
    where id = v_payment.id;
  update public.orders set payment_status = 'paid', paid_at = now() where id = p_order_id;
  insert into public.order_status_history (order_id, status, note, actor_id)
    values (p_order_id, v_order.status, 'Paiement Wave reçu' || coalesce(' (réf. ' || nullif(trim(p_reference), '') || ')', ''), p_actor);
  perform public.write_audit(p_actor, 'order.payment_recorded', 'orders', p_order_id::text,
    jsonb_build_object('reference', v_order.reference, 'amount', v_payment.amount_fcfa, 'provider_reference', p_reference));
end $$;

-- Annulation : rend aussi le stock d'une commande confirmée mais non payée.
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
    -- Unités vendues (payées ou confirmées en attente de paiement) rendues à la fournée.
    if v_order.custom_request_id is null and v_order.status <> 'needs_attention' then
      for v_line in
        select product_id, sum(case when kind = 'sell' then units else -units end)::int as units
        from public.inventory_movements
        where order_id = p_order_id and kind in ('sell', 'cancel_sale')
        group by product_id having sum(case when kind = 'sell' then units else -units end) > 0
        order by product_id
      loop
        update public.inventory_units set sold_units = greatest(sold_units - v_line.units, 0)
          where cycle_id = v_order.cycle_id and product_id = v_line.product_id;
        insert into public.inventory_movements (cycle_id, product_id, kind, units, order_id, reason, actor_id)
          values (v_order.cycle_id, v_line.product_id, 'cancel_sale', v_line.units, p_order_id, 'commande annulée', p_actor);
      end loop;
    end if;
    perform public.release_order_reservations(p_order_id, 'annulée par OHMEGATO');
    if v_order.payment_status <> 'paid' then
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

do $$
declare f text;
begin
  foreach f in array array[
    'public.confirm_order_awaiting_wave(uuid, uuid)',
    'public.admin_record_payment(uuid, text, uuid)',
    'public.admin_set_order_status(uuid, public.order_status, text, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
