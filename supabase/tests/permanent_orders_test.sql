-- Commandes permanentes : aucune heure limite, date de remise à venir obligatoire, dates figées à la commande,
-- désigner une nouvelle fournée remplace l'ancienne pour les NOUVELLES commandes seulement (aucun report).
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

create temp table w as select
  (select id from public.production_cycles where status = 'open' order by number limit 1) as old_cycle,
  (select v.id from public.product_variants v join public.products p on p.id = v.product_id where p.slug = 'cookies' and v.label = 'Unité') as unit;
grant select on w to service_role;
create temp table s as select id, starts_at, ends_at from public.delivery_slots
  where cycle_id = (select old_cycle from w) and phase = 'preorder' and is_active and kind in ('pickup', 'both') order by starts_at limit 1;
grant select on s to service_role;

create function pg_temp.payload(p_cycle uuid, p_slot uuid, p_hash text) returns jsonb language sql as $$
  select jsonb_build_object(
    'idempotency_key', gen_random_uuid(), 'cycle_id', p_cycle, 'fulfillment', 'pickup', 'slot_id', p_slot, 'tracking_token_hash', p_hash,
    'customer', jsonb_build_object('name', 'Test', 'phone', '+221770008' || lpad((random() * 999)::int::text, 3, '0')),
    'items', jsonb_build_array(jsonb_build_object('variant_id', (select unit from w), 'quantity', 1)));
$$;
grant execute on function pg_temp.payload(uuid, uuid, text) to service_role;

-- 1. Une ancienne date limite dépassée ne ferme plus rien.
update public.production_cycles set closes_at = now() - interval '3 days' where id = (select old_cycle from w);
set local role service_role;
create temp table o1 as select (public.place_order(pg_temp.payload((select old_cycle from w), (select id from s), 'h-perm-1')) ->> 'order_id')::uuid as id;
select isnt((select id from o1), null, 'ancienne date limite dépassée : la commande est enregistrée');
reset role;

-- 2. Dates et créneau figés à la création.
select is((select fulfillment_date_snapshot from public.orders where id = (select id from o1)),
  (select fulfillment_date from public.production_cycles where id = (select old_cycle from w)), 'date de remise figée sur la commande');
select is((select slot_starts_at_snapshot from public.orders where id = (select id from o1)), (select starts_at from s), 'créneau figé sur la commande');

-- 3. Modifier le calendrier de la fournée ne change pas la commande existante.
create temp table before_dates as select fulfillment_date as d from public.production_cycles where id = (select old_cycle from w);
update public.production_cycles set fulfillment_date = fulfillment_date + 3 where id = (select old_cycle from w);
update public.delivery_slots set starts_at = starts_at + interval '3 days', ends_at = ends_at + interval '3 days' where id = (select id from s);
select is((select fulfillment_date_snapshot from public.orders where id = (select id from o1)), (select d from before_dates), 'calendrier modifié : la date de la commande ne bouge pas');
select is((select slot_starts_at_snapshot from public.orders where id = (select id from o1)), (select starts_at from s), 'calendrier modifié : le créneau de la commande ne bouge pas');
update public.orders set fulfillment_date_snapshot = current_date - 100 where id = (select id from o1);
select is((select fulfillment_date_snapshot from public.orders where id = (select id from o1)), (select d from before_dates), 'les dates figées ne se modifient pas par une simple mise à jour');

-- 4. Nouvelle fournée désignée par Alima : brouillon, puis ouverture.
insert into public.production_cycles (id, number, title, opens_at, production_date, fulfillment_date, status)
values ('00000000-0000-4000-8000-000000000950', 950, 'Fournée test suivante', now(), current_date + 4, current_date + 9, 'draft');
insert into public.cycle_products (cycle_id, product_id) select '00000000-0000-4000-8000-000000000950', id from public.products where slug = 'cookies';
insert into public.delivery_slots (id, cycle_id, kind, starts_at, ends_at, phase)
values ('00000000-0000-4000-8000-000000000951', '00000000-0000-4000-8000-000000000950', 'pickup', now() + interval '9 days', now() + interval '9 days 2 hours', 'preorder');
set local role service_role;
select lives_ok($$ select public.admin_set_cycle_status('00000000-0000-4000-8000-000000000950', 'open', null) $$, 'la nouvelle fournée s''ouvre sans fermer à la main l''ancienne');
reset role;
select is((select status::text from public.production_cycles where id = (select old_cycle from w)), 'closed', 'l''ancienne fournée ne reçoit plus de nouvelles commandes');
select is((select cycle_id from public.orders where id = (select id from o1)), (select old_cycle from w), 'la commande existante reste rattachée à son ancienne fournée (aucun report)');

-- 5. Les nouvelles commandes vont à la nouvelle fournée ; l'ancienne refuse sans rien enregistrer.
set local role service_role;
create temp table o2 as select (public.place_order(pg_temp.payload('00000000-0000-4000-8000-000000000950', '00000000-0000-4000-8000-000000000951', 'h-perm-2')) ->> 'order_id')::uuid as id;
select is((select cycle_id from public.orders where id = (select id from o2)), '00000000-0000-4000-8000-000000000950'::uuid, 'nouvelle commande rattachée à la nouvelle fournée');
select throws_ok($$ select public.place_order(pg_temp.payload((select old_cycle from w), (select id from s), 'h-perm-3')) $$, 'P0001', 'PREORDER_CLOSED', 'ancienne fournée : nouvelle commande refusée, rien d''enregistré');
reset role;

-- 6. Sans date de remise à venir : ni ouverture ni commande.
update public.production_cycles set production_date = current_date - 5, fulfillment_date = current_date - 1 where id = '00000000-0000-4000-8000-000000000950';
set local role service_role;
select throws_ok($$ select public.place_order(pg_temp.payload('00000000-0000-4000-8000-000000000950', '00000000-0000-4000-8000-000000000951', 'h-perm-4')) $$, 'P0001', 'CYCLE_DATES_PAST', 'date de remise passée : aucune commande ni paiement');
select is((select status::text from public.production_cycles where id = '00000000-0000-4000-8000-000000000950'), 'open', 'aucune fermeture automatique quand la date est dépassée');
reset role;

select * from finish();
rollback;
