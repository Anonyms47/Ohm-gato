-- OHMEGATO — comptes clients : connexion par code temporaire, carnet, consentements.
--
-- Connexion : Supabase Auth gère le code (usage unique, expiration). Le « Send SMS hook »
-- dépose le code dans otp_outbox ; le serveur Next.js le remet aussitôt au canal configuré
-- (WhatsApp ou SMS) puis l'efface. otp_requests sert à la limitation des tentatives et à
-- distinguer un code expiré d'un code incorrect.

-- ---------------------------------------------------------------------------
-- Boîte d'envoi des codes (lue et vidée par le serveur uniquement)
-- ---------------------------------------------------------------------------
create table public.otp_outbox (
  id bigint generated always as identity primary key,
  phone text not null,
  otp text not null,
  created_at timestamptz not null default now()
);
create index otp_outbox_phone_idx on public.otp_outbox (phone, created_at desc);

create or replace function public.hook_send_sms(event jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  insert into public.otp_outbox (phone, otp)
    values (event #>> '{user,phone}', event #>> '{sms,otp}');
  -- Un code non remis en 10 minutes ne sert plus à rien : on ne le garde pas.
  delete from public.otp_outbox where created_at < now() - interval '10 minutes';
  return '{}'::jsonb;
end $$;

revoke all on function public.hook_send_sms(jsonb) from public, anon, authenticated;
grant execute on function public.hook_send_sms(jsonb) to supabase_auth_admin;

-- Demandes de code : destination hachée (aucun numéro en clair dans ce journal).
create table public.otp_requests (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('phone', 'email')),
  destination_hash text not null,
  failed_attempts int not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index otp_requests_destination_idx on public.otp_requests (destination_hash, created_at desc);

-- Boîte de test : messages « envoyés » quand aucun canal réel n'est configuré
-- (OTP_TEST_MODE, interdit en production). Jamais lisible depuis le navigateur.
create table public.test_messages (
  id bigint generated always as identity primary key,
  channel text not null,
  destination text not null,
  body text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profil, consentements, adresses
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column order_updates_consent boolean not null default true,
  add column consents_updated_at timestamptz;

alter table public.addresses
  add column is_default boolean not null default false,
  add column updated_at timestamptz not null default now();
create trigger addresses_touch before update on public.addresses
  for each row execute function public.touch_updated_at();
create index addresses_user_idx on public.addresses (user_id);

-- Le profil reprend le téléphone / l'e-mail vérifiés du compte.
create or replace function public.sync_profile_contact()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles
    set phone = coalesce(new.phone, phone), email = coalesce(new.email, email)
    where id = new.id;
  return new;
end $$;
create trigger on_auth_user_contact_changed
  after update of phone, email on auth.users
  for each row execute function public.sync_profile_contact();

-- ---------------------------------------------------------------------------
-- Commandes invitées retrouvées : rattachées au compte dont le numéro est vérifié
-- ---------------------------------------------------------------------------
create or replace function public.claim_guest_orders(p_user_id uuid, p_phone text)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if p_phone is null or p_phone = '' then return 0; end if;
  update public.orders set user_id = p_user_id
    where user_id is null and customer_phone = p_phone;
  get diagnostics n = row_count;
  update public.custom_requests set user_id = p_user_id
    where user_id is null and customer_phone = p_phone;
  return n;
end $$;
revoke all on function public.claim_guest_orders(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_guest_orders(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Sessions de l'utilisateur connecté (lecture et révocation des siennes uniquement)
-- ---------------------------------------------------------------------------
create or replace function public.my_sessions()
returns table (id uuid, created_at timestamptz, updated_at timestamptz, user_agent text, ip text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.created_at, s.updated_at, s.user_agent, host(s.ip)
  from auth.sessions s
  where s.user_id = auth.uid()
  order by coalesce(s.updated_at, s.created_at) desc;
$$;
revoke all on function public.my_sessions() from public, anon;
grant execute on function public.my_sessions() to authenticated;

create or replace function public.revoke_my_session(p_session_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  delete from auth.sessions where id = p_session_id and user_id = auth.uid();
  return found;
end $$;
revoke all on function public.revoke_my_session(uuid) from public, anon;
grant execute on function public.revoke_my_session(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS complémentaires
-- ---------------------------------------------------------------------------
alter table public.otp_outbox enable row level security;
alter table public.otp_outbox force row level security;
alter table public.otp_requests enable row level security;
alter table public.otp_requests force row level security;
alter table public.test_messages enable row level security;
alter table public.test_messages force row level security;
-- Aucune politique : inaccessibles hors service_role.

-- Le client voit les paiements de ses propres commandes.
create policy "paiements personnels" on public.payments
  for select using (exists (
    select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()
  ));

-- Un seul profil par compte, créé par le déclencheur ; le client peut le compléter.
create policy "profil créé" on public.profiles
  for insert with check (id = auth.uid());

-- Échec de vérification : compteur incrémenté de façon atomique.
create or replace function public.otp_register_failure(p_request_id uuid)
returns int language sql security definer set search_path = '' as $$
  update public.otp_requests set failed_attempts = failed_attempts + 1
    where id = p_request_id
    returning failed_attempts;
$$;
revoke all on function public.otp_register_failure(uuid) from public, anon, authenticated;
grant execute on function public.otp_register_failure(uuid) to service_role;
