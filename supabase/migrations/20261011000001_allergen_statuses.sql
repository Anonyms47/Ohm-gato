-- OHMEGATO — allergènes par statut, informations de recette et traces d'atelier.
--
-- Trois informations distinctes, jamais mélangées :
--   1. allergènes déclarés (product_allergen_statuses) avec un statut par produit ou par parfum ;
--   2. informations de recette (product_recipe_notes) : chocolat, pomme, orange, cannelle… ;
--   3. traces d'atelier (réglage « allergens.workshop_traces »), activables seulement après
--      confirmation d'Alima.
-- L'indicateur de vérification et les précisions internes ne sont jamais lisibles par les clients
-- (droits par colonne). L'ancienne table product_allergens n'est plus utilisée.

create type public.allergen_status as enum ('contains', 'may_contain', 'no_added', 'not_confirmed', 'not_applicable');
create type public.allergen_verification as enum ('confirmed_by_alima', 'deduced_from_recipe', 'packaging_check_needed');

-- ---------------------------------------------------------------------------
-- Liste des allergènes : libellé de phrase et mention « sans … ajouté »
-- ---------------------------------------------------------------------------
alter table public.allergens
  add column sentence_label text,
  add column no_added_text text,
  add column sort_order int not null default 0,
  add column is_active boolean not null default true;

insert into public.allergens (slug, name) values
  ('arachides', 'Arachides'),
  ('sesame', 'Sésame')
on conflict (slug) do nothing;

update public.allergens a set
  name = v.name,
  sentence_label = v.sentence_label,
  no_added_text = v.no_added_text,
  sort_order = v.sort_order,
  is_active = true
from (values
  ('gluten', 'Gluten (blé)', 'gluten', 'Préparé sans gluten ajouté, mais non garanti sans gluten ni sans traces de gluten.', 1),
  ('oeufs', 'Œufs', 'œufs', 'Préparé sans œufs ajoutés, mais non garanti sans traces d’œufs.', 2),
  ('lait', 'Lait et produits laitiers', 'lait', 'Préparé sans lait ajouté, mais non garanti sans lactose ni sans traces de lait.', 3),
  ('soja', 'Soja', 'soja', 'Préparé sans soja ajouté, mais non garanti sans traces de soja.', 4),
  ('arachides', 'Arachides', 'arachides', 'Préparé sans arachides ajoutées, mais non garanti sans traces d’arachides.', 5),
  ('fruits-a-coque', 'Fruits à coque', 'fruits à coque', 'Préparé sans fruits à coque ajoutés, mais non garanti sans traces de fruits à coque.', 6),
  ('sesame', 'Sésame', 'sésame', 'Préparé sans sésame ajouté, mais non garanti sans traces de sésame.', 7)
) as v(slug, name, sentence_label, no_added_text, sort_order)
where a.slug = v.slug;

-- Le chocolat n'est pas un allergène réglementaire : il devient une information de recette.
update public.allergens set is_active = false where slug = 'chocolat';

-- ---------------------------------------------------------------------------
-- Statut d'un allergène pour un produit (flavor_id null) ou pour un parfum du produit
-- ---------------------------------------------------------------------------
create table public.product_allergen_statuses (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  flavor_id uuid references public.flavors (id) on delete cascade,
  allergen_id uuid not null references public.allergens (id) on delete cascade,
  status public.allergen_status not null,
  note text check (char_length(note) <= 300),            -- précision interne
  verification public.allergen_verification not null default 'deduced_from_recipe',
  verified_at timestamptz,                               -- dernière validation
  updated_at timestamptz not null default now()
);
create unique index product_allergen_statuses_unique
  on public.product_allergen_statuses (product_id, coalesce(flavor_id, '00000000-0000-0000-0000-000000000000'::uuid), allergen_id);
create trigger product_allergen_statuses_touch before update on public.product_allergen_statuses
  for each row execute function public.touch_updated_at();

-- Information de recette, rédigée pour suivre « Contient » : « du chocolat noir », « de la cannelle ».
create table public.product_recipe_notes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  flavor_id uuid references public.flavors (id) on delete cascade,
  label text not null check (char_length(label) between 2 and 80),
  sort_order int not null default 0,
  verification public.allergen_verification not null default 'deduced_from_recipe',
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);
create trigger product_recipe_notes_touch before update on public.product_recipe_notes
  for each row execute function public.touch_updated_at();

alter table public.product_allergen_statuses enable row level security;
alter table public.product_allergen_statuses force row level security;
alter table public.product_recipe_notes enable row level security;
alter table public.product_recipe_notes force row level security;

create policy "statuts allergènes visibles" on public.product_allergen_statuses for select using (true);
create policy "informations de recette visibles" on public.product_recipe_notes for select using (true);
-- Écriture : uniquement par le serveur (service_role), après contrôle du rôle administrateur.

-- Droits par colonne : l'indicateur interne, la précision et les dates ne sortent jamais vers le navigateur.
revoke all on public.product_allergen_statuses from anon, authenticated;
revoke all on public.product_recipe_notes from anon, authenticated;
grant select (product_id, flavor_id, allergen_id, status) on public.product_allergen_statuses to anon, authenticated;
grant select (product_id, flavor_id, label, sort_order) on public.product_recipe_notes to anon, authenticated;
grant all on public.product_allergen_statuses, public.product_recipe_notes to service_role;

-- Traces d'atelier : désactivées tant qu'Alima n'a pas confirmé ingrédients, emballages et ustensiles.
insert into public.site_settings (key, value, is_public) values
  ('allergens.workshop_traces', '{"enabled": false, "allergens": []}', true),
  ('allergens.workshop_traces_review', '{"ingredients": false, "packaging": false, "utensils": false, "confirmed_at": null}', false)
on conflict (key) do nothing;

