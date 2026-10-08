-- ⚠️ DONNÉES DE TEST — développement et tests automatisés uniquement.
-- Ne jamais exécuter en production : zones, tarifs, créneaux et stocks sont fictifs.
-- Les vraies valeurs se saisissent dans /admin.

insert into public.delivery_zones (name, districts, fee_fcfa, sort_order) values
  ('TEST — Zone A', '{"Sud Foire","Cité Sonatel 2","Ouest Foire","Yoff"}', 1000, 1),
  ('TEST — Zone B', '{"Mermoz","Sacré-Cœur","Point E","Fann","Liberté 6"}', 1500, 2),
  ('TEST — Zone C', '{"Plateau","Médina","Almadies","Ngor","Ouakam"}', 2000, 3),
  ('TEST — Zone sur devis', '{"Rufisque","Keur Massar"}', null, 4);

-- Fournée ouverte, dates relatives pour rester valide après chaque `db reset`.
insert into public.production_cycles
  (id, number, title, message, opens_at, closes_at, production_date, fulfillment_date, status, featured_product_id, palette)
select
  '00000000-0000-4000-8000-000000000012', 12, 'Fournée n°12',
  'TEST — Message de fournée à remplacer depuis l’administration.',
  now() - interval '1 day', now() + interval '2 days',
  (now() + interval '2 days')::date, (now() + interval '3 days')::date,
  'open', p.id, 'chocolate'
from public.products p where p.slug = 'moelleux-chocolat';

-- Fournée passée pour les archives.
insert into public.production_cycles
  (id, number, title, opens_at, closes_at, production_date, fulfillment_date, status, palette)
values
  ('00000000-0000-4000-8000-000000000011', 11, 'Fournée n°11',
   now() - interval '6 days', now() - interval '4 days',
   (now() - interval '4 days')::date, (now() - interval '3 days')::date, 'done', 'caramel');

insert into public.cycle_products (cycle_id, product_id, sort_order, available_flavor_ids)
select '00000000-0000-4000-8000-000000000012', p.id, p.sort_order,
       case when p.slug = 'verrines-fruitees'
         then (select array_agg(f.id) from public.flavors f where f.slug in ('fraise', 'mangue'))
       end
from public.products p
where p.slug <> 'moelleux-pommes'; -- hors fournée, pour tester cet état

insert into public.inventory_units (cycle_id, product_id, total_units)
select '00000000-0000-4000-8000-000000000012', p.id,
  case p.slug
    when 'cookies' then 60
    when 'brownies' then 144
    when 'moelleux-chocolat' then 24
    when 'muffins-pepites' then 36
    when 'cake-orange' then 40
    when 'choux-creme' then 50
    when 'verrines-fruitees' then 3     -- presque épuisé
    else 0
  end
from public.products p
join public.cycle_products cp on cp.product_id = p.id
  and cp.cycle_id = '00000000-0000-4000-8000-000000000012';

insert into public.inventory_movements (cycle_id, product_id, kind, units, reason)
select cycle_id, product_id, 'initial', total_units, 'TEST — stock initial'
from public.inventory_units where cycle_id = '00000000-0000-4000-8000-000000000012';

insert into public.delivery_slots (cycle_id, kind, starts_at, ends_at, capacity_orders)
select '00000000-0000-4000-8000-000000000012', k.kind::public.slot_kind,
       (now() + interval '3 days')::date + k.start_at,
       (now() + interval '3 days')::date + k.end_at,
       k.cap
from (values
  ('delivery', time '08:00', time '10:00', 15),
  ('delivery', time '10:00', time '12:00', 15),
  ('pickup',   time '09:00', time '12:00', null),
  ('pickup',   time '15:00', time '18:00', null)
) as k(kind, start_at, end_at, cap);
