-- OHMEGATO — provenance des informations d'allergènes et de recette, historique des valeurs.
--
-- Chaque statut d'allergène et chaque information de recette indique d'où vient sa validation
-- (confirmation de la fondatrice, recette, étiquette d'emballage), par qui et comment. Ces
-- métadonnées restent internes : aucun droit de lecture n'est donné au navigateur.
-- Avant chaque remplacement, les anciennes valeurs d'un produit sont copiées dans un historique.

alter table public.product_allergen_statuses
  add column confirmation_source text check (confirmation_source in ('founder_confirmation', 'recipe', 'packaging_label')),
  add column confirmed_by text check (char_length(confirmed_by) between 1 and 80),
  add column confirmation_method text check (confirmation_method in ('voice_confirmation', 'written_confirmation', 'packaging_label', 'admin_edit'));

alter table public.product_recipe_notes
  add column confirmation_source text check (confirmation_source in ('founder_confirmation', 'recipe', 'packaging_label')),
  add column confirmed_by text check (char_length(confirmed_by) between 1 and 80),
  add column confirmation_method text check (confirmation_method in ('voice_confirmation', 'written_confirmation', 'packaging_label', 'admin_edit'));

-- Historique : instantané complet des statuts et informations de recette d'un produit.
create table public.product_allergen_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 200),
  statuses jsonb not null default '[]',
  recipe_notes jsonb not null default '[]',
  recorded_by uuid references auth.users (id) on delete set null,
  recorded_at timestamptz not null default now()
);
create index product_allergen_history_product_idx on public.product_allergen_history (product_id, recorded_at desc);

alter table public.product_allergen_history enable row level security;
alter table public.product_allergen_history force row level security;
revoke all on public.product_allergen_history from anon, authenticated;
grant all on public.product_allergen_history to service_role;

-- « Sans ajout direct » : jamais présenté comme une garantie d'absence.
update public.allergens
  set no_added_text = 'Préparé sans ajout direct de lait. D’autres ingrédients, comme le chocolat, peuvent contenir du lait ou des traces de lait.'
  where slug = 'lait';
