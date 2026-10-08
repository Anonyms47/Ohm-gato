-- OHMEGATO — catalogue réel (données transmises par Alima).
-- Ce fichier est valable en production. Les éléments marqués « À CONFIRMER »
-- ne sont jamais affichés tant que leur indicateur de confirmation reste à false.

insert into public.site_settings (key, value, is_public) values
  ('brand.phone', '"+221780103050"', true),
  ('brand.whatsapp', '"+221780103050"', true),
  ('brand.instagram', '"ohmegato"', true),
  ('brand.pickup_address', '"Rue GY-69, Cité Sonatel 2, Sud Foire"', true),
  ('brand.city', '"Dakar"', true),
  ('order.min_notice_hours', '24', true),
  ('order.custom_notice_days', '{"min": 2, "max": 4}', true),
  -- À CONFIRMER : non publics tant qu'Alima ne les a pas transmis.
  ('brand.email', 'null', false),
  ('brand.contact_hours', 'null', false),
  ('home.alima_note', 'null', false),
  ('story.alima_quote', 'null', false)
on conflict (key) do nothing;

insert into public.flavors (slug, name) values
  ('vanille', 'Vanille'),
  ('chocolat', 'Chocolat'),
  ('fraise', 'Fraise'),
  ('orange', 'Orange'),
  ('mangue', 'Mangue')
on conflict (slug) do nothing;

-- Liste d'allergènes gérés. Aucune association produit n'est créée ici :
-- elles doivent être confirmées recette par recette (product_allergens.confirmed).
insert into public.allergens (slug, name) values
  ('gluten', 'Gluten'),
  ('oeufs', 'Œufs'),
  ('lait', 'Lait'),
  ('soja', 'Soja'),
  ('fruits-a-coque', 'Fruits à coque'),
  ('chocolat', 'Chocolat')
on conflict (slug) do nothing;

insert into public.products
  (slug, name, short_description, description, tips, unit_label, unit_label_plural, staging, accent,
   storage_rule, storage_note, storage_confirmed, pairing_slugs, sort_order)
values
  ('cookies', 'Cookies',
   'Bords croustillants, cœur moelleux.',
   'Bords croustillants, cœur moelleux, chocolat noir et chocolat au lait concassés, note caramélisée.',
   null,
   'cookie', 'cookies', 'cookie-casse', 'caramel',
   'ambient_airtight_48h', 'Peuvent être légèrement réchauffés avant dégustation.', true, '{brownies,muffins-pepites}', 10),

  ('brownies', 'Brownies',
   'Petits carrés très chocolatés.',
   'Petits carrés très chocolatés, sans lait ajouté.',
   null,
   'carré', 'carrés', 'brownies-empiles', 'chocolate',
   'ambient_airtight_48h', null, true, '{cookies,choux-creme}', 20),

  ('moelleux-chocolat', 'Moelleux au chocolat',
   'Sauce chocolat servie dessus, pépites.',
   'Gâteau au chocolat, sauce chocolat servie dessus et pépites.',
   null,
   'part', 'parts', 'sauce-moelleux', 'chocolate',
   'refrigerated_48h', 'La sauce est déjà servie dessus.', true, '{verrines-fruitees,cookies}', 30),

  ('muffins-pepites', 'Muffins aux pépites de chocolat',
   'Moelleux, pépites, légère note de cannelle.',
   'Petits gâteaux moelleux, pépites de chocolat et légère note de cannelle.',
   null,
   'muffin', 'muffins', 'muffin-origine', 'caramel',
   'ambient_airtight_48h', null, true, '{cookies,cake-orange}', 40),

  ('moelleux-pommes', 'Moelleux aux pommes',
   'Lamelles de pommes caramélisées, cannelle.',
   'Gâteau aux pommes avec lamelles de pommes caramélisées au fond et cannelle.',
   null,
   'part', 'parts', 'coupe-pommes', 'caramel',
   'refrigerated_48h', null, true, '{cake-orange,muffins-pepites}', 50),

  ('cake-orange', 'Cake à l’orange',
   'Gâteau au yaourt, vrai goût d’orange.',
   'Barre rectangulaire, base de gâteau au yaourt et véritable goût d’orange.',
   null,
   'tranche', 'tranches', 'cake-tranches', 'orange',
   'cool_wrapped_1w', null, true,
   '{moelleux-pommes,verrines-fruitees}', 60),

  ('choux-creme', 'Choux à la crème',
   'Fourrés de crème pâtissière.',
   'Choux fourrés de crème pâtissière.',
   null,
   'chou', 'choux', 'choux-pyramide', 'rose',
   'refrigerated_48h', null, true,
   '{brownies,verrines-fruitees}', 70),

  ('verrines-fruitees', 'Verrines fruitées',
   'Crème, génoise et coulis, en couches.',
   'Deux couches de crème, deux couches de génoise et deux couches de marmelade ou coulis.',
   null,
   'verrine', 'verrines', 'verrine-couches', 'orange',
   'refrigerated_48h', null, true,
   '{choux-creme,moelleux-chocolat}', 80)
on conflict (slug) do nothing;

insert into public.product_variants (product_id, label, units_consumed, price_fcfa, sort_order)
select p.id, v.label, v.units, v.price, v.sort
from (values
  ('cookies', 'Unité', 1, 800, 1),
  ('cookies', 'Box de 3', 3, 2200, 2),
  ('cookies', 'Box de 6', 6, 4500, 3),
  ('brownies', 'Box de 4', 4, 1000, 1),
  ('brownies', 'Box de 10', 10, 2200, 2),
  ('brownies', 'Box de 36', 36, 7500, 3),
  ('moelleux-chocolat', 'Part', 1, 1200, 1),
  ('moelleux-chocolat', 'Entier, 8 parts', 8, 9000, 2),
  ('muffins-pepites', 'Box de 6', 6, 2500, 1),
  ('muffins-pepites', 'Box de 12', 12, 4500, 2),
  ('moelleux-pommes', 'Part', 1, 1200, 1),
  ('moelleux-pommes', 'Entier, 8 parts', 8, 8000, 2),
  ('cake-orange', '4 tranches', 4, 1000, 1),
  -- À CONFIRMER : nombre de tranches dans une barre entière (10 provisoire, pour le stock uniquement).
  ('cake-orange', 'Barre entière', 10, 2500, 2),
  ('choux-creme', 'Unité', 1, 400, 1),
  ('choux-creme', 'Box de 5', 5, 1800, 2),
  ('verrines-fruitees', 'Unité', 1, 1500, 1),
  ('verrines-fruitees', 'Box de 4', 4, 5000, 2)
) as v(slug, label, units, price, sort)
join public.products p on p.slug = v.slug
on conflict (product_id, label) do nothing;

insert into public.product_flavors (product_id, flavor_id, sort_order)
select p.id, f.id, v.sort
from (values
  ('choux-creme', 'vanille', 1),
  ('choux-creme', 'chocolat', 2),
  ('verrines-fruitees', 'fraise', 1),
  ('verrines-fruitees', 'orange', 2),
  ('verrines-fruitees', 'mangue', 3)
) as v(product, flavor, sort)
join public.products p on p.slug = v.product
join public.flavors f on f.slug = v.flavor
on conflict do nothing;

-- Visuels officiels (détourés depuis les affiches OHMEGATO, livrés avec le site dans public/products).
insert into public.product_images (product_id, storage_path, alt, width, height, role, sort_order)
select p.id, v.path, v.alt, v.width, v.height, 'cutout', 1
from (values
  ('cookies', '/products/cookies.webp', 'Cookie cassé en deux, pépites de chocolat fondant au cœur', 1233, 846),
  ('brownies', '/products/brownies.webp', 'Trois carrés de brownie empilés, éclats de chocolat', 935, 1347),
  ('moelleux-chocolat', '/products/moelleux-chocolat.webp', 'Part de moelleux au chocolat nappée de sauce chocolat', 1027, 895),
  ('muffins-pepites', '/products/muffins-pepites.webp', 'Muffin aux pépites de chocolat dans sa caissette', 803, 733),
  ('moelleux-pommes', '/products/moelleux-pommes.webp', 'Part de moelleux aux pommes, morceaux de pomme dans la mie', 1341, 787),
  ('cake-orange', '/products/cake-orange.webp', 'Tranche de cake à l''orange saupoudrée de sucre, rondelle d''orange', 1284, 913),
  ('choux-creme', '/products/choux-creme.webp', 'Pyramide de choux garnis de crème au chocolat', 1114, 1328),
  ('verrines-fruitees', '/products/verrines-fruitees.webp', 'Deux verrines en couches : crème, génoise et coulis de fruits', 1302, 919)
) as v(slug, path, alt, width, height)
join public.products p on p.slug = v.slug
where not exists (select 1 from public.product_images i where i.product_id = p.id and i.storage_path = v.path);
