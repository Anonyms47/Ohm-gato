-- Catégorie des produits (filtres de la carte et de l'administration).
alter table public.products add column category text not null default 'patisserie'
  check (category ~ '^[a-z0-9-]+$');
update public.products set category = case slug
  when 'cookies' then 'biscuits'
  when 'brownies' then 'gateaux'
  when 'moelleux-chocolat' then 'gateaux'
  when 'moelleux-pommes' then 'gateaux'
  when 'cake-orange' then 'gateaux'
  when 'muffins-pepites' then 'gateaux'
  when 'choux-creme' then 'choux'
  when 'verrines-fruitees' then 'verrines'
  else 'patisserie' end;

-- Clients : regroupés par numéro (invités et membres), pour l'administration.
create or replace function public.admin_customers(p_query text default null)
returns table (
  phone text, name text, email text, user_id uuid, orders_count bigint, paid_total_fcfa bigint,
  last_order_at timestamptz, requests_count bigint
) language sql stable security definer set search_path = '' as $$
  with base as (
    select customer_phone as phone, customer_name as name, customer_email as email, user_id, created_at,
           case when payment_status = 'paid' then total_fcfa else 0 end as paid
    from public.orders
  ), reqs as (
    select customer_phone as phone, count(*) as n from public.custom_requests group by customer_phone
  ), agg as (
    select phone,
           (array_agg(name order by created_at desc))[1] as name,
           (array_agg(email order by created_at desc) filter (where email is not null))[1] as email,
           (array_agg(user_id order by created_at desc) filter (where user_id is not null))[1] as user_id,
           count(*) as orders_count, sum(paid) as paid_total_fcfa, max(created_at) as last_order_at
    from base group by phone
  )
  select coalesce(a.phone, r.phone), a.name, a.email, a.user_id, coalesce(a.orders_count, 0),
         coalesce(a.paid_total_fcfa, 0), a.last_order_at, coalesce(r.n, 0)
  from agg a full join reqs r on r.phone = a.phone
  where p_query is null or p_query = ''
     or coalesce(a.phone, r.phone) ilike '%' || p_query || '%'
     or a.name ilike '%' || p_query || '%'
  order by a.last_order_at desc nulls last
  limit 300;
$$;
revoke all on function public.admin_customers(text) from public, anon, authenticated;
grant execute on function public.admin_customers(text) to service_role;

-- Nombre d'unités disponibles par fournée, pour le tableau de bord et le stock.
create or replace view public.inventory_overview with (security_invoker = true) as
  select i.cycle_id, i.product_id, p.name as product_name, p.unit_label_plural, i.total_units, i.reserved_units, i.sold_units,
         greatest(i.total_units - i.reserved_units - i.sold_units, 0) as available_units
  from public.inventory_units i join public.products p on p.id = i.product_id;
