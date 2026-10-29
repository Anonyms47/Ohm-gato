drop function if exists public.admin_import_delivery_zones(jsonb, uuid);
-- Les commandes gardent leurs colonnes de zone (zone_id, delivery_fee_fcfa) ; seul l'instantané du nom est retiré.
drop trigger if exists orders_freeze_delivery_pricing on public.orders;
drop trigger if exists orders_apply_delivery_zone on public.orders;
drop function if exists public.orders_freeze_delivery_pricing();
drop function if exists public.orders_apply_delivery_zone();
alter table public.orders drop column if exists delivery_zone_name;
drop trigger if exists delivery_zones_districts on public.delivery_zones;
drop trigger if exists delivery_zones_touch on public.delivery_zones;
drop function if exists public.delivery_zones_check_districts();
alter table public.delivery_zones
  drop constraint if exists delivery_zones_districts_len,
  drop constraint if exists delivery_zones_name_len,
  drop column if exists updated_at,
  drop column if exists note;
drop function if exists public.normalize_place(text);
