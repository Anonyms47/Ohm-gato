-- OHMEGATO — allergènes et informations de recette des huit produits (logique conservatrice).
-- Déduits des recettes : à valider par Alima dans /admin (indicateur interne, jamais affiché).
-- Soja, arachides, fruits à coque et sésame : « à vérifier » sur les emballages et dans l'atelier.
-- Aucune trace n'est déclarée. Valable en production (rejouable sans doublon).

insert into public.product_allergen_statuses (product_id, flavor_id, allergen_id, status, note, verification)
select p.id, f.id, a.id, v.status::public.allergen_status, v.note, v.verification::public.allergen_verification
from (values
  -- Cookies
  ('cookies', null, 'gluten', 'contains', null, 'deduced_from_recipe'),
  ('cookies', null, 'oeufs', 'contains', null, 'deduced_from_recipe'),
  ('cookies', null, 'lait', 'contains', 'Beurre et chocolat au lait.', 'deduced_from_recipe'),
  ('cookies', null, 'soja', 'not_confirmed', 'À vérifier sur les chocolats utilisés.', 'packaging_check_needed'),
  -- Brownies
  ('brownies', null, 'gluten', 'contains', null, 'deduced_from_recipe'),
  ('brownies', null, 'oeufs', 'contains', null, 'deduced_from_recipe'),
  ('brownies', null, 'lait', 'no_added', 'Recette sans lait ajouté. Le chocolat peut en contenir : vérifier son étiquette.', 'packaging_check_needed'),
  ('brownies', null, 'soja', 'not_confirmed', 'À vérifier sur le chocolat.', 'packaging_check_needed'),
  -- Moelleux au chocolat
  ('moelleux-chocolat', null, 'gluten', 'contains', null, 'deduced_from_recipe'),
  ('moelleux-chocolat', null, 'oeufs', 'contains', null, 'deduced_from_recipe'),
  ('moelleux-chocolat', null, 'lait', 'contains', 'Dans le gâteau ou la sauce.', 'deduced_from_recipe'),
  ('moelleux-chocolat', null, 'soja', 'not_confirmed', 'À vérifier sur le chocolat et les pépites.', 'packaging_check_needed'),
  -- Muffins aux pépites de chocolat
  ('muffins-pepites', null, 'gluten', 'contains', null, 'deduced_from_recipe'),
  ('muffins-pepites', null, 'oeufs', 'contains', null, 'deduced_from_recipe'),
  ('muffins-pepites', null, 'lait', 'contains', null, 'deduced_from_recipe'),
  ('muffins-pepites', null, 'soja', 'not_confirmed', 'À vérifier sur les pépites.', 'packaging_check_needed'),
  -- Moelleux aux pommes
  ('moelleux-pommes', null, 'gluten', 'contains', null, 'deduced_from_recipe'),
  ('moelleux-pommes', null, 'oeufs', 'contains', null, 'deduced_from_recipe'),
  ('moelleux-pommes', null, 'lait', 'contains', null, 'deduced_from_recipe'),
  ('moelleux-pommes', null, 'soja', 'not_confirmed', 'À vérifier sur les emballages.', 'packaging_check_needed'),
  -- Cake à l'orange (base gâteau au yaourt)
  ('cake-orange', null, 'gluten', 'contains', null, 'deduced_from_recipe'),
  ('cake-orange', null, 'oeufs', 'contains', null, 'deduced_from_recipe'),
  ('cake-orange', null, 'lait', 'contains', 'Yaourt.', 'deduced_from_recipe'),
  ('cake-orange', null, 'soja', 'not_confirmed', 'À vérifier sur les emballages.', 'packaging_check_needed'),
  -- Choux à la crème (pâte à choux et crème pâtissière)
  ('choux-creme', null, 'gluten', 'contains', null, 'deduced_from_recipe'),
  ('choux-creme', null, 'oeufs', 'contains', null, 'deduced_from_recipe'),
  ('choux-creme', null, 'lait', 'contains', 'Pâte et crème pâtissière.', 'deduced_from_recipe'),
  ('choux-creme', null, 'soja', 'not_confirmed', 'À vérifier sur les emballages.', 'packaging_check_needed'),
  ('choux-creme', 'chocolat', 'soja', 'not_confirmed', 'À vérifier sur le chocolat.', 'packaging_check_needed'),
  -- Verrines fruitées (crème et génoise)
  ('verrines-fruitees', null, 'gluten', 'contains', null, 'deduced_from_recipe'),
  ('verrines-fruitees', null, 'oeufs', 'contains', null, 'deduced_from_recipe'),
  ('verrines-fruitees', null, 'lait', 'contains', null, 'deduced_from_recipe'),
  ('verrines-fruitees', null, 'soja', 'not_confirmed', 'À vérifier sur les emballages.', 'packaging_check_needed')
) as v(product, flavor, allergen, status, note, verification)
join public.products p on p.slug = v.product
join public.allergens a on a.slug = v.allergen
left join public.flavors f on f.slug = v.flavor
on conflict do nothing;

-- Arachides, fruits à coque, sésame : jamais déclarés présents sans vérification.
insert into public.product_allergen_statuses (product_id, allergen_id, status, note, verification)
select p.id, a.id, 'not_confirmed', 'À vérifier sur les emballages et dans l’atelier.', 'packaging_check_needed'
from public.products p
cross join public.allergens a
where p.slug in ('cookies', 'brownies', 'moelleux-chocolat', 'muffins-pepites', 'moelleux-pommes', 'cake-orange', 'choux-creme', 'verrines-fruitees')
  and a.slug in ('arachides', 'fruits-a-coque', 'sesame')
on conflict do nothing;

-- Informations de recette (« Contient … »), distinctes des allergènes.
insert into public.product_recipe_notes (product_id, flavor_id, label, sort_order, verification)
select p.id, f.id, v.label, v.sort_order, 'deduced_from_recipe'
from (values
  ('cookies', null, 'du chocolat noir', 1),
  ('cookies', null, 'du chocolat au lait', 2),
  ('brownies', null, 'du chocolat', 1),
  ('moelleux-chocolat', null, 'du chocolat', 1),
  ('muffins-pepites', null, 'du chocolat', 1),
  ('muffins-pepites', null, 'de la cannelle', 2),
  ('moelleux-pommes', null, 'des pommes', 1),
  ('moelleux-pommes', null, 'de la cannelle', 2),
  ('cake-orange', null, 'de l’orange', 1),
  ('choux-creme', 'chocolat', 'du chocolat', 1),
  ('verrines-fruitees', 'fraise', 'de la fraise', 1),
  ('verrines-fruitees', 'mangue', 'de la mangue', 1),
  ('verrines-fruitees', 'orange', 'de l’orange', 1)
) as v(product, flavor, label, sort_order)
join public.products p on p.slug = v.product
left join public.flavors f on f.slug = v.flavor
where not exists (
  select 1 from public.product_recipe_notes n
  where n.product_id = p.id and n.flavor_id is not distinct from f.id and n.label = v.label
);
