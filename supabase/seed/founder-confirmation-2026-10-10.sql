-- OHMEGATO — informations confirmées par Alima (vocaux du 10 octobre 2026).
--
-- Source : founder_confirmation · validé par : Alima · méthode : voice_confirmation.
-- Ne confirme que ce qu'Alima a explicitement dit (descriptions, conservation, informations de
-- recette, et le lait quand il découle d'un ingrédient cité : yaourt, crème pâtissière, chocolat
-- au lait). Tout ce qui dépend des emballages (soja, arachides, fruits à coque, sésame, traces)
-- reste « à vérifier ». Gluten et œufs restent « déduits de la recette » : non cités par Alima.
-- Prix, stocks et formats ne sont pas modifiés. Rejouable sans effet de bord.

-- 1. Historique : instantané des valeurs avant confirmation (une seule fois par produit).
insert into public.product_allergen_history (product_id, reason, statuses, recipe_notes)
select p.id, 'Avant la confirmation d’Alima du 10 octobre 2026',
  coalesce((select jsonb_agg(to_jsonb(s) - 'id') from public.product_allergen_statuses s where s.product_id = p.id), '[]'),
  coalesce((select jsonb_agg(to_jsonb(n) - 'id') from public.product_recipe_notes n where n.product_id = p.id), '[]')
from public.products p
where p.slug in ('muffins-pepites', 'brownies', 'moelleux-chocolat', 'moelleux-pommes', 'cookies', 'cake-orange', 'verrines-fruitees', 'choux-creme')
  and not exists (
    select 1 from public.product_allergen_history h
    where h.product_id = p.id and h.reason = 'Avant la confirmation d’Alima du 10 octobre 2026'
  );

-- 2. Descriptions validées et conservation (règle finale d'Alima).
update public.products p set
  description = v.description,
  short_description = v.short_description,
  storage_rule = v.storage_rule::public.storage_rule,
  storage_note = v.storage_note,
  storage_confirmed = true
from (values
  ('muffins-pepites',
   'De petits gâteaux individuels, moelleux et généreux, préparés avec des pépites de chocolat et une légère note de cannelle.',
   'Moelleux, pépites de chocolat, légère note de cannelle.',
   'ambient_airtight_48h', null),
  ('brownies',
   'Des brownies riches et concentrés en chocolat, préparés sans ajout direct de lait et présentés en petits carrés. Leur texture et leur intensité les distinguent des gâteaux au chocolat classiques.',
   'Petits carrés riches et concentrés en chocolat.',
   'ambient_airtight_48h', 'Gardez-les bien emballés.'),
  ('moelleux-chocolat',
   'Un gâteau au chocolat moelleux recouvert d’une sauce chocolat fondante et de pépites de chocolat. Il est proposé en parts triangulaires ou en gâteau entier pour les anniversaires et autres événements.',
   'Sauce chocolat fondante et pépites, en part ou entier.',
   'refrigerated_48h', 'La sauce est déjà servie dessus.'),
  ('moelleux-pommes',
   'Un gâteau moelleux aux pommes, avec un fond de lamelles de pommes caramélisées et une légère note de cannelle. Il est proposé en parts triangulaires ou en gâteau entier.',
   'Pommes caramélisées au fond, légère note de cannelle.',
   'refrigerated_48h', null),
  ('cookies',
   'Des cookies aux bords croustillants et au cœur moelleux, garnis de chocolat noir et de chocolat au lait concassés. Le chocolat fond en bouche et leur saveur légèrement caramélisée rappelle les cookies américains.',
   'Bords croustillants, cœur moelleux.',
   'ambient_airtight_48h', 'Peuvent être légèrement réchauffés avant dégustation.'),
  ('cake-orange',
   'Un cake moelleux à base de gâteau au yaourt, avec une saveur d’orange bien présente. Il est présenté sous forme de barre rectangulaire, proposée entière ou découpée en tranches.',
   'Gâteau au yaourt, saveur d’orange bien présente.',
   'cool_wrapped_1w', 'Réfrigération recommandée en cas de forte chaleur.'),
  ('verrines-fruitees',
   'Des verrines fruitées composées de couches de crème, de génoise et de marmelade ou de coulis de fruits. Les parfums déjà réalisés sont la fraise, l’orange et la mangue.',
   'Crème, génoise et coulis de fruits, en couches.',
   'refrigerated_48h', null),
  ('choux-creme',
   'Des choux garnis de crème pâtissière, proposés à la vanille ou au chocolat. Ils peuvent être commandés à l’unité ou en box.',
   'Garnis de crème pâtissière, vanille ou chocolat.',
   'refrigerated_48h', null)
) as v(slug, description, short_description, storage_rule, storage_note)
where p.slug = v.slug;

-- 3. Lait confirmé par un ingrédient cité par Alima (yaourt, crème pâtissière, chocolat au lait),
--    et « sans ajout direct de lait » pour les brownies.
update public.product_allergen_statuses s set
  verification = 'confirmed_by_alima',
  verified_at = timestamptz '2026-10-10 12:00:00+00',
  confirmation_source = 'founder_confirmation',
  confirmed_by = 'Alima',
  confirmation_method = 'voice_confirmation',
  note = v.note
from (values
  ('cake-orange', 'contains', 'Base de gâteau au yaourt (confirmé par Alima).'),
  ('choux-creme', 'contains', 'Crème pâtissière (confirmé par Alima).'),
  ('cookies', 'contains', 'Chocolat au lait concassé (confirmé par Alima).'),
  ('brownies', 'no_added', 'Recette sans ajout direct de lait (confirmé par Alima). Le chocolat peut contenir du lait : étiquette à vérifier.')
) as v(slug, status, note)
join public.products p on p.slug = v.slug
join public.allergens a on a.slug = 'lait'
where s.product_id = p.id and s.allergen_id = a.id and s.flavor_id is null and s.status::text = v.status;

-- 4. Informations de recette citées par Alima.
update public.product_recipe_notes n set label = 'des pépites de chocolat'
from public.products p
where n.product_id = p.id and p.slug = 'muffins-pepites' and n.flavor_id is null and n.label = 'du chocolat';

insert into public.product_recipe_notes (product_id, flavor_id, label, sort_order)
select p.id, f.id, v.label, v.sort_order
from (values
  ('moelleux-chocolat', null, 'de la sauce au chocolat', 2),
  ('moelleux-chocolat', null, 'des pépites de chocolat', 3),
  ('cake-orange', null, 'du yaourt', 0),
  ('choux-creme', null, 'de la crème pâtissière', 0),
  ('choux-creme', 'vanille', 'de la vanille', 1),
  ('verrines-fruitees', null, 'de la crème', -1),
  ('verrines-fruitees', null, 'de la génoise', 0)
) as v(slug, flavor, label, sort_order)
join public.products p on p.slug = v.slug
left join public.flavors f on f.slug = v.flavor
where (v.flavor is null or f.id is not null)
  and not exists (
    select 1 from public.product_recipe_notes n
    where n.product_id = p.id and n.flavor_id is not distinct from f.id and n.label = v.label
  );

update public.product_recipe_notes n set
  verification = 'confirmed_by_alima',
  verified_at = timestamptz '2026-10-10 12:00:00+00',
  confirmation_source = 'founder_confirmation',
  confirmed_by = 'Alima',
  confirmation_method = 'voice_confirmation'
from public.products p
where n.product_id = p.id
  and p.slug in ('muffins-pepites', 'brownies', 'moelleux-chocolat', 'moelleux-pommes', 'cookies', 'cake-orange', 'verrines-fruitees', 'choux-creme')
  and n.label in (
    'des pépites de chocolat', 'de la cannelle', 'du chocolat', 'de la sauce au chocolat', 'des pommes',
    'du chocolat noir', 'du chocolat au lait', 'du yaourt', 'de l’orange', 'de la crème', 'de la génoise',
    'de la fraise', 'de la mangue', 'de la crème pâtissière', 'de la vanille'
  );

-- 5. Journal d'audit (une entrée par produit, une seule fois).
select public.write_audit(null, 'product.allergens.founder_confirmation', 'products', p.id::text,
  jsonb_build_object('slug', p.slug, 'source', 'founder_confirmation', 'confirmed_by', 'Alima', 'method', 'voice_confirmation', 'date', '2026-10-10'))
from public.products p
where p.slug in ('muffins-pepites', 'brownies', 'moelleux-chocolat', 'moelleux-pommes', 'cookies', 'cake-orange', 'verrines-fruitees', 'choux-creme')
  and not exists (
    select 1 from public.audit_logs l where l.action = 'product.allergens.founder_confirmation' and l.entity_id = p.id::text
  );
