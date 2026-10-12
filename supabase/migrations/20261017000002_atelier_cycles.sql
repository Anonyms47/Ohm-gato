-- Atelier : fournée créée depuis la précédente, traces d'impression de la fiche de production.
-- Aucune donnée existante n'est modifiée.

-- ---------------------------------------------------------------------------
-- Nouvelle fournée (brouillon) reprenant les produits, formats, parfums et créneaux de précommande
-- d'une fournée existante. Les créneaux sont décalés du même nombre de jours que le jour de livraison.
-- Rien n'est ouvert : la fournée reste un brouillon jusqu'à l'ouverture manuelle par Alima.
-- ---------------------------------------------------------------------------
create or replace function public.admin_duplicate_cycle(
  p_source uuid,
  p_number int,
  p_opens_at timestamptz,
  p_closes_at timestamptz,
  p_production_date date,
  p_fulfillment_date date,
  p_actor uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_source public.production_cycles;
  v_id uuid;
  v_shift int;
begin
  select * into v_source from public.production_cycles where id = p_source;
  if not found then perform public.raise_order_error('CYCLE_NOT_FOUND'); end if;
  if p_number is null or p_number < 1 or p_closes_at <= p_opens_at or p_fulfillment_date < p_production_date then
    perform public.raise_order_error('CYCLE_DATES_INVALID');
  end if;
  v_shift := p_fulfillment_date - v_source.fulfillment_date;

  insert into public.production_cycles (
    number, title, message, opens_at, closes_at, production_date, production_days, production_dates,
    fulfillment_date, capacity_units, status, featured_product_id, palette, surplus_delivery_allowed
  ) values (
    p_number, 'Fournée n°' || p_number, v_source.message, p_opens_at, p_closes_at, p_production_date,
    v_source.production_days, '{}', p_fulfillment_date, v_source.capacity_units, 'draft',
    v_source.featured_product_id, v_source.palette, v_source.surplus_delivery_allowed
  ) returning id into v_id;

  insert into public.cycle_products (cycle_id, product_id, disabled_variant_ids, available_flavor_ids, sort_order)
  select v_id, cp.product_id, cp.disabled_variant_ids, cp.available_flavor_ids, cp.sort_order
  from public.cycle_products cp
  join public.products p on p.id = cp.product_id and p.is_active
  where cp.cycle_id = p_source;

  insert into public.delivery_slots (cycle_id, kind, starts_at, ends_at, capacity_orders, is_active, phase)
  select v_id, s.kind, s.starts_at + make_interval(days => v_shift), s.ends_at + make_interval(days => v_shift), s.capacity_orders, true, 'preorder'
  from public.delivery_slots s
  where s.cycle_id = p_source and s.phase = 'preorder' and s.is_active;

  perform public.write_audit(p_actor, 'cycle.duplicate', 'production_cycles', v_id::text,
    jsonb_build_object('source', p_source, 'number', p_number, 'shift_days', v_shift));
  return v_id;
end $$;

revoke all on function public.admin_duplicate_cycle(uuid, int, timestamptz, timestamptz, date, date, uuid) from public, anon, authenticated;
grant execute on function public.admin_duplicate_cycle(uuid, int, timestamptz, timestamptz, date, date, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Impressions de la fiche de production : quantités figées au moment de l'impression.
-- ---------------------------------------------------------------------------
create table public.production_sheet_prints (
  id bigint generated always as identity primary key,
  cycle_id uuid not null references public.production_cycles (id) on delete cascade,
  printed_by uuid references auth.users (id) on delete set null,
  printed_at timestamptz not null default now(),
  snapshot jsonb not null
);

create index production_sheet_prints_cycle_idx on public.production_sheet_prints (cycle_id, printed_at desc);

alter table public.production_sheet_prints enable row level security;
revoke all on table public.production_sheet_prints from anon, authenticated;
grant select, insert on table public.production_sheet_prints to service_role;

comment on table public.production_sheet_prints is
  'Chaque impression de la fiche de production et les quantités affichées à ce moment (commandes payées, paiements à vérifier, supplément).';
