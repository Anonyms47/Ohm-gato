-- OHMEGATO — droits des fonctions internes.
--
-- Rejoue le verrouillage des fonctions de commande (absent de la base de production lors
-- de sa mise en place) et ferme l'appel direct des fonctions de déclencheur. Seules
-- restent publiques cycle_slot_status (créneaux), is_admin et has_staff_role (RLS).
do $$
declare f text;
begin
  foreach f in array array[
    'public.random_code(int)',
    'public.raise_order_error(text, jsonb)',
    'public.release_order_reservations(uuid, text)',
    'public.expire_stale_orders()',
    'public.attach_payment_session(uuid, text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
  foreach f in array array[
    'public.handle_new_user()',
    'public.sync_profile_contact()',
    'public.sync_custom_request_payment()',
    'public.touch_updated_at()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

alter function public.touch_updated_at() set search_path = '';
