-- Allergènes : matrice préremplie, statuts conservateurs, indicateur interne jamais lisible côté client.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

create temp table s as
select p.slug as product, f.slug as flavor, a.slug as allergen, x.status::text as status, x.verification::text as verification
from public.product_allergen_statuses x
join public.products p on p.id = x.product_id
join public.allergens a on a.id = x.allergen_id
left join public.flavors f on f.id = x.flavor_id;

select is((select count(distinct product)::int from s), 8, 'les huit produits sont renseignés');
select is((select status from s where product = 'brownies' and allergen = 'lait'), 'no_added', 'brownies : lait « sans ajout direct »');
select is((select count(*)::int from s where allergen in ('soja', 'arachides', 'fruits-a-coque', 'sesame') and status <> 'not_confirmed'), 0,
  'soja, arachides, fruits à coque et sésame restent « à vérifier »');
select is((select count(*)::int from s where status = 'may_contain'), 0, 'aucune trace déclarée par supposition');
select is((select count(*)::int from s where allergen in ('gluten', 'oeufs') and status = 'contains'), 16, 'gluten et œufs présents dans les huit recettes');
select is((select status from s where product = 'choux-creme' and flavor = 'chocolat' and allergen = 'soja'), 'not_confirmed', 'choux chocolat : soja à vérifier');
select ok(not exists (select 1 from public.allergens where slug = 'chocolat' and is_active), 'le chocolat n''est plus un allergène actif');
select is((select label from public.product_recipe_notes n join public.products p on p.id = n.product_id join public.flavors f on f.id = n.flavor_id
  where p.slug = 'verrines-fruitees' and f.slug = 'mangue'), 'de la mangue', 'verrine mangue : information de recette');
select is((select value ->> 'enabled' from public.site_settings where key = 'allergens.workshop_traces'), 'false', 'traces d''atelier désactivées par défaut');

set local role anon;
select lives_ok($$ select product_id, flavor_id, allergen_id, status from public.product_allergen_statuses $$, 'le client lit les statuts');
select throws_ok($$ select verification from public.product_allergen_statuses $$, '42501', null, 'l''indicateur interne reste privé');
select throws_ok($$ select verification from public.product_recipe_notes $$, '42501', null, 'idem pour les informations de recette');
reset role;

select * from finish();
rollback;
