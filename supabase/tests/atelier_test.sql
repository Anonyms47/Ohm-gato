-- Atelier : accès réservé au serveur, e-mails idempotents, notifications sans doublon,
-- fournée créée depuis la précédente.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- Aucun accès client aux tables internes de l'atelier.
set local role anon;
select throws_ok($$ select * from public.order_notes $$, '42501', null, 'anon : notes internes inaccessibles');
select throws_ok($$ select * from public.admin_notifications $$, '42501', null, 'anon : notifications inaccessibles');
select throws_ok($$ select * from public.email_outbox $$, '42501', null, 'anon : file d''e-mails inaccessible');
select throws_ok($$ select * from public.production_sheet_prints $$, '42501', null, 'anon : impressions inaccessibles');
reset role;
set local role authenticated;
select throws_ok($$ select * from public.order_notes $$, '42501', null, 'cliente connectée : notes internes inaccessibles');
select throws_ok($$ select * from public.email_outbox $$, '42501', null, 'cliente connectée : e-mails inaccessibles');
select throws_ok($$ select public.admin_duplicate_cycle('00000000-0000-4000-8000-000000000012', 999, now(), now() + interval '1 day', current_date, current_date + 2, null) $$,
  '42501', null, 'cliente connectée : duplication de fournée interdite');
reset role;

create temp table w as select
  (select id from public.delivery_slots where kind = 'pickup' and cycle_id = '00000000-0000-4000-8000-000000000012' order by starts_at limit 1) as slot,
  (select v.id from public.product_variants v join public.products p on p.id = v.product_id
     where p.slug = 'muffins-pepites' and v.label = 'Box de 6') as box6;
grant select on w to service_role;

set local role service_role;
create temp table o as
select (public.place_order(jsonb_build_object(
  'idempotency_key', gen_random_uuid(), 'cycle_id', '00000000-0000-4000-8000-000000000012',
  'fulfillment', 'pickup', 'slot_id', (select slot from w), 'tracking_token_hash', 'h-atelier-1',
  'customer', jsonb_build_object('name', 'Awa', 'phone', '+221770002222', 'email', 'awa@example.com'),
  'items', jsonb_build_array(jsonb_build_object('variant_id', (select box6 from w), 'quantity', 1))
)) ->> 'order_id')::uuid as id;
create temp table p as select (public.create_payment((select id from o), 'wave_link')).id as id;

-- Commande sans e-mail : aucun e-mail mis en file.
create temp table o2 as
select (public.place_order(jsonb_build_object(
  'idempotency_key', gen_random_uuid(), 'cycle_id', '00000000-0000-4000-8000-000000000012',
  'fulfillment', 'pickup', 'slot_id', (select slot from w), 'tracking_token_hash', 'h-atelier-2',
  'customer', jsonb_build_object('name', 'Fatou', 'phone', '+221770003333'),
  'items', jsonb_build_array(jsonb_build_object('variant_id', (select box6 from w), 'quantity', 1))
)) ->> 'order_id')::uuid as id;
create temp table p2 as select (public.create_payment((select id from o2), 'wave_link')).id as id;
select public.confirm_order_awaiting_wave((select id from o2), (select id from p2));
select is((select count(*)::int from public.email_outbox where order_id = (select id from o2)), 0, 'sans adresse e-mail : rien en file');

-- Commande enregistrée (choix de Wave) : un e-mail, même si l'action est rejouée.
select public.confirm_order_awaiting_wave((select id from o), (select id from p));
select public.confirm_order_awaiting_wave((select id from o), (select id from p));
select is((select count(*)::int from public.email_outbox where order_id = (select id from o) and template = 'order_registered'), 1,
  'commande enregistrée : un seul e-mail malgré la double confirmation');

-- Paiement vérifié deux fois : un seul e-mail de confirmation.
select public.admin_record_payment((select id from o), 'TX-1', null);
select public.admin_record_payment((select id from o), 'TX-1', null);
select is((select count(*)::int from public.email_outbox where order_id = (select id from o) and template = 'payment_confirmed'), 1,
  'paiement confirmé : un seul e-mail même enregistré deux fois');

-- Étapes : préparation puis prête (retrait) : un e-mail chacune.
select public.admin_set_order_status((select id from o), 'preparing', '', null);
select public.admin_set_order_status((select id from o), 'ready', '', null);
select is((select count(*)::int from public.email_outbox where order_id = (select id from o) and template = 'order_preparing'), 1, 'e-mail « en préparation »');
select is((select count(*)::int from public.email_outbox where order_id = (select id from o) and template = 'pickup_ready'), 1, 'e-mail « prête au retrait »');
-- Retour en arrière impossible ici ; une même étape ne peut donc pas renvoyer d'e-mail.
select is((select count(*)::int from public.email_outbox where order_id = (select id from o)), 4, 'quatre événements, quatre e-mails au total');

-- Remboursement : un e-mail par remboursement enregistré.
insert into public.order_refunds (order_id, amount_fcfa, reason, method, refunded_at) values ((select id from o), 1000, 'Geste commercial', 'Wave', current_date);
select is((select count(*)::int from public.email_outbox where order_id = (select id from o) and template = 'refund_recorded'), 1, 'remboursement : un e-mail');
select is((select status from public.email_outbox where order_id = (select id from o) limit 1), 'pending', 'les e-mails attendent l''envoi par le serveur');

-- Commande remise : un e-mail « retirée », même si l'étape est rejouée.
select public.admin_set_order_status((select id from o), 'picked_up', '', null);
select is((select count(*)::int from public.email_outbox where order_id = (select id from o) and template = 'order_delivered'), 1, 'commande remise : un e-mail');

-- Notifications : la clé de déduplication interdit les doublons.
insert into public.admin_notifications (dedupe_key, kind, priority, title, href) values ('task:wave-to-verify', 'task', 'today', '1 paiement', '/admin/paiements');
select throws_ok($$ insert into public.admin_notifications (dedupe_key, kind, priority, title, href) values ('task:wave-to-verify', 'task', 'today', 'x', '/admin') $$,
  '23505', null, 'une seule notification par sujet');
select throws_ok($$ insert into public.admin_notifications (dedupe_key, kind, priority, title, href) values ('x', 'task', 'today', 'x', 'https://exemple.com') $$,
  '23514', null, 'une notification ne mène qu''à l''atelier');

-- Nouvelle fournée depuis la n°12 : brouillon, produits et créneaux de précommande repris et décalés.
create temp table d as select public.admin_duplicate_cycle('00000000-0000-4000-8000-000000000012', 4242,
  now() + interval '7 days', now() + interval '9 days',
  (select fulfillment_date + 6 from public.production_cycles where id = '00000000-0000-4000-8000-000000000012'),
  (select fulfillment_date + 7 from public.production_cycles where id = '00000000-0000-4000-8000-000000000012'), null) as id;
select is((select status::text from public.production_cycles where id = (select id from d)), 'draft', 'la nouvelle fournée reste un brouillon');
select is((select count(*)::int from public.cycle_products where cycle_id = (select id from d)),
  (select count(*)::int from public.cycle_products cp join public.products pr on pr.id = cp.product_id and pr.is_active where cp.cycle_id = '00000000-0000-4000-8000-000000000012'),
  'produits actifs repris');
select is((select min(starts_at) from public.delivery_slots where cycle_id = (select id from d)),
  (select min(starts_at) + interval '7 days' from public.delivery_slots where cycle_id = '00000000-0000-4000-8000-000000000012' and phase = 'preorder' and is_active),
  'créneaux décalés de 7 jours');

select * from finish();
rollback;
