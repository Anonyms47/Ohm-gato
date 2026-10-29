-- Moyens de paiement par lien marchand : Wave et Orange Money, réglables dans l'atelier.
--   * le lien marchand n'est jamais inventé : sans lien enregistré, Orange Money reste masqué ;
--   * la vérification reste manuelle (aucune API officielle branchée) : seul un administrateur
--     marque la commande payée, jamais le simple clic sur le lien ;
--   * lecture et écriture réservées au serveur (le lien n'est pas exposé en base aux visiteurs) ;
--   * Wave garde son fonctionnement actuel : sans lien en base, le lien marchand de l'environnement sert de repli.
-- Migration additive : voir supabase/rollbacks/20261029000002_payment_method_settings.down.sql.

create table public.payment_method_settings (
  provider text primary key check (provider in ('wave', 'orange_money')),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  merchant_link text check (merchant_link is null or (char_length(merchant_link) <= 400 and merchant_link ~ '^https://[^\s]+$')),
  enabled boolean not null default false,
  instructions text check (instructions is null or char_length(instructions) <= 400),
  -- Aucune API officielle : la vérification manuelle est obligatoire.
  manual_verification boolean not null default true check (manual_verification),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create trigger payment_method_settings_touch before update on public.payment_method_settings
  for each row execute function public.touch_updated_at();

alter table public.payment_method_settings enable row level security;
alter table public.payment_method_settings force row level security;
revoke all on table public.payment_method_settings from anon, authenticated;
grant select, insert, update on table public.payment_method_settings to service_role;

-- Réglages par défaut (aucun lien, aucune donnée de paiement inventée) : Wave actif comme aujourd'hui, Orange Money désactivé.
insert into public.payment_method_settings (provider, display_name, enabled) values
  ('wave', 'Wave', true),
  ('orange_money', 'Orange Money', false);

-- Confirmation au choix d'un lien marchand (Wave ou Orange Money) : même logique que Wave,
-- la mention de l'historique nomme le moyen choisi. Double clic sans effet.
create or replace function public.confirm_order_awaiting_payment_link(p_order_id uuid, p_payment_id uuid, p_label text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_line record;
  v_inv public.inventory_units;
  v_reserved int;
  v_label text := left(coalesce(nullif(btrim(p_label), ''), 'en ligne'), 40);
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then perform public.raise_order_error('ORDER_NOT_FOUND'); end if;
  if v_order.status = 'confirmed' and v_order.payment_status = 'pending' then
    return;
  end if;
  if v_order.status <> 'pending_payment' or v_order.payment_status <> 'pending' then
    perform public.raise_order_error('ORDER_NOT_PAYABLE', jsonb_build_object('status', v_order.status));
  end if;

  if v_order.custom_request_id is null then
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
        values (v_order.cycle_id, v_line.product_id, 'sell', v_line.units, p_order_id, 'confirmée, paiement ' || v_label || ' à vérifier');
    end loop;
  end if;

  update public.orders set status = 'confirmed', reservation_expires_at = null where id = p_order_id;
  insert into public.order_status_history (order_id, status, note)
    values (p_order_id, 'confirmed', 'Confirmée — paiement ' || v_label || ' à vérifier par OHMEGATO');
end $$;

revoke all on function public.confirm_order_awaiting_payment_link(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_order_awaiting_payment_link(uuid, uuid, text) to service_role;

-- L'ancienne fonction Wave reste appelable (compatibilité) et délègue.
create or replace function public.confirm_order_awaiting_wave(p_order_id uuid, p_payment_id uuid)
returns void language sql security definer set search_path = '' as $$
  select public.confirm_order_awaiting_payment_link(p_order_id, p_payment_id, 'Wave');
$$;

-- Enregistrement du paiement par OHMEGATO : la mention nomme le moyen réellement utilisé.
create or replace function public.admin_record_payment(p_order_id uuid, p_reference text, p_actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_payment public.payments;
  v_label text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then perform public.raise_order_error('ORDER_NOT_FOUND'); end if;
  if v_order.payment_status = 'paid' then return; end if; -- jamais de double validation
  if v_order.status in ('cancelled', 'expired', 'refunded') then
    perform public.raise_order_error('ORDER_NOT_PAYABLE', jsonb_build_object('status', v_order.status));
  end if;
  select * into v_payment from public.payments
    where order_id = p_order_id and status = 'pending' order by created_at desc limit 1 for update;
  if not found then perform public.raise_order_error('PAYMENT_NOT_FOUND'); end if;
  v_label := case v_payment.provider::text when 'orange_money' then 'Orange Money' else 'Wave' end;
  update public.payments
    set status = 'paid', paid_at = now(), provider_reference = nullif(trim(p_reference), '')
    where id = v_payment.id;
  update public.orders set payment_status = 'paid', paid_at = now() where id = p_order_id;
  insert into public.order_status_history (order_id, status, note, actor_id)
    values (p_order_id, v_order.status, 'Paiement ' || v_label || ' reçu' || coalesce(' (réf. ' || nullif(trim(p_reference), '') || ')', ''), p_actor);
  perform public.write_audit(p_actor, 'order.payment_recorded', 'orders', p_order_id::text,
    jsonb_build_object('reference', v_order.reference, 'amount', v_payment.amount_fcfa, 'provider', v_payment.provider, 'provider_reference', p_reference));
end $$;

revoke all on function public.admin_record_payment(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_record_payment(uuid, text, uuid) to service_role;
