-- Remet les deux fonctions de paiement telles qu'avant (mentions « Wave » fixes) : voir 20261010000002_wave_link.sql.
drop function if exists public.confirm_order_awaiting_payment_link(uuid, uuid, text);
drop table if exists public.payment_method_settings;
-- Puis rejouer les définitions de confirm_order_awaiting_wave et admin_record_payment de 20261010000002_wave_link.sql.
