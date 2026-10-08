-- Lecture publique de l'occupation des créneaux, sans exposer les commandes.
create or replace function public.cycle_slot_status(p_cycle_id uuid)
returns table (slot_id uuid, is_full boolean)
language sql stable security definer set search_path = '' as $$
  select s.id,
         s.capacity_orders is not null and (
           select count(*) from public.orders o
           where o.slot_id = s.id and o.status not in ('cancelled', 'expired', 'refunded')
         ) >= s.capacity_orders
  from public.delivery_slots s
  join public.production_cycles c on c.id = s.cycle_id
  where s.cycle_id = p_cycle_id and s.is_active and c.status <> 'draft';
$$;

revoke all on function public.cycle_slot_status(uuid) from public;
grant execute on function public.cycle_slot_status(uuid) to anon, authenticated, service_role;

-- Visuels produits : lecture publique, écriture réservée aux administrateurs.
-- Types et taille limités côté stockage (vérification complémentaire côté serveur).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('products', 'products', true, 5242880, array['image/webp', 'image/avif', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy "visuels produits lisibles" on storage.objects
  for select using (bucket_id = 'products');
create policy "visuels produits gérés par l'admin" on storage.objects
  for all using (bucket_id = 'products' and public.is_admin())
  with check (bucket_id = 'products' and public.is_admin());
