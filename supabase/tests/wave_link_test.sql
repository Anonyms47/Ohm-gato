-- Lien marchand Wave : commande confirmée au choix de Wave, paiement enregistré à la main,
-- annulation qui rend le stock.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

create temp table w as select
  (select id from public.delivery_slots where kind = 'pickup' order by starts_at limit 1) as slot,
  (select v.id from public.product_variants v join public.products p on p.id = v.product_id
     where p.slug = 'muffins-pepites' and v.label = 'Box de 6') as box6,
  (select id from public.products where slug = 'muffins-pepites') as muffins;
grant select on w to service_role;

set local role service_role;
create temp table o as
select (public.place_order(jsonb_build_object(
  'idempotency_key', gen_random_uuid(), 'cycle_id', '00000000-0000-4000-8000-000000000012',
  'fulfillment', 'pickup', 'slot_id', (select slot from w), 'tracking_token_hash', 'h-wave-1',
  'customer', jsonb_build_object('name', 'W', 'phone', '+221770001111'),
  'items', jsonb_build_array(jsonb_build_object('variant_id', (select box6 from w), 'quantity', 2))
)) ->> 'order_id')::uuid as id;
create temp table p as select (public.create_payment((select id from o), 'wave_link')).id as id;

select lives_ok($$ select public.confirm_order_awaiting_wave((select id from o), (select id from p)) $$, 'choix de Wave : commande confirmée');
select is((select status::text || '/' || payment_status::text from public.orders where id = (select id from o)), 'confirmed/pending',
  'confirmée mais paiement toujours en attente');
select is((select sold_units from public.inventory_units where product_id = (select muffins from w)), 12, 'les 12 muffins sont retenus comme vendus');
select is((select count(*)::int from public.stock_reservations where order_id = (select id from o) and status = 'active'), 0, 'plus de réservation active');
select lives_ok($$ select public.confirm_order_awaiting_wave((select id from o), (select id from p)) $$, 'un double clic ne change rien');
select is((select sold_units from public.inventory_units where product_id = (select muffins from w)), 12, 'le stock n''est pas compté deux fois');

-- Annulation sans paiement : le stock revient.
select lives_ok($$ select public.admin_set_order_status((select id from o), 'cancelled', 'pas de paiement', null) $$, 'annulation par OHMEGATO');
select is((select sold_units from public.inventory_units where product_id = (select muffins from w)), 0, 'les muffins reviennent en stock');
select throws_ok($$ select public.admin_record_payment((select id from o), 'x', null) $$, 'P0001', 'ORDER_NOT_PAYABLE',
  'un paiement ne peut plus être enregistré sur une commande annulée');

select * from finish();
rollback;
