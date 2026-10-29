-- Livraison par zones : quartier → zone → tarif, instantané figé dans la commande, frais jamais dans le total.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

create temp table z as select
  (select id from public.delivery_slots where kind in ('delivery', 'both') order by starts_at limit 1) as dslot,
  (select id from public.delivery_slots where kind = 'pickup' order by starts_at limit 1) as pslot,
  (select v.id from public.product_variants v join public.products p on p.id = v.product_id
     where p.slug = 'muffins-pepites' and v.label = 'Box de 6') as box6;
grant select on z to service_role, anon;

set local role service_role;
insert into public.delivery_zones (name, districts, fee_fcfa, sort_order) values
  ('Zone test A', array['Almadies', '  Ngor ', 'ngor', 'Mermoz-Sacré Cœur'], 1500, 1),
  ('Zone test B', array['Plateau'], 2500, 2),
  ('Zone test C', array['Yoff'], null, 3);

select is((select districts from public.delivery_zones where name = 'Zone test A'), array['Almadies', 'Ngor', 'Mermoz-Sacré Cœur'],
  'quartiers nettoyés : vides et doublons retirés');
select throws_ok($$ insert into public.delivery_zones (name, districts, fee_fcfa) values ('Zone test D', array['ALMADIÈS'], 900) $$,
  '23505', 'ZONE_DISTRICT_CLASH', 'un quartier (sans accent ni majuscule) ne peut appartenir qu''à une zone active');
select lives_ok($$ insert into public.delivery_zones (name, districts, fee_fcfa, is_active) values ('Zone test E', array['Almadies'], 900, false) $$,
  'une zone désactivée peut reprendre un quartier');

create temp table o1 as
select (public.place_order(jsonb_build_object(
  'idempotency_key', gen_random_uuid(), 'cycle_id', '00000000-0000-4000-8000-000000000012',
  'fulfillment', 'delivery', 'slot_id', (select dslot from z), 'tracking_token_hash', 'h-zone-1',
  'customer', jsonb_build_object('name', 'Z', 'phone', '+221770002222'),
  'delivery', jsonb_build_object('address_line', 'Rue 1', 'district', 'ALMADIES', 'recipient_phone', '+221770002222', 'latitude', 14.74, 'longitude', -17.5),
  'items', jsonb_build_array(jsonb_build_object('variant_id', (select box6 from z), 'quantity', 1))
)) ->> 'order_id')::uuid as id;

select is((select delivery_zone_name || '/' || delivery_fee_fcfa from public.orders where id = (select id from o1)), 'Zone test A/1500',
  'quartier → zone → tarif enregistrés dans la commande');
select is((select total_fcfa = subtotal_fcfa from public.orders where id = (select id from o1)), true,
  'les frais de livraison ne sont jamais ajoutés au total payé en ligne');

update public.delivery_zones set fee_fcfa = 9999, name = 'Zone test A renommée' where name = 'Zone test A';
select is((select delivery_zone_name || '/' || delivery_fee_fcfa from public.orders where id = (select id from o1)), 'Zone test A/1500',
  'modifier la zone ne change jamais une ancienne commande');
update public.delivery_zones set is_active = false where name = 'Zone test A renommée';
select is((select delivery_fee_fcfa from public.orders where id = (select id from o1)), 1500, 'désactiver la zone non plus');

select throws_ok($$ update public.orders set delivery_fee_fcfa = 1 where id = (select id from o1) $$, 'P0001', 'DELIVERY_PRICING_FROZEN',
  'le tarif d''une commande ne peut plus être modifié');

-- Quartier d'une zone à tarif « à confirmer », quartier inconnu, retrait.
create temp table o2 as
select (public.place_order(jsonb_build_object(
  'idempotency_key', gen_random_uuid(), 'cycle_id', '00000000-0000-4000-8000-000000000012',
  'fulfillment', 'delivery', 'slot_id', (select dslot from z), 'tracking_token_hash', 'h-zone-2',
  'customer', jsonb_build_object('name', 'Z', 'phone', '+221770002222'),
  'delivery', jsonb_build_object('address_line', 'Rue 2', 'district', 'yoff', 'recipient_phone', '+221770002222', 'latitude', 14.74, 'longitude', -17.5),
  'items', jsonb_build_array(jsonb_build_object('variant_id', (select box6 from z), 'quantity', 1))
)) ->> 'order_id')::uuid as id;
select is((select delivery_zone_name || '/' || coalesce(delivery_fee_fcfa::text, 'à confirmer') from public.orders where id = (select id from o2)), 'Zone test C/à confirmer',
  'zone sans tarif : « à confirmer selon la position »');

create temp table o3 as
select (public.place_order(jsonb_build_object(
  'idempotency_key', gen_random_uuid(), 'cycle_id', '00000000-0000-4000-8000-000000000012',
  'fulfillment', 'delivery', 'slot_id', (select dslot from z), 'tracking_token_hash', 'h-zone-3',
  'customer', jsonb_build_object('name', 'Z', 'phone', '+221770002222'),
  'delivery', jsonb_build_object('address_line', 'Rue 3', 'district', 'Quartier inconnu', 'recipient_phone', '+221770002222', 'latitude', 14.74, 'longitude', -17.5),
  'items', jsonb_build_array(jsonb_build_object('variant_id', (select box6 from z), 'quantity', 1))
)) ->> 'order_id')::uuid as id;
select is((select zone_id is null and delivery_zone_name is null and delivery_fee_fcfa is null from public.orders where id = (select id from o3)), true,
  'quartier hors liste : aucune zone, tarif à confirmer (aucune commande bloquée)');

create temp table o4 as
select (public.place_order(jsonb_build_object(
  'idempotency_key', gen_random_uuid(), 'cycle_id', '00000000-0000-4000-8000-000000000012',
  'fulfillment', 'pickup', 'slot_id', (select pslot from z), 'tracking_token_hash', 'h-zone-4',
  'customer', jsonb_build_object('name', 'Z', 'phone', '+221770002222'),
  'items', jsonb_build_array(jsonb_build_object('variant_id', (select box6 from z), 'quantity', 1))
)) ->> 'order_id')::uuid as id;
select is((select delivery_fee_fcfa from public.orders where id = (select id from o4)), 0, 'retrait : gratuit, sans zone');

-- Aucune zone configurée : comportement actuel conservé.
update public.delivery_zones set is_active = false;
create temp table o5 as
select (public.place_order(jsonb_build_object(
  'idempotency_key', gen_random_uuid(), 'cycle_id', '00000000-0000-4000-8000-000000000012',
  'fulfillment', 'delivery', 'slot_id', (select dslot from z), 'tracking_token_hash', 'h-zone-5',
  'customer', jsonb_build_object('name', 'Z', 'phone', '+221770002222'),
  'delivery', jsonb_build_object('address_line', 'Rue 5', 'district', 'Plateau', 'recipient_phone', '+221770002222', 'latitude', 14.74, 'longitude', -17.5),
  'items', jsonb_build_array(jsonb_build_object('variant_id', (select box6 from z), 'quantity', 1))
)) ->> 'order_id')::uuid as id;
select is((select delivery_fee_fcfa is null and zone_id is null from public.orders where id = (select id from o5)), true,
  'sans zone active : fonctionnement actuel, tarif confirmé selon la position');
select is((select count(*)::int from public.orders where id in (select id from o1 union all select id from o2 union all select id from o3 union all select id from o4 union all select id from o5)), 5,
  'aucune commande n''a été bloquée');

-- Import d'une grille : un quartier peut changer de zone dans le même fichier, tout ou rien.
select is((public.admin_import_delivery_zones(jsonb_build_array(
  jsonb_build_object('name', 'Zone test B', 'districts', jsonb_build_array('Plateau', 'Yoff'), 'fee_fcfa', '2600', 'sort_order', '2', 'is_active', true, 'note', null),
  jsonb_build_object('name', 'Zone test C', 'districts', jsonb_build_array('Ouakam'), 'fee_fcfa', '', 'sort_order', '3', 'is_active', true, 'note', 'après-midi'),
  jsonb_build_object('name', 'Zone importée', 'districts', jsonb_build_array('Médina'), 'fee_fcfa', '1800', 'sort_order', '4', 'is_active', true, 'note', null)
), null) ->> 'created')::int, 1, 'import : une zone créée');
select is((select districts from public.delivery_zones where name = 'Zone test B'), array['Plateau', 'Yoff'], 'import : Yoff est passé de la zone C à la zone B');
select throws_ok($$ select public.admin_import_delivery_zones(jsonb_build_array(
  jsonb_build_object('name', 'Zone importée', 'districts', jsonb_build_array('Plateau'), 'fee_fcfa', '1', 'is_active', true)), null) $$, '23505', 'ZONE_DISTRICT_CLASH',
  'import : un quartier déjà pris par une autre zone active est refusé');
select is((select districts from public.delivery_zones where name = 'Zone importée'), array['Médina'], 'import refusé : rien n''a changé (tout ou rien)');
update public.delivery_zones set is_active = false;

reset role;
set local role anon;
select is((select count(*)::int from public.delivery_zones), 0, 'visiteur : seules les zones actives sont lisibles (ici aucune)');
select throws_ok($$ insert into public.delivery_zones (name, districts) values ('X', '{}') $$, '42501', null, 'visiteur : écriture refusée');
reset role;
set local role service_role;
update public.delivery_zones set is_active = true where name = 'Zone test B';
reset role;
set local role anon;
select is((select count(*)::int from public.delivery_zones), 1, 'visiteur : une zone active devient lisible');

select * from finish();
rollback;
