-- E-mails : envoi fiable et diagnostiquable.
--   * états explicites de la file : pending (à envoyer), sending (réservé par un processus),
--     sent, held (en pause : configuration du service à corriger), failed (échec définitif), skipped ;
--   * réservation atomique (FOR UPDATE SKIP LOCKED) : deux processus n'envoient jamais le même message ;
--   * nouvelle tentative datée (next_attempt_at), identifiant du message chez le prestataire ;
--   * journal des vérifications et échecs du prestataire, nettoyé : jamais de clé, d'en-tête ni de mot de passe.
-- Seules les tables du système de notifications sont touchées.

alter table public.email_outbox drop constraint email_outbox_status_check;
alter table public.email_outbox add constraint email_outbox_status_check
  check (status in ('pending', 'sending', 'sent', 'held', 'failed', 'skipped'));

alter table public.email_outbox
  add column next_attempt_at timestamptz,
  add column claimed_at timestamptz,
  add column provider_message_id text check (char_length(provider_message_id) <= 200),
  add column error_category text check (char_length(error_category) <= 40),
  add column error_http_status int,
  add column error_provider_code text check (char_length(error_provider_code) <= 80),
  add column updated_at timestamptz not null default now();

drop index if exists public.email_outbox_pending_idx;
create index email_outbox_due_idx on public.email_outbox (status, next_attempt_at, created_at) where status in ('pending', 'sending');

-- Journal du prestataire : tests de connexion et résultats d'envoi (succès ou échec), sans aucun secret.
create table public.email_provider_checks (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('test', 'send')),
  provider text not null check (provider in ('brevo', 'resend')),
  ok boolean not null,
  category text check (char_length(category) <= 40),
  http_status int,
  provider_code text check (char_length(provider_code) <= 80),
  message text check (char_length(message) <= 300),
  outbox_id bigint references public.email_outbox (id) on delete set null,
  template text,
  attempts int,
  environment text not null check (char_length(environment) <= 20),
  deployment text check (char_length(deployment) <= 80),
  actor uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index email_provider_checks_recent_idx on public.email_provider_checks (created_at desc);

alter table public.email_provider_checks enable row level security;
alter table public.email_provider_checks force row level security;
revoke all on table public.email_provider_checks from anon, authenticated;
grant select, insert on table public.email_provider_checks to service_role;

-- Réservation atomique des messages dus. Chaque ligne réservée passe en « sending » ;
-- un second processus concurrent ne peut ni la voir en « pending » ni la verrouiller.
create or replace function public.claim_email_outbox(p_limit int)
returns setof public.email_outbox language sql security definer set search_path = '' as $$
  update public.email_outbox o
     set status = 'sending', claimed_at = now(), attempts = o.attempts + 1, updated_at = now()
   where o.id in (
     select id from public.email_outbox
      where status = 'pending' and (next_attempt_at is null or next_attempt_at <= now())
      order by created_at
      limit greatest(1, least(coalesce(p_limit, 25), 100))
      for update skip locked)
  returning o.*;
$$;

-- Réservation interrompue (processus arrêté pendant l'envoi) : on ne sait pas si le prestataire
-- a reçu le message. Jamais renvoyé automatiquement : échec à vérifier par l'équipe.
create or replace function public.release_stale_email_claims(p_minutes int default 15)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
begin
  update public.email_outbox
     set status = 'failed', error_category = 'unknown_outcome', updated_at = now(),
         last_error = 'Envoi interrompu : vérifier dans le journal du prestataire avant de réessayer.'
   where status = 'sending' and claimed_at < now() - make_interval(mins => greatest(p_minutes, 5));
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Reprise manuelle de messages choisis (en pause ou en échec) : même clé d'idempotence, même ligne.
-- Un message déjà envoyé n'est jamais repris.
create or replace function public.admin_retry_emails(p_ids bigint[], p_actor uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
begin
  update public.email_outbox
     set status = 'pending', next_attempt_at = null, claimed_at = null, updated_at = now(),
         error_category = 'retry_requested'
   where id = any(p_ids) and status in ('held', 'failed');
  get diagnostics v_count = row_count;
  if v_count > 0 then
    perform public.write_audit(p_actor, 'email.retry', 'email_outbox', array_to_string(p_ids, ','), jsonb_build_object('count', v_count));
  end if;
  return v_count;
end $$;

-- Abandon volontaire de messages choisis (en pause ou en échec) : ils ne partiront jamais.
create or replace function public.admin_skip_emails(p_ids bigint[], p_actor uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
begin
  update public.email_outbox
     set status = 'skipped', next_attempt_at = null, updated_at = now(),
         last_error = 'Abandonné par l''équipe.'
   where id = any(p_ids) and status in ('held', 'failed');
  get diagnostics v_count = row_count;
  if v_count > 0 then
    perform public.write_audit(p_actor, 'email.skip', 'email_outbox', array_to_string(p_ids, ','), jsonb_build_object('count', v_count));
  end if;
  return v_count;
end $$;

revoke all on function public.claim_email_outbox(int) from public, anon, authenticated;
revoke all on function public.release_stale_email_claims(int) from public, anon, authenticated;
revoke all on function public.admin_retry_emails(bigint[], uuid) from public, anon, authenticated;
revoke all on function public.admin_skip_emails(bigint[], uuid) from public, anon, authenticated;
grant execute on function public.claim_email_outbox(int) to service_role;
grant execute on function public.release_stale_email_claims(int) to service_role;
grant execute on function public.admin_retry_emails(bigint[], uuid) to service_role;
grant execute on function public.admin_skip_emails(bigint[], uuid) to service_role;

-- Messages refusés avec un 401 avant ce diagnostic : mis en pause (jamais renvoyés en boucle),
-- repris uniquement par l'équipe après réparation. Clé d'idempotence conservée.
update public.email_outbox
   set status = 'held', error_category = 'auth_rejected', error_http_status = 401, updated_at = now()
 where status = 'pending' and last_error like 'Envoi refusé par Brevo (401)%';

comment on table public.email_provider_checks is
  'Tests de connexion et résultats d''envoi du prestataire d''e-mails : catégorie, code HTTP, code et message nettoyés. Jamais de clé, d''en-tête ni de mot de passe.';
