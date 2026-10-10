-- OHMEGATO — première fournée : semaine du 19 octobre 2026 (créée en brouillon).
--
-- Date limite de précommande : dimanche 18 octobre 2026 à 23 h 59, heure de Dakar (UTC+0).
-- Production : organisée sur trois jours pendant la semaine du 19 octobre (dates exactes non fixées).
-- Jour principal de livraison et de retrait : vendredi 23 octobre 2026.
-- Brouillon : invisible des clients. Alima vérifie produits, capacités, créneaux et leur capacité,
-- puis ouvre elle-même les précommandes. Aucune capacité ni aucun créneau n'est inventé ici.
-- Rejouable sans doublon.

insert into public.production_cycles (
  number, title, message, opens_at, closes_at, production_date, production_days, production_dates,
  fulfillment_date, status, palette
)
select 1, 'Fournée de la semaine du 19 octobre', null,
  timestamptz '2026-10-10 00:00:00+00', timestamptz '2026-10-18 23:59:00+00',
  date '2026-10-19', 3, '{}', date '2026-10-23', 'draft', 'caramel'
where not exists (select 1 from public.production_cycles where number = 1);

-- Produits proposés : la carte active, tous formats et parfums ; Alima ajuste avant l'ouverture.
insert into public.cycle_products (cycle_id, product_id, sort_order)
select c.id, p.id, p.sort_order
from public.production_cycles c
cross join public.products p
where c.number = 1 and c.status = 'draft' and p.is_active
on conflict do nothing;
