-- OHMEGATO — schéma principal
-- Montants : entiers en FCFA (XOF), jamais de flottants.
-- Stock : unités réelles (1 cookie, 1 carré, 1 part, 1 chou…).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.staff_role as enum ('admin', 'courier');

create type public.cycle_status as enum (
  'draft', 'scheduled', 'open', 'closed', 'preparing', 'delivering', 'done', 'cancelled'
);

create type public.storage_rule as enum ('refrigerated_48h', 'ambient_airtight_48h');

create type public.fulfillment_method as enum ('delivery', 'pickup');

create type public.slot_kind as enum ('delivery', 'pickup', 'both');

create type public.order_status as enum (
  'pending_payment',     -- commande provisoire, stock réservé, paiement en cours
  'awaiting_validation', -- hors zone : l'équipe doit valider avant paiement
  'confirmed',           -- payée
  'preparing',
  'finishing',           -- cuisson ou finitions
  'ready',
  'out_for_delivery',
  'delivered',
  'picked_up',
  'cancelled',
  'expired',
  'refunded',
  'needs_attention'      -- payée mais stock insuffisant : remboursement ou arbitrage manuel
);

create type public.payment_status as enum (
  'pending', 'paid', 'failed', 'cancelled', 'expired', 'refunded'
);

create type public.payment_provider as enum ('test', 'wave', 'orange_money');

create type public.reservation_status as enum ('active', 'consumed', 'released');

create type public.movement_kind as enum (
  'initial', 'adjustment', 'reserve', 'release', 'sell', 'cancel_sale'
);

create type public.custom_request_status as enum (
  'received', 'studying', 'info_requested', 'proposal_sent', 'accepted',
  'awaiting_payment', 'paid', 'preparing', 'done', 'declined'
);

-- ---------------------------------------------------------------------------
-- Utilitaire updated_at
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Comptes et rôles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  email text,
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Les rôles ne s'accordent jamais depuis le navigateur : aucune politique d'écriture.
create table public.staff_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.staff_role not null,
  granted_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create or replace function public.has_staff_role(p_role public.staff_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff_roles
    where user_id = auth.uid() and role = p_role
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_staff_role('admin');
$$;

-- Réglages de la marque (téléphone, adresse de retrait, note d'Alima…).
-- is_public = false : jamais exposé aux clients (ex. valeurs à confirmer).
create table public.site_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  short_description text not null,
  description text not null,
  tips text,
  unit_label text not null,           -- « cookie », « carré », « part »…
  unit_label_plural text not null,
  staging text not null,              -- mise en scène de la fiche (cookie-casse, choux-pyramide…)
  accent text not null default 'caramel' check (accent in ('caramel', 'chocolate', 'orange', 'rose')),
  storage_rule public.storage_rule,
  storage_note text,
  storage_confirmed boolean not null default false, -- non confirmé = jamais affiché
  pairing_slugs text[] not null default '{}',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null,
  alt text not null,
  width int not null check (width > 0),
  height int not null check (height > 0),
  role text not null default 'cutout' check (role in ('cutout', 'scene', 'detail')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  label text not null,
  units_consumed int not null check (units_consumed > 0),
  price_fcfa int not null check (price_fcfa >= 0),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, label)
);
create trigger product_variants_touch before update on public.product_variants
  for each row execute function public.touch_updated_at();

create table public.flavors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null
);

create table public.product_flavors (
  product_id uuid not null references public.products (id) on delete cascade,
  flavor_id uuid not null references public.flavors (id) on delete cascade,
  sort_order int not null default 0,
  primary key (product_id, flavor_id)
);

create table public.allergens (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null
);

-- Seuls les allergènes confirmés pour la recette sont affichés.
create table public.product_allergens (
  product_id uuid not null references public.products (id) on delete cascade,
  allergen_id uuid not null references public.allergens (id) on delete cascade,
  confirmed boolean not null default false,
  primary key (product_id, allergen_id)
);

-- ---------------------------------------------------------------------------
-- Fournées, créneaux, livraison
-- ---------------------------------------------------------------------------
create table public.production_cycles (
  id uuid primary key default gen_random_uuid(),
  number int not null unique check (number > 0),
  title text not null,
  message text,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  production_date date not null,
  fulfillment_date date not null,
  capacity_units int check (capacity_units is null or capacity_units >= 0),
  status public.cycle_status not null default 'draft',
  featured_product_id uuid references public.products (id),
  hero_image_path text,
  palette text not null default 'caramel' check (palette in ('caramel', 'chocolate', 'orange', 'rose')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closes_at > opens_at),
  check (fulfillment_date >= production_date)
);
create trigger production_cycles_touch before update on public.production_cycles
  for each row execute function public.touch_updated_at();

create table public.cycle_products (
  cycle_id uuid not null references public.production_cycles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  disabled_variant_ids uuid[] not null default '{}',
  available_flavor_ids uuid[],          -- null = tous les parfums du produit
  sort_order int not null default 0,
  primary key (cycle_id, product_id)
);

create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  districts text[] not null default '{}',
  fee_fcfa int check (fee_fcfa is null or fee_fcfa >= 0), -- null = tarif sur validation
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.delivery_slots (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.production_cycles (id) on delete cascade,
  kind public.slot_kind not null default 'both',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity_orders int check (capacity_orders is null or capacity_orders > 0),
  is_active boolean not null default true,
  check (ends_at > starts_at)
);

-- ---------------------------------------------------------------------------
-- Stock
-- ---------------------------------------------------------------------------
create table public.inventory_units (
  cycle_id uuid not null references public.production_cycles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  total_units int not null default 0 check (total_units >= 0),
  reserved_units int not null default 0 check (reserved_units >= 0),
  sold_units int not null default 0 check (sold_units >= 0),
  updated_at timestamptz not null default now(),
  primary key (cycle_id, product_id),
  -- protection contre la survente, garantie par la base
  check (reserved_units + sold_units <= total_units)
);
create trigger inventory_units_touch before update on public.inventory_units
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Adresses, paniers, favoris
-- ---------------------------------------------------------------------------
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text,
  recipient_name text not null,
  recipient_phone text not null,
  address_line text not null,
  district text,
  landmark text,
  floor_door text,
  instructions text,
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  zone_id uuid references public.delivery_zones (id),
  created_at timestamptz not null default now()
);

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  cycle_id uuid references public.production_cycles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger carts_touch before update on public.carts
  for each row execute function public.touch_updated_at();

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  flavor_id uuid references public.flavors (id),
  quantity int not null check (quantity between 1 and 50),
  unique nulls not distinct (cart_id, variant_id, flavor_id)
);

create table public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- ---------------------------------------------------------------------------
-- Commandes
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  tracking_token_hash text not null unique,  -- le jeton en clair n'est jamais stocké
  idempotency_key uuid not null unique,
  user_id uuid references auth.users (id) on delete set null,
  cycle_id uuid not null references public.production_cycles (id),
  status public.order_status not null,
  payment_status public.payment_status not null default 'pending',
  fulfillment public.fulfillment_method not null,
  slot_id uuid not null references public.delivery_slots (id),
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  -- livraison (instantané au moment de la commande)
  zone_id uuid references public.delivery_zones (id),
  address_line text,
  district text,
  landmark text,
  floor_door text,
  recipient_name text,
  recipient_phone text,
  delivery_instructions text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  pickup_code text,
  notes text,
  subtotal_fcfa int not null check (subtotal_fcfa >= 0),
  delivery_fee_fcfa int check (delivery_fee_fcfa is null or delivery_fee_fcfa >= 0),
  total_fcfa int not null check (total_fcfa >= 0),
  reservation_expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fulfillment = 'pickup' or (address_line is not null and recipient_phone is not null))
);
create index orders_user_idx on public.orders (user_id);
create index orders_cycle_idx on public.orders (cycle_id, status);
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  flavor_id uuid references public.flavors (id) on delete set null,
  -- instantané au moment de l'achat
  product_name text not null,
  variant_label text not null,
  flavor_name text,
  units_per_item int not null check (units_per_item > 0),
  quantity int not null check (quantity > 0),
  unit_price_fcfa int not null check (unit_price_fcfa >= 0),
  line_total_fcfa int not null check (line_total_fcfa = unit_price_fcfa * quantity)
);
create index order_items_order_idx on public.order_items (order_id);

create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  status public.order_status not null,
  note text,
  actor_id uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

create table public.stock_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  cycle_id uuid not null,
  product_id uuid not null,
  units int not null check (units > 0),
  status public.reservation_status not null default 'active',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (cycle_id, product_id) references public.inventory_units (cycle_id, product_id)
);
create index stock_reservations_active_idx on public.stock_reservations (expires_at) where status = 'active';

create table public.inventory_movements (
  id bigint generated always as identity primary key,
  cycle_id uuid not null,
  product_id uuid not null,
  kind public.movement_kind not null,
  units int not null,
  order_id uuid references public.orders (id) on delete set null,
  reason text,
  actor_id uuid references auth.users (id),
  created_at timestamptz not null default now(),
  foreign key (cycle_id, product_id) references public.inventory_units (cycle_id, product_id)
);

-- ---------------------------------------------------------------------------
-- Paiements
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider public.payment_provider not null,
  provider_session_id text,
  provider_reference text,
  amount_fcfa int not null check (amount_fcfa > 0),
  currency text not null default 'XOF' check (currency = 'XOF'),
  status public.payment_status not null default 'pending',
  checkout_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_session_id)
);
create index payments_order_idx on public.payments (order_id);
create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();

-- Journal technique des webhooks. L'unicité (provider, event_id) garantit l'idempotence.
create table public.payment_events (
  id bigint generated always as identity primary key,
  provider public.payment_provider not null,
  event_id text not null,
  event_type text not null,
  payment_id uuid references public.payments (id) on delete set null,
  signature_valid boolean not null,
  outcome text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);

-- ---------------------------------------------------------------------------
-- Sur-mesure
-- ---------------------------------------------------------------------------
create table public.custom_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  user_id uuid references auth.users (id) on delete set null,
  status public.custom_request_status not null default 'received',
  occasion text not null,
  event_at timestamptz not null,
  guests int check (guests is null or guests > 0),
  ambiance text,
  budget_range text,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  fulfillment public.fulfillment_method,
  address_line text,
  notes text,
  quoted_total_fcfa int check (quoted_total_fcfa is null or quoted_total_fcfa >= 0),
  order_id uuid references public.orders (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger custom_requests_touch before update on public.custom_requests
  for each row execute function public.touch_updated_at();

create table public.custom_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.custom_requests (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  description text not null,
  quantity int check (quantity is null or quantity > 0)
);

create table public.custom_request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.custom_requests (id) on delete cascade,
  author_id uuid references auth.users (id),
  from_staff boolean not null default false,
  body text not null,
  attachment_path text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Notifications, avis, journal
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  new_cycle boolean not null default false,
  order_updates boolean not null default true,
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'sms', 'email')),
  updated_at timestamptz not null default now()
);

-- Avis : uniquement de vrais clients ayant commandé, publiés après modération.
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  body text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  unique (order_id, product_id)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id),
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);
