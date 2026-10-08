-- OHMEGATO — Row Level Security
-- Règle : RLS activée partout. Les écritures sensibles (commandes, paiements, stock)
-- passent exclusivement par des fonctions SECURITY DEFINER réservées au service_role.

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'staff_roles', 'site_settings', 'products', 'product_images',
    'product_variants', 'flavors', 'product_flavors', 'allergens', 'product_allergens',
    'production_cycles', 'cycle_products', 'delivery_zones', 'delivery_slots',
    'inventory_units', 'addresses', 'carts', 'cart_items', 'favorites', 'orders',
    'order_items', 'order_status_history', 'stock_reservations', 'inventory_movements',
    'payments', 'payment_events', 'custom_requests', 'custom_request_items',
    'custom_request_messages', 'notifications', 'notification_preferences', 'reviews',
    'audit_logs', 'rate_limits'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Lecture publique du catalogue
-- ---------------------------------------------------------------------------
create policy "catalogue visible" on public.products
  for select using (is_active or public.is_admin());
create policy "images visibles" on public.product_images
  for select using (true);
create policy "formats visibles" on public.product_variants
  for select using (is_active or public.is_admin());
create policy "parfums visibles" on public.flavors for select using (true);
create policy "parfums produits visibles" on public.product_flavors for select using (true);
create policy "allergènes visibles" on public.allergens for select using (true);
create policy "allergènes confirmés visibles" on public.product_allergens
  for select using (confirmed or public.is_admin());
create policy "réglages publics" on public.site_settings
  for select using (is_public or public.is_admin());

create policy "fournées publiées" on public.production_cycles
  for select using (status <> 'draft' or public.is_admin());
create policy "produits de fournée" on public.cycle_products
  for select using (exists (
    select 1 from public.production_cycles c
    where c.id = cycle_id and (c.status <> 'draft' or public.is_admin())
  ));
create policy "stock des fournées publiées" on public.inventory_units
  for select using (exists (
    select 1 from public.production_cycles c
    where c.id = cycle_id and (c.status <> 'draft' or public.is_admin())
  ));
create policy "zones actives" on public.delivery_zones
  for select using (is_active or public.is_admin());
create policy "créneaux actifs" on public.delivery_slots
  for select using (is_active or public.is_admin());

-- Écriture du catalogue : administrateurs uniquement (rôle vérifié en base).
do $$
declare t text;
begin
  foreach t in array array[
    'products', 'product_images', 'product_variants', 'flavors', 'product_flavors',
    'allergens', 'product_allergens', 'production_cycles', 'cycle_products',
    'delivery_zones', 'delivery_slots', 'site_settings'
  ] loop
    execute format(
      'create policy "admin écrit" on public.%I for all using (public.is_admin()) with check (public.is_admin())',
      t
    );
  end loop;
end $$;
-- inventory_units : modifié uniquement par les fonctions de stock (journalisées).

-- ---------------------------------------------------------------------------
-- Données personnelles : chacun ne voit que les siennes
-- ---------------------------------------------------------------------------
create policy "profil personnel" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profil modifiable" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "rôle personnel visible" on public.staff_roles
  for select using (user_id = auth.uid() or public.is_admin());

create policy "adresses personnelles" on public.addresses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "panier personnel" on public.carts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "articles du panier personnel" on public.cart_items
  for all using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()));

create policy "favoris personnels" on public.favorites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "notifications personnelles" on public.notifications
  for select using (user_id = auth.uid());
create policy "notifications lues" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "préférences personnelles" on public.notification_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Commandes : lecture seule pour le client propriétaire ; aucune écriture directe.
create policy "commandes personnelles" on public.orders
  for select using (user_id = auth.uid() or public.is_admin());
create policy "articles des commandes personnelles" on public.order_items
  for select using (exists (
    select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())
  ));
create policy "historique des commandes personnelles" on public.order_status_history
  for select using (exists (
    select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())
  ));

-- Livreur : uniquement les commandes en livraison, via une vue limitée.
create view public.courier_deliveries with (security_invoker = false) as
  select o.id, o.reference, o.status, o.recipient_name, o.recipient_phone, o.address_line,
         o.district, o.landmark, o.floor_door, o.delivery_instructions, o.latitude, o.longitude,
         s.starts_at as slot_starts_at, s.ends_at as slot_ends_at
  from public.orders o
  join public.delivery_slots s on s.id = o.slot_id
  where o.fulfillment = 'delivery'
    and o.status in ('ready', 'out_for_delivery')
    and public.has_staff_role('courier');
revoke all on public.courier_deliveries from anon;
grant select on public.courier_deliveries to authenticated;

create policy "paiements admin" on public.payments for select using (public.is_admin());
create policy "événements admin" on public.payment_events for select using (public.is_admin());
create policy "réservations admin" on public.stock_reservations for select using (public.is_admin());
create policy "mouvements admin" on public.inventory_movements for select using (public.is_admin());
create policy "journal admin" on public.audit_logs for select using (public.is_admin());
-- rate_limits : aucune politique = inaccessible hors service_role.

-- Sur-mesure : le client voit ses demandes ; création via le serveur.
create policy "demandes personnelles" on public.custom_requests
  for select using (user_id = auth.uid() or public.is_admin());
create policy "admin gère les demandes" on public.custom_requests
  for update using (public.is_admin()) with check (public.is_admin());
create policy "articles des demandes personnelles" on public.custom_request_items
  for select using (exists (
    select 1 from public.custom_requests r where r.id = request_id and (r.user_id = auth.uid() or public.is_admin())
  ));
create policy "messages des demandes personnelles" on public.custom_request_messages
  for select using (exists (
    select 1 from public.custom_requests r where r.id = request_id and (r.user_id = auth.uid() or public.is_admin())
  ));

create policy "avis publiés" on public.reviews
  for select using (is_published or user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Création automatique du profil
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, phone, email)
  values (new.id, new.phone, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
