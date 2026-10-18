-- Fournées qui avancent seules : clôture à la date limite, production et livraison aux bons jours,
-- commandes payées en préparation ; rejouer ne fait rien de plus ; jamais accessible aux clientes.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

set local role anon;
select throws_ok($$ select public.auto_advance_cycles() $$, '42501', null, 'anon : automatisation interdite');
reset role;

set local role service_role;
create temp table c12 as select '00000000-0000-4000-8000-000000000012'::uuid as id;

-- Date limite passée : clôture automatique, une seule fois.
update public.production_cycles set closes_at = now() - interval '1 minute', production_dates = '{}',
  production_date = current_date + 3, fulfillment_date = current_date + 5
  where id = (select id from c12) and status = 'open';
select is((public.auto_advance_cycles() ->> 'closed')::int >= 1, true, 'date limite passée : précommandes clôturées');
select is((select status::text from public.production_cycles where id = (select id from c12)), 'closed', 'fournée clôturée sans clic');
select is((public.auto_advance_cycles() ->> 'closed')::int, 0, 'rejouer ne clôture rien de plus');

-- Jour de production puis jour de remise : production, commandes payées en préparation, livraison.
update public.production_cycles set production_dates = array[current_date], production_date = current_date, fulfillment_date = current_date where id = (select id from c12);
select lives_ok($$ select public.auto_advance_cycles() $$, 'jour de production et de remise');
select is((select status::text from public.production_cycles where id = (select id from c12)), 'delivering', 'fournée en livraison le jour de remise');
select is((select count(*)::int from public.orders where cycle_id = (select id from c12) and status = 'confirmed' and payment_status = 'paid'), 0,
  'aucune commande payée oubliée hors préparation');

select * from finish();
rollback;
