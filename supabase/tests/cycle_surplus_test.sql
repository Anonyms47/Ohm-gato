-- Fournées : précommande avant la date limite, priorité aux commandes confirmées,
-- publication manuelle du surplus, commandes tardives limitées au surplus réel.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

-- Une seule fournée vend à la fois : la fournée de démonstration est mise de côté.
update public.production_cycles set status = 'done' where status in ('open', 'surplus');

-- Fournée de test : 10 cookies au maximum en précommande, un créneau de retrait.
insert into public.production_cycles (id, number, title, opens_at, closes_at, production_date, fulfillment_date, status, production_days)
values ('00000000-0000-4000-8000-000000000900', 900, 'Fournée test surplus', now() - interval '2 hours', now() + interval '1 hour',
        current_date, current_date + 5, 'open', 3);
insert into public.cycle_products (cycle_id, product_id) select '00000000-0000-4000-8000-000000000900', id from public.products where slug = 'cookies';
insert into public.inventory_units (cycle_id, product_id, total_units)
  select '00000000-0000-4000-8000-000000000900', id, 10 from public.products where slug = 'cookies';
insert into public.delivery_slots (id, cycle_id, kind, starts_at, ends_at, phase)
values ('00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000900', 'pickup', now() + interval '5 days', now() + interval '5 days 2 hours', 'preorder');

create temp table t as select
  (select id from public.products where slug = 'cookies') as cookies,
  (select v.id from public.product_variants v join public.products p on p.id = v.product_id where p.slug = 'cookies' and v.label = 'Unité') as unit;
grant select on t to service_role;

create function pg_temp.order_payload(p_qty int, p_slot uuid, p_hash text) returns jsonb language sql as $$
  select jsonb_build_object(
    'idempotency_key', gen_random_uuid(), 'cycle_id', '00000000-0000-4000-8000-000000000900',
    'fulfillment', 'pickup', 'slot_id', p_slot, 'tracking_token_hash', p_hash,
    'customer', jsonb_build_object('name', 'Test', 'phone', '+221770009' || lpad((random() * 999)::int::text, 3, '0')),
    'items', jsonb_build_array(jsonb_build_object('variant_id', (select unit from t), 'quantity', p_qty)));
$$;
create function pg_temp.free_units() returns int language sql as $$
  select total_units - reserved_units - sold_units from public.inventory_units
  where cycle_id = '00000000-0000-4000-8000-000000000900' and product_id = (select cookies from t);
$$;

set local role service_role;

-- 1. Précommande ouverte
create temp table paid_order as select (public.place_order(pg_temp.order_payload(4, '00000000-0000-4000-8000-000000000901', 'h-s1')) ->> 'order_id')::uuid as id;
select is((select order_kind from public.orders where id = (select id from paid_order)), 'preorder', 'précommande enregistrée comme telle');
create temp table pay1 as select (public.create_payment((select id from paid_order), 'wave_link')).id as id;
select lives_ok($$ select public.confirm_order_awaiting_wave((select id from paid_order), (select id from pay1)) $$, 'précommande confirmée, paiement Wave à vérifier');
select is((select payment_status::text from public.orders where id = (select id from paid_order)), 'pending', 'paiement à vérifier : pas encore payée');
select lives_ok($$ select public.admin_record_payment((select id from paid_order), 'W-1', null) $$, 'Alima enregistre le paiement');
select is((select payment_status::text from public.orders where id = (select id from paid_order)), 'paid', 'précommande payée et confirmée');

-- 2. Une précommande en attente de paiement (réservée)
create temp table pending_order as select (public.place_order(pg_temp.order_payload(2, '00000000-0000-4000-8000-000000000901', 'h-s2')) ->> 'order_id')::uuid as id;
select is(pg_temp.free_units(), 4, '10 - 4 vendus - 2 réservés = 4 places de précommande');

-- 3. Clôture automatique à la date limite (vérifiée côté serveur)
reset role;
update public.production_cycles set closes_at = now() - interval '1 minute' where id = '00000000-0000-4000-8000-000000000900';
set local role service_role;
select throws_ok($$ select public.place_order(pg_temp.order_payload(1, '00000000-0000-4000-8000-000000000901', 'h-s3')) $$,
  'P0001', 'PREORDER_CLOSED', 'précommande refusée après la date limite');
select lives_ok($$ select public.admin_set_cycle_status('00000000-0000-4000-8000-000000000900', 'closed', null) $$, 'précommandes clôturées');
select isnt((select closed_at from public.production_cycles where id = '00000000-0000-4000-8000-000000000900'), null, 'date de clôture enregistrée');
select throws_ok($$ select public.admin_set_cycle_status('00000000-0000-4000-8000-000000000900', 'surplus', null) $$,
  'P0001', 'TRANSITION_INVALID', 'le surplus ne s''ouvre jamais par un simple changement de statut');
select throws_ok($$ select public.admin_publish_surplus('00000000-0000-4000-8000-000000000900', '[]', now() + interval '2 days', false, null) $$,
  'P0001', 'TRANSITION_INVALID', 'pas de surplus avant la production');

-- 4. Production réelle
select lives_ok($$ select public.admin_set_cycle_status('00000000-0000-4000-8000-000000000900', 'preparing', null) $$, 'production en cours');
insert into public.delivery_slots (id, cycle_id, kind, starts_at, ends_at, phase)
values ('00000000-0000-4000-8000-000000000902', '00000000-0000-4000-8000-000000000900', 'pickup', now() + interval '6 days', now() + interval '6 days 2 hours', 'surplus');
select throws_ok($$ select public.admin_publish_surplus('00000000-0000-4000-8000-000000000900',
  jsonb_build_array(jsonb_build_object('product_id', (select cookies from t), 'units', 1)), now() + interval '7 days', false, null) $$,
  'P0001', 'PRODUCTION_MISSING', 'la production réelle doit être saisie avant toute publication');
select lives_ok($$ select public.admin_record_production('00000000-0000-4000-8000-000000000900', (select cookies from t), 10, 1, 'un cookie cassé', null) $$,
  'production saisie : 10 produits, 1 perdu');
select is((select status::text from public.production_cycles where id = '00000000-0000-4000-8000-000000000900'), 'preparing',
  'la saisie de production ne publie rien automatiquement');

-- 5. Publication manuelle, limitée au surplus réel (9 commercialisables - 6 engagés = 3)
select throws_ok($$ select public.admin_publish_surplus('00000000-0000-4000-8000-000000000900',
  jsonb_build_array(jsonb_build_object('product_id', (select cookies from t), 'units', 4)), now() + interval '7 days', false, null) $$,
  'P0001', 'SURPLUS_EXCEEDS', 'impossible de publier plus que le surplus réel');
select lives_ok($$ select public.admin_publish_surplus('00000000-0000-4000-8000-000000000900',
  jsonb_build_array(jsonb_build_object('product_id', (select cookies from t), 'units', 2)), now() + interval '7 days', false, null) $$,
  'Alima publie 2 cookies de surplus');
select is(pg_temp.free_units(), 2, 'seul le surplus publié est disponible, pas la capacité de précommande');

-- 6. Commandes tardives : surplus seulement, concurrence sur la dernière unité
select throws_ok($$ select public.place_order(pg_temp.order_payload(1, '00000000-0000-4000-8000-000000000901', 'h-s4')) $$,
  'P0001', 'SLOT_INVALID', 'une commande tardive ne peut pas prendre un créneau de précommande');
create temp table late_order as select (public.place_order(pg_temp.order_payload(2, '00000000-0000-4000-8000-000000000902', 'h-s5')) ->> 'order_id')::uuid as id;
select is((select order_kind from public.orders where id = (select id from late_order)), 'surplus', 'commande identifiée comme commande de surplus');
select throws_ok($$ select public.place_order(pg_temp.order_payload(1, '00000000-0000-4000-8000-000000000902', 'h-s6')) $$,
  'P0001', 'INSUFFICIENT_STOCK', 'la dernière unité ne peut pas être vendue deux fois');

-- 7. Précommande annulée pendant le surplus : stock interne, jamais republié automatiquement
select lives_ok($$ select public.admin_set_order_status((select id from paid_order), 'cancelled', 'test', null) $$, 'précommande payée annulée');
select is(pg_temp.free_units(), 0, 'les unités annulées ne sont pas remises en vente automatiquement');

-- Commande tardive annulée : ses unités reviennent dans le surplus publié.
select lives_ok($$ select public.admin_set_order_status((select id from late_order), 'cancelled', 'test', null) $$, 'commande tardive annulée');
select is(pg_temp.free_units(), 2, 'le surplus d''une commande tardive annulée redevient disponible');

-- Fin de la fournée : plus rien n'est en vente.
select lives_ok($$ select public.admin_set_cycle_status('00000000-0000-4000-8000-000000000900', 'done', null) $$, 'Alima termine la fournée');
select is(pg_temp.free_units(), 0, 'surplus retiré de la vente à la fin de la fournée');

-- 8. Aucune quantité négative possible
select throws_ok($$ update public.inventory_units set total_units = 0
  where cycle_id = '00000000-0000-4000-8000-000000000900' and product_id = (select cookies from t) $$,
  '23514', null, 'le stock ne peut jamais descendre sous ce qui est réservé ou vendu');

-- Les clients ne voient ni les notes ni les quantités de production, et ne publient rien.
reset role;
set local role anon;
select throws_ok($$ select production_note, produced_units from public.inventory_units $$, '42501', null, 'production et notes internes privées');
select throws_ok($$ select public.admin_publish_surplus('00000000-0000-4000-8000-000000000900', '[]', now() + interval '1 day', false, null) $$,
  '42501', null, 'un client ne peut pas publier de surplus');

select * from finish();
rollback;
