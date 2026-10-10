-- Documents légaux versionnés : lecture publique des seules versions publiées, publication
-- atomique, versions figées, preuve d'acceptation privée et liée à la version acceptée.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Lecture publique
set local role anon;
select is((select count(*)::int from public.legal_document_versions where status = 'published'), 7, 'les sept documents de lancement sont publiés');
select is((select count(*)::int from public.legal_documents), 7, 'la liste des documents est publique');
select throws_ok($$ select * from public.order_acceptances $$, '42501', null, 'les acceptations ne sont pas lisibles par le public');
select throws_ok($$ select * from public.order_refunds $$, '42501', null, 'les remboursements ne sont pas lisibles par le public');
select throws_ok($$ insert into public.legal_document_versions (document_slug, version, title, content) values ('cookies', '9.0', 'Pirate', 'x') $$,
  '42501', null, 'le public ne peut pas écrire de version');
select throws_ok($$ select public.admin_publish_legal_version(gen_random_uuid(), null) $$, '42501', null, 'le public ne peut pas publier');
select is((select count(*)::int from public.site_settings where key = 'legal.identity'), 0, 'l''identité légale reste privée');
reset role;

-- Une commande accepte la version 1.0 des conditions générales
set local role service_role;
create temp table v1 as select
  (select id from public.legal_document_versions where document_slug = 'conditions-generales' and status = 'published') as terms,
  (select id from public.legal_document_versions where document_slug = 'annulation-remboursement' and status = 'published') as cancel;
create temp table o as
select (public.place_order(jsonb_build_object(
  'idempotency_key', gen_random_uuid(), 'cycle_id', '00000000-0000-4000-8000-000000000012',
  'fulfillment', 'pickup', 'slot_id', (select id from public.delivery_slots where kind = 'pickup' order by starts_at limit 1),
  'tracking_token_hash', 'h-legal-1',
  'customer', jsonb_build_object('name', 'L', 'phone', '+221770002222'),
  'items', jsonb_build_array(jsonb_build_object('variant_id',
     (select v.id from public.product_variants v join public.products p on p.id = v.product_id where p.slug = 'muffins-pepites' and v.label = 'Box de 6'),
     'quantity', 1))
)) ->> 'order_id')::uuid as id;
insert into public.order_acceptances (order_id, terms_version_id, cancellation_version_id, terms_hash, cancellation_hash)
select (select id from o), terms, cancel,
  (select content_hash from public.legal_document_versions where id = terms),
  (select content_hash from public.legal_document_versions where id = cancel)
from v1;

-- Brouillon puis publication de la version 1.1
insert into public.legal_document_versions (document_slug, version, title, content)
values ('conditions-generales', '1.1', 'Conditions générales', 'Nouveau texte');
select is((select content_hash from public.legal_document_versions where document_slug = 'conditions-generales' and version = '1.1'),
  encode(sha256(convert_to('Nouveau texte', 'UTF8')), 'hex'), 'l''empreinte du texte est calculée automatiquement');

set local role anon;
select is((select count(*)::int from public.legal_document_versions where document_slug = 'conditions-generales' and version = '1.1'), 0, 'un brouillon n''est jamais visible du public');
reset role;
set local role service_role;

select lives_ok($$ select public.admin_publish_legal_version(
  (select id from public.legal_document_versions where document_slug = 'conditions-generales' and version = '1.1'), null) $$,
  'publication de la version 1.1');
select is((select version from public.legal_document_versions where document_slug = 'conditions-generales' and status = 'published'), '1.1',
  'une seule version publiée : la nouvelle');
select is((select status::text from public.legal_document_versions where id = (select terms from v1)), 'archived', 'l''ancienne version est archivée');
select is((select terms_version_id from public.order_acceptances where order_id = (select id from o)), (select terms from v1),
  'la commande reste liée à la version qu''elle a acceptée');
select throws_ok($$ update public.legal_document_versions set content = 'modifié' where id = (select terms from v1) $$,
  'P0001', 'LEGAL_VERSION_FROZEN', 'une version publiée ou archivée ne se modifie plus');

select * from finish();
rollback;
