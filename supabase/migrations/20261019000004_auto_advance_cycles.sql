-- Fournées : étapes qui avancent seules, à l'heure de Dakar, sans jamais toucher à l'argent.
--   * date limite passée : précommandes clôturées (quantités figées pour la fiche de production) ;
--   * jour de production : fournée « en production », commandes payées « en préparation »
--     (les paiements vérifiés plus tard rejoignent la préparation au passage suivant) ;
--   * jour de remise : fournée « en livraison » ;
--   * toutes les commandes remises et aucun surplus à proposer : fournée terminée.
-- Restent toujours manuels : paiements, remboursements, annulations, publication du surplus.
-- Idempotent : rejouer la fonction ne fait rien de plus.
create or replace function public.auto_advance_cycles()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Africa/Dakar')::date;
  c record;
  o record;
  v_closed int := 0;
  v_preparing int := 0;
  v_orders int := 0;
  v_delivering int := 0;
  v_done int := 0;
begin
  -- 1. Date limite passée : clôture des précommandes.
  for c in select id from public.production_cycles where status = 'open' and closes_at <= now() order by closes_at loop
    perform public.admin_set_cycle_status(c.id, 'closed', null);
    v_closed := v_closed + 1;
  end loop;

  -- 2. Jour de production atteint : la fournée passe en production.
  for c in
    select id from public.production_cycles
    where status = 'closed'
      and coalesce((select min(d) from unnest(production_dates) d), production_date) <= v_today
  loop
    perform public.admin_set_cycle_status(c.id, 'preparing', null);
    v_preparing := v_preparing + 1;
  end loop;

  -- 3. Commandes payées d'une fournée en production : en préparation (e-mail envoyé à la cliente).
  for o in
    select ord.id from public.orders ord
    join public.production_cycles cyc on cyc.id = ord.cycle_id
    where cyc.status in ('preparing', 'delivering') and ord.status = 'confirmed' and ord.payment_status = 'paid'
    order by ord.created_at
  loop
    perform public.admin_set_order_status(o.id, 'preparing', 'Automatique : jour de production', null);
    v_orders := v_orders + 1;
  end loop;

  -- 4. Jour de remise atteint : livraisons et retraits.
  for c in select id from public.production_cycles where status = 'preparing' and fulfillment_date <= v_today loop
    perform public.admin_set_cycle_status(c.id, 'delivering', null);
    v_delivering := v_delivering + 1;
  end loop;

  -- 5. Tout est remis et rien à proposer en surplus (production réelle saisie, rien en trop) : terminée.
  for c in
    select pc.id from public.production_cycles pc
    where pc.status = 'delivering'
      and exists (select 1 from public.orders where cycle_id = pc.id and status in ('delivered', 'picked_up'))
      and not exists (
        select 1 from public.orders where cycle_id = pc.id
          and status in ('pending_payment', 'awaiting_validation', 'confirmed', 'preparing', 'finishing', 'ready', 'out_for_delivery', 'needs_attention'))
      and not exists (
        select 1 from public.inventory_units i where i.cycle_id = pc.id
          and (i.produced_units is null or i.produced_units - i.lost_units - i.reserved_units - i.sold_units > 0))
  loop
    perform public.admin_set_cycle_status(c.id, 'done', null);
    v_done := v_done + 1;
  end loop;

  return jsonb_build_object('closed', v_closed, 'preparing', v_preparing, 'orders_preparing', v_orders, 'delivering', v_delivering, 'done', v_done);
end $$;

revoke all on function public.auto_advance_cycles() from public, anon, authenticated;
grant execute on function public.auto_advance_cycles() to service_role;
