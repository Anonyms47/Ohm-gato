-- OHMEGATO — à coller une fois dans Supabase → SQL Editor → Run (projet ohmegato).
-- Fonction utilisée par /admin pour enregistrer les allergènes d'un produit en une seule
-- opération (si quelque chose échoue, rien n'est perdu). Le connecteur ne peut pas l'installer
-- seul car elle contient une suppression de lignes.
create or replace function public.admin_replace_allergen_info(p_product_id uuid, p_statuses jsonb, p_notes jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.product_allergen_statuses where product_id = p_product_id;
  delete from public.product_recipe_notes where product_id = p_product_id;
  insert into public.product_allergen_statuses (product_id, flavor_id, allergen_id, status, note, verification, verified_at)
  select p_product_id, (s ->> 'flavor_id')::uuid, (s ->> 'allergen_id')::uuid, (s ->> 'status')::public.allergen_status,
         nullif(s ->> 'note', ''), (s ->> 'verification')::public.allergen_verification, (s ->> 'verified_at')::timestamptz
  from jsonb_array_elements(p_statuses) s;
  insert into public.product_recipe_notes (product_id, flavor_id, label, sort_order, verification, verified_at)
  select p_product_id, (n ->> 'flavor_id')::uuid, n ->> 'label', (n ->> 'sort_order')::int,
         (n ->> 'verification')::public.allergen_verification, (n ->> 'verified_at')::timestamptz
  from jsonb_array_elements(p_notes) n;
end $$;
revoke all on function public.admin_replace_allergen_info(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.admin_replace_allergen_info(uuid, jsonb, jsonb) to service_role;
