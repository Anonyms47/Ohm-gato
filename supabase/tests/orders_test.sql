-- Tests de la base : commande, stock, paiement, RLS.
-- Lancer : npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

-- ---------------------------------------------------------------------------
-- Préparation
-- ---------------------------------------------------------------------------
create temp table ids as
select
  '00000000-0000-4000-8000-000000000012'::uuid as cycle_id,
  (select id from public.delivery_slots where kind = 'pickup' order by starts_at limit 1) as pickup_slot,
  (select id from public.delivery_slots where kind = 'delivery' order by starts_at limit 1) as delivery_slot,
  (select v.id from public.product_variants v join public.products p on p.id = v.product_id
     where p.slug = 'cookies' and v.label = 'Unité') as cookie_unit,
  (select v.id from public.product_variants v join public.products p on p.id = v.product_id
     where p.slug = 'cookies' and v.label = 'Box de 6') as cookie_box6,
  (select v.id from public.product_variants v join public.products p on p.id = v.product_id
     where p.slug = 'verrines-fruitees' and v.label = 'Box de 4') as verrine_box4,
  (select v.id from public.product_variants v join public.products p on p.id = v.product_id
     where p.slug = 'verrines-fruitees' and v.label = 'Unité') as verrine_unit,
  (select v.id from public.product_variants v join public.products p on p.id = v.product_id
     where p.slug = 'moelleux-pommes' and v.label = 'Part') as pommes_part,
  (select id from public.products where slug = 'cookies') as cookies_id,
  (select id from public.flavors where slug = 'fraise') as fraise,
  (select id from public.flavors where slug = 'orange') as orange,
  (select id from public.delivery_zones where fee_fcfa = 1000) as zone_a,
  (select id from public.delivery_zones where fee_fcfa is null) as zone_quote;
grant select on ids to service_role, anon, authenticated;

create or replace function pg_temp.order_payload(p_key uuid, p_items jsonb, p_fulfillment text default 'pickup', p_extra jsonb default '{}')
returns jsonb language sql as $$
  select jsonb_build_object(
    'idempotency_key', p_key,
    'cycle_id', (select cycle_id from ids),
    'fulfillment', p_fulfillment,
    'slot_id', case when p_fulfillment = 'pickup' then (select pickup_slot from ids) else (select delivery_slot from ids) end,
    'tracking_token_hash', 'hash-' || p_key,
    'customer', jsonb_build_object('name', 'Client test', 'phone', '+221770000000')
  ) || jsonb_build_object('items', p_items) || p_extra;
$$;

create or replace function pg_temp.cookie_stock()
returns int[] language sql as $$
  select array[total_units, reserved_units, sold_units] from public.inventory_units
  where cycle_id = (select cycle_id from ids) and product_id = (select cookies_id from ids);
$$;

set local role service_role;

-- ---------------------------------------------------------------------------
-- Commande et stock commun entre formats
-- ---------------------------------------------------------------------------
create temp table o1 as
select public.place_order(pg_temp.order_payload(
  'aaaaaaaa-0000-4000-8000-000000000001',
  jsonb_build_array(
    jsonb_build_object('variant_id', (select cookie_box6 from ids), 'quantity', 2),
    jsonb_build_object('variant_id', (select cookie_unit from ids), 'quantity', 3)
  )
)) as r;

select is((select (r ->> 'total_fcfa')::int from o1), 2 * 4500 + 3 * 800, 'prix recalculé côté serveur');
select is(pg_temp.cookie_stock(), array[60, 15, 0], 'box de 6 ×2 + unité ×3 = 15 unités réservées');
select is((select status::text from public.orders where id = (select (r ->> 'order_id')::uuid from o1)),
  'pending_payment', 'commande provisoire');
select ok((select pickup_code is not null from public.orders where id = (select (r ->> 'order_id')::uuid from o1)),
  'code de retrait généré');
select is((select count(*)::int from public.order_items where order_id = (select (r ->> 'order_id')::uuid from o1)), 2,
  'instantané des lignes');

select is((public.place_order(pg_temp.order_payload('aaaaaaaa-0000-4000-8000-000000000001', '[]')) ->> 'replayed'),
  'true', 'double envoi : même commande renvoyée');
select is(pg_temp.cookie_stock(), array[60, 15, 0], 'double envoi : aucune réservation supplémentaire');

-- ---------------------------------------------------------------------------
-- Refus
-- ---------------------------------------------------------------------------
select throws_ok(
  format('select public.place_order(%L::jsonb)', pg_temp.order_payload(gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('variant_id', (select verrine_box4 from ids), 'flavor_id', (select fraise from ids), 'quantity', 1)))),
  'P0001', 'INSUFFICIENT_STOCK', 'survente refusée (3 verrines, box de 4)');

select throws_ok(
  format('select public.place_order(%L::jsonb)', pg_temp.order_payload(gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('variant_id', (select verrine_unit from ids), 'quantity', 1)))),
  'P0001', 'FLAVOR_REQUIRED', 'parfum obligatoire');

select throws_ok(
  format('select public.place_order(%L::jsonb)', pg_temp.order_payload(gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('variant_id', (select verrine_unit from ids), 'flavor_id', (select orange from ids), 'quantity', 1)))),
  'P0001', 'FLAVOR_UNAVAILABLE', 'parfum absent de la fournée');

select throws_ok(
  format('select public.place_order(%L::jsonb)', pg_temp.order_payload(gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('variant_id', (select pommes_part from ids), 'quantity', 1)))),
  'P0001', 'NOT_IN_CYCLE', 'produit hors fournée');

select throws_ok(
  format('select public.place_order(%L::jsonb)', pg_temp.order_payload(gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('variant_id', (select cookie_unit from ids), 'quantity', 0)))),
  'P0001', 'QUANTITY_INVALID', 'quantité nulle refusée');

select throws_ok(
  format('select public.place_order(%L::jsonb)', pg_temp.order_payload(gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('variant_id', (select cookie_unit from ids), 'quantity', 1)), 'delivery')
  || jsonb_build_object('slot_id', (select pickup_slot from ids))),
  'P0001', 'SLOT_INVALID', 'créneau de retrait refusé pour une livraison');

-- ---------------------------------------------------------------------------
-- Livraison : frais de zone et zone sur devis
-- ---------------------------------------------------------------------------
create temp table o_delivery as
select public.place_order(pg_temp.order_payload(gen_random_uuid(),
  jsonb_build_array(jsonb_build_object('variant_id', (select cookie_unit from ids), 'quantity', 1)), 'delivery',
  jsonb_build_object('delivery', jsonb_build_object(
    'zone_id', (select zone_a from ids), 'address_line', 'Villa 12', 'recipient_name', 'Awa',
    'recipient_phone', '+221770000002', 'latitude', 14.7445, 'longitude', -17.4710)))) as r;
select is((select (r ->> 'total_fcfa')::int from o_delivery), 800 + 1000, 'frais de livraison de la zone ajoutés');

create temp table o_quote as
select public.place_order(pg_temp.order_payload(gen_random_uuid(),
  jsonb_build_array(jsonb_build_object('variant_id', (select cookie_unit from ids), 'quantity', 1)), 'delivery',
  jsonb_build_object('delivery', jsonb_build_object(
    'zone_id', (select zone_quote from ids), 'address_line', 'Rufisque', 'recipient_name', 'Awa',
    'recipient_phone', '+221770000002')))) as r;
select is((select r ->> 'status' from o_quote), 'awaiting_validation', 'zone sur devis : validation avant paiement');
select is(pg_temp.cookie_stock(), array[60, 16, 0], 'zone sur devis : aucun stock réservé');

-- ---------------------------------------------------------------------------
-- Paiement : confirmation, webhooks répétés
-- ---------------------------------------------------------------------------
create temp table p1 as
select (public.create_payment((select (r ->> 'order_id')::uuid from o1), 'test')).id as id;

select is(public.apply_payment_event('test', 'evt-1', 'paid', (select id from p1), 'paid', 11400, 'TX1', true, '{}'),
  'paid', 'paiement confirmé');
select is(pg_temp.cookie_stock(), array[60, 1, 15], 'réservé → vendu');
select is(public.apply_payment_event('test', 'evt-1', 'paid', (select id from p1), 'paid', 11400, 'TX1', true, '{}'),
  'duplicate', 'même webhook rejoué : ignoré');
select is(public.apply_payment_event('test', 'evt-2', 'paid', (select id from p1), 'paid', 11400, 'TX1', true, '{}'),
  'already_paid', 'second événement payé : aucune double déduction');
select is(pg_temp.cookie_stock(), array[60, 1, 15], 'stock inchangé après répétition');
select is(public.apply_payment_event('test', 'evt-3', 'failed', (select id from p1), 'failed', null, null, true, '{}'),
  'ignored_after_paid', 'échec tardif ignoré après paiement');
select is((select status::text || '/' || payment_status::text from public.orders where id = (select (r ->> 'order_id')::uuid from o1)),
  'confirmed/paid', 'commande confirmée');

select is(public.apply_payment_event('test', 'evt-inconnu', 'paid', gen_random_uuid(), 'paid', 100, null, true, '{}'),
  'unknown_payment', 'paiement inconnu : journalisé sans erreur');
select is(public.apply_payment_event('test', 'evt-bad', 'paid', (select id from p1), 'paid', 11400, null, false, '{}'),
  'rejected_signature', 'signature invalide rejetée');

-- ---------------------------------------------------------------------------
-- Échec : libération du stock
-- ---------------------------------------------------------------------------
create temp table p_del as
select (public.create_payment((select (r ->> 'order_id')::uuid from o_delivery), 'test')).id as id;
select is(public.apply_payment_event('test', 'evt-4', 'failed', (select id from p_del), 'failed', null, null, true, '{}'),
  'failed', 'paiement échoué');
select is(pg_temp.cookie_stock(), array[60, 0, 15], 'échec : réservation libérée');

-- ---------------------------------------------------------------------------
-- Expiration puis paiement tardif : le stock est repris s'il reste disponible
-- ---------------------------------------------------------------------------
create temp table o_late as
select public.place_order(pg_temp.order_payload(gen_random_uuid(),
  jsonb_build_array(jsonb_build_object('variant_id', (select cookie_unit from ids), 'quantity', 2)))) as r;
create temp table p_late as
select (public.create_payment((select (r ->> 'order_id')::uuid from o_late), 'test')).id as id;
update public.orders set reservation_expires_at = now() - interval '1 minute'
  where id = (select (r ->> 'order_id')::uuid from o_late);
select is(public.expire_stale_orders(), 1, 'commande provisoire expirée');
select is(pg_temp.cookie_stock(), array[60, 0, 15], 'expiration : stock libéré');
select is(public.apply_payment_event('test', 'evt-5', 'paid', (select id from p_late), 'paid', 1600, 'TX5', true, '{}'),
  'paid', 'paiement tardif accepté');
select is(pg_temp.cookie_stock(), array[60, 0, 17], 'paiement tardif : stock repris');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select is((select count(*)::int from public.orders), 0, 'anonyme : aucune commande visible');
select throws_ok('select public.place_order(''{}''::jsonb)', '42501', null, 'anonyme : création directe interdite');

select * from finish();
rollback;
