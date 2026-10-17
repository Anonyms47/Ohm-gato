-- E-mail « commande livrée / retirée » : la cliente est prévenue quand sa commande lui est remise.
-- Même mécanisme que les autres étapes : une clé unique par événement, jamais de second envoi.

alter table public.email_outbox drop constraint email_outbox_template_check;
alter table public.email_outbox add constraint email_outbox_template_check check (template in (
  'order_registered', 'payment_confirmed', 'order_preparing', 'order_ready', 'pickup_ready',
  'out_for_delivery', 'order_delivered', 'order_cancelled', 'refund_recorded', 'admin_digest'
));

create or replace function public.orders_email_events()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Paiement vérifié (Wave à la main) ou confirmé par le prestataire.
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    perform public.enqueue_order_email(new.id, 'payment_confirmed', 'order:' || new.id || ':paid');
  end if;
  if new.status is distinct from old.status then
    case new.status
      when 'confirmed' then
        -- Commande enregistrée (choix de Wave : paiement encore à vérifier).
        if new.payment_status <> 'paid' then
          perform public.enqueue_order_email(new.id, 'order_registered', 'order:' || new.id || ':registered');
        end if;
      when 'preparing' then
        perform public.enqueue_order_email(new.id, 'order_preparing', 'order:' || new.id || ':preparing');
      when 'ready' then
        perform public.enqueue_order_email(new.id, case when new.fulfillment = 'pickup' then 'pickup_ready' else 'order_ready' end, 'order:' || new.id || ':ready');
      when 'out_for_delivery' then
        perform public.enqueue_order_email(new.id, 'out_for_delivery', 'order:' || new.id || ':out_for_delivery');
      when 'delivered', 'picked_up' then
        perform public.enqueue_order_email(new.id, 'order_delivered', 'order:' || new.id || ':delivered');
      when 'cancelled' then
        perform public.enqueue_order_email(new.id, 'order_cancelled', 'order:' || new.id || ':cancelled');
      else null;
    end case;
  end if;
  return new;
end $$;
