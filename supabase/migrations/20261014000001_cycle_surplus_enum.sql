-- OHMEGATO — fournées en précommande puis surplus : nouvelles valeurs d'énumération.
-- (Séparées : une valeur ajoutée ne peut pas être utilisée dans la même transaction.)
--
-- Correspondance avec la logique officielle des fournées :
--   draft = brouillon · scheduled = annoncée · open = précommandes ouvertes
--   closed = précommandes clôturées · preparing = production en cours
--   delivering = retraits et livraisons des commandes confirmées
--   surplus = surplus réellement disponible (publié par Alima) · done = terminée · cancelled = annulée

alter type public.cycle_status add value if not exists 'surplus' after 'delivering';

-- Mouvements de stock propres au surplus.
alter type public.movement_kind add value if not exists 'surplus_publish';
alter type public.movement_kind add value if not exists 'surplus_withdraw';
alter type public.movement_kind add value if not exists 'withhold';
