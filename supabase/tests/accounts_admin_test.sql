-- Tests : RLS avec deux comptes, sur-mesure, administration.
-- Lancer : npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

-- ---------------------------------------------------------------------------
-- Deux clients (A, B) et une administratrice
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, phone, created_at, updated_at)
values
  ('aaaaaaaa-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '221771110001', now(), now()),
  ('bbbbbbbb-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '221771110002', now(), now()),
  ('cccccccc-0000-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '221771110003', now(), now());
insert into public.staff_roles (user_id, role) values ('cccccccc-0000-4000-8000-00000000000c', 'admin');

select is((select count(*)::int from public.profiles where id in ('aaaaaaaa-0000-4000-8000-00000000000a', 'bbbbbbbb-0000-4000-8000-00000000000b')), 2,
  'un profil est créé pour chaque compte');

create temp table t as select
  (select id from public.delivery_slots where kind = 'pickup' order by starts_at limit 1) as slot,
  '00000000-0000-4000-8000-000000000012'::uuid as cycle;
grant select on t to authenticated, service_role;

-- Une commande par client, une adresse par client, une demande sur-mesure par client.
insert into public.orders (reference, tracking_token_hash, idempotency_key, user_id, cycle_id, status, payment_status, fulfillment, slot_id,
  customer_name, customer_phone, subtotal_fcfa, total_fcfa)
select 'TEST-A', 'h-a', gen_random_uuid(), 'aaaaaaaa-0000-4000-8000-00000000000a'::uuid, cycle, 'confirmed'::public.order_status, 'paid'::public.payment_status, 'pickup'::public.fulfillment_method, slot, 'A', '+221771110001', 800, 800 from t
union all
select 'TEST-B', 'h-b', gen_random_uuid(), 'bbbbbbbb-0000-4000-8000-00000000000b', cycle, 'confirmed', 'paid', 'pickup', slot, 'B', '+221771110002', 800, 800 from t;
insert into public.payments (order_id, provider, amount_fcfa, status)
select id, 'test', 800, 'paid' from public.orders where reference in ('TEST-A', 'TEST-B');
insert into public.addresses (user_id, recipient_name, recipient_phone, address_line)
values ('aaaaaaaa-0000-4000-8000-00000000000a', 'A', '+221771110001', 'Rue A'),
       ('bbbbbbbb-0000-4000-8000-00000000000b', 'B', '+221771110002', 'Rue B');

set local role service_role;
select lives_ok($$
  select public.create_custom_request(jsonb_build_object(
    'idempotency_key', '11111111-0000-4000-8000-000000000001', 'tracking_token_hash', 'sm-a',
    'user_id', 'aaaaaaaa-0000-4000-8000-00000000000a', 'occasion', 'Anniversaire',
    'event_at', (now() + interval '5 days')::text, 'guests', 20, 'fulfillment', 'pickup',
    'customer', jsonb_build_object('name', 'A', 'phone', '+221771110001'),
    'items', jsonb_build_array(jsonb_build_object('kind', 'verrines', 'quantity', 20, 'product_slug', 'verrines-fruitees'))))
$$, 'une demande sur-mesure est créée');
select is((public.create_custom_request(jsonb_build_object(
    'idempotency_key', '11111111-0000-4000-8000-000000000001', 'tracking_token_hash', 'sm-a',
    'occasion', 'x', 'event_at', (now() + interval '5 days')::text, 'fulfillment', 'pickup',
    'customer', jsonb_build_object('name', 'A', 'phone', '+221771110001'),
    'items', jsonb_build_array(jsonb_build_object('kind', 'verrines', 'quantity', 1)))) ->> 'replayed'), 'true',
  'un double envoi de la demande ne la duplique pas');
select throws_ok($$
  select public.create_custom_request(jsonb_build_object(
    'idempotency_key', gen_random_uuid(), 'tracking_token_hash', 'sm-x', 'occasion', 'x',
    'event_at', (now() + interval '1 hour')::text, 'fulfillment', 'pickup',
    'customer', jsonb_build_object('name', 'A', 'phone', '+221771110001'),
    'items', jsonb_build_array(jsonb_build_object('kind', 'choux', 'quantity', 1))))
$$, 'P0001', 'EVENT_TOO_SOON', 'une demande trop proche de la date est refusée');
select lives_ok($$
  select public.create_custom_request(jsonb_build_object(
    'idempotency_key', gen_random_uuid(), 'tracking_token_hash', 'sm-b',
    'user_id', 'bbbbbbbb-0000-4000-8000-00000000000b', 'occasion', 'Mariage',
    'event_at', (now() + interval '9 days')::text, 'guests', 80, 'fulfillment', 'pickup',
    'customer', jsonb_build_object('name', 'B', 'phone', '+221771110002'),
    'items', jsonb_build_array(jsonb_build_object('kind', 'choux', 'quantity', 80))))
$$, 'la demande du client B est créée');
reset role;
insert into public.custom_request_internal_notes (request_id, body)
select id, 'note interne' from public.custom_requests where tracking_token_hash = 'sm-a';

-- ---------------------------------------------------------------------------
-- RLS : client A connecté
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-00000000000a", "role": "authenticated"}';

select is((select count(*)::int from public.orders), 1, 'A ne voit que sa commande');
select is((select reference from public.orders), 'TEST-A', 'la commande visible est celle de A');
select is((select count(*)::int from public.payments), 1, 'A ne voit que ses paiements');
select is((select count(*)::int from public.addresses), 1, 'A ne voit que son adresse');
select is((select count(*)::int from public.profiles), 1, 'A ne voit que son profil');
select is((select count(*)::int from public.custom_requests), 1, 'A ne voit que sa demande sur-mesure');
select is((select count(*)::int from public.custom_request_internal_notes), 0, 'les notes internes restent invisibles');
select is((select count(*)::int from public.customer_notes), 0, 'les notes clients restent invisibles');
select is((select count(*)::int from public.audit_logs), 0, 'le journal d''audit reste invisible');
select throws_ok($$ insert into public.addresses (user_id, recipient_name, recipient_phone, address_line)
  values ('bbbbbbbb-0000-4000-8000-00000000000b', 'x', 'x', 'x') $$, '42501', null,
  'A ne peut pas créer une adresse pour B');
update public.addresses set address_line = 'piraté' where user_id = 'bbbbbbbb-0000-4000-8000-00000000000b';
select throws_ok($$ insert into public.staff_roles (user_id, role) values ('aaaaaaaa-0000-4000-8000-00000000000a', 'admin') $$,
  '42501', null, 'A ne peut pas se donner le rôle admin');
update public.orders set total_fcfa = 1 where reference = 'TEST-A';
select is((select total_fcfa from public.orders where reference = 'TEST-A'), 800, 'A ne peut pas modifier le montant de sa commande');
select throws_ok($$ select public.admin_set_stock((select cycle from t), (select id from public.products where slug = 'cookies'), 1, 'x', null) $$,
  '42501', null, 'A ne peut pas appeler les fonctions d''administration');
select lives_ok($$ select * from public.my_sessions() $$, 'A peut lister ses sessions');

-- ---------------------------------------------------------------------------
-- RLS : client B connecté
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-4000-8000-00000000000b", "role": "authenticated"}';
select is((select reference from public.orders), 'TEST-B', 'B ne voit que sa commande');
select is((select address_line from public.addresses), 'Rue B', 'l''adresse de B n''a pas été modifiée par A');
select is((select occasion from public.custom_requests), 'Mariage', 'B ne voit que sa demande');

-- Administratrice : voit tout via la RLS.
set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-00000000000c", "role": "authenticated"}';
select cmp_ok((select count(*)::int from public.orders), '>=', 2, 'l''administratrice voit toutes les commandes');
reset role;

-- ---------------------------------------------------------------------------
-- Administration et sur-mesure (serveur)
-- ---------------------------------------------------------------------------
set local role service_role;
select throws_ok($$ select public.admin_set_cycle_status('00000000-0000-4000-8000-000000000012', 'done', null) $$,
  'P0001', 'TRANSITION_INVALID', 'une fournée ouverte ne passe pas directement à « terminée »');

update public.inventory_units set sold_units = 5
  where cycle_id = '00000000-0000-4000-8000-000000000012' and product_id = (select id from public.products where slug = 'cookies');
select throws_ok($$ select public.admin_set_stock('00000000-0000-4000-8000-000000000012', (select id from public.products where slug = 'cookies'), 3, 'erreur', null) $$,
  'P0001', 'STOCK_BELOW_COMMITTED', 'le stock ne descend jamais sous les unités vendues');
select lives_ok($$ select public.admin_set_stock('00000000-0000-4000-8000-000000000012', (select id from public.products where slug = 'cookies'), 70, 'fournée agrandie', null) $$,
  'ajustement du stock');
select is((select units from public.inventory_movements where reason = 'fournée agrandie'), 10, 'l''ajustement est inscrit dans l''historique (+10)');

-- Proposition puis acceptation : une commande à payer est créée, sans stock.
select lives_ok($$ select public.add_custom_proposal((select id from public.custom_requests where tracking_token_hash = 'sm-a'),
  '20 verrines', '[{"label": "Verrines", "quantity": 20, "unit_price_fcfa": 1500}]', 30000, null, null) $$, 'proposition ajoutée');
select is((select (public.respond_custom_proposal((select id from public.custom_proposals limit 1), true, 'h-sm-order', gen_random_uuid()) ->> 'replayed')),
  'false', 'le client accepte la proposition');
select is((select total_fcfa from public.orders where tracking_token_hash = 'h-sm-order'), 30000, 'la commande reprend le prix fixé par OHMEGATO');

-- Paiement confirmé : la demande passe « payée », aucun stock n'est touché.
select lives_ok($$
  with p as (select * from public.create_payment((select id from public.orders where tracking_token_hash = 'h-sm-order'), 'test'))
  select public.apply_payment_event('test', 'evt-sm-1', 'paid', (select id from p), 'paid', 30000, 'ref', true, '{}')
$$, 'paiement de la commande sur-mesure');
select is((select status::text from public.custom_requests where tracking_token_hash = 'sm-a'), 'paid', 'la demande sur-mesure est marquée payée');

select * from finish();
rollback;
