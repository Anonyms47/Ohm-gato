-- « Prévenez-moi pour la prochaine fournée » : inscription par e-mail, avec consentement explicite.
--   * une adresse = une ligne (doublons impossibles), statut actif/inactif, date et source du consentement ;
--   * jeton de désinscription personnel, sans connexion ;
--   * aucune adresse IP conservée ; tables réservées au serveur (RLS forcée, aucun accès visiteur) ;
--   * une alerte n'est jamais envoyée automatiquement : seul un administrateur la déclenche, une seule fois par fournée ;
--   * chaque destinataire a sa ligne d'envoi (en attente, réservé, envoyé, en pause, échec) : Brevo indisponible =
--     envois conservés en attente, repris plus tard, jamais doublés.
-- Migration additive : voir supabase/rollbacks/20261029000003_batch_alerts.down.sql.

create table public.batch_alert_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 160),
  status text not null default 'active' check (status in ('active', 'inactive')),
  source text not null check (source in ('accueil', 'fournees', 'carte', 'pied_de_page', 'administration', 'autre')),
  consent_at timestamptz not null default now(),
  consent_text text not null check (char_length(consent_text) between 10 and 400),
  unsubscribe_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  unsubscribed_at timestamptz,
  unsubscribed_by text check (unsubscribed_by in ('lien', 'administration')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index batch_alert_subscribers_email_key on public.batch_alert_subscribers (lower(email));
create index batch_alert_subscribers_status_idx on public.batch_alert_subscribers (status, created_at);
create trigger batch_alert_subscribers_touch before update on public.batch_alert_subscribers
  for each row execute function public.touch_updated_at();

-- Une alerte d'ouverture par fournée : le déclenchement est idempotent.
create table public.batch_alerts (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null unique references public.production_cycles (id),
  recipients int not null check (recipients >= 0),
  triggered_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.batch_alert_sends (
  id bigint generated always as identity primary key,
  alert_id uuid not null references public.batch_alerts (id) on delete cascade,
  subscriber_id uuid not null references public.batch_alert_subscribers (id) on delete cascade,
  to_email text not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'held', 'failed', 'skipped')),
  attempts int not null default 0,
  last_error text check (char_length(last_error) <= 300),
  error_category text check (char_length(error_category) <= 40),
  provider_message_id text check (char_length(provider_message_id) <= 200),
  claimed_at timestamptz,
  next_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (alert_id, subscriber_id)
);
create index batch_alert_sends_due_idx on public.batch_alert_sends (status, next_attempt_at, created_at) where status in ('pending', 'sending');
create trigger batch_alert_sends_touch before update on public.batch_alert_sends
  for each row execute function public.touch_updated_at();

do $$
declare t text;
begin
  foreach t in array array['batch_alert_subscribers', 'batch_alerts', 'batch_alert_sends'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on table public.%I to service_role', t);
  end loop;
end $$;
grant usage, select on sequence public.batch_alert_sends_id_seq to service_role;

-- Inscription : idempotente. Renvoie « created », « reactivated » ou « already ».
create or replace function public.batch_alert_subscribe(p_email text, p_source text, p_consent_text text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(p_email));
  v_row public.batch_alert_subscribers;
begin
  select * into v_row from public.batch_alert_subscribers where lower(email) = v_email for update;
  if not found then
    insert into public.batch_alert_subscribers (email, source, consent_text) values (v_email, p_source, p_consent_text);
    return 'created';
  end if;
  if v_row.status = 'active' then
    return 'already';
  end if;
  update public.batch_alert_subscribers
     set status = 'active', source = p_source, consent_at = now(), consent_text = p_consent_text,
         unsubscribed_at = null, unsubscribed_by = null
   where id = v_row.id;
  return 'reactivated';
end $$;

-- Désinscription par le lien personnel : idempotente (le lien reste valable, rien d'autre n'est modifié).
create or replace function public.batch_alert_unsubscribe(p_token text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  select id into v_id from public.batch_alert_subscribers where unsubscribe_token = p_token;
  if not found then return false; end if;
  update public.batch_alert_subscribers
     set status = 'inactive', unsubscribed_at = coalesce(unsubscribed_at, now()), unsubscribed_by = coalesce(unsubscribed_by, 'lien')
   where id = v_id and status = 'active';
  -- Les envois encore en attente pour cette personne n'auront jamais lieu.
  update public.batch_alert_sends set status = 'skipped', last_error = 'Désinscrit avant l''envoi.'
   where subscriber_id = v_id and status in ('pending', 'held');
  return true;
end $$;

create or replace function public.admin_unsubscribe_alert_subscriber(p_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.batch_alert_subscribers
     set status = 'inactive', unsubscribed_at = coalesce(unsubscribed_at, now()), unsubscribed_by = 'administration'
   where id = p_id and status = 'active';
  if not found then return; end if;
  update public.batch_alert_sends set status = 'skipped', last_error = 'Désinscrit avant l''envoi.'
   where subscriber_id = p_id and status in ('pending', 'held');
  perform public.write_audit(p_actor, 'alert.unsubscribe', 'batch_alert_subscribers', p_id::text, jsonb_build_object('by', 'administration'));
end $$;

-- Déclenchement explicite par une administratrice : une alerte par fournée ouverte, un envoi par inscrit actif.
create or replace function public.admin_trigger_batch_alert(p_cycle_id uuid, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_cycle public.production_cycles;
  v_alert_id uuid;
  v_count int;
begin
  select * into v_cycle from public.production_cycles where id = p_cycle_id for update;
  if not found or v_cycle.status <> 'open' then
    raise exception 'ALERT_CYCLE_NOT_OPEN' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.batch_alerts where cycle_id = p_cycle_id) then
    raise exception 'ALERT_ALREADY_SENT' using errcode = 'P0001';
  end if;
  select count(*) into v_count from public.batch_alert_subscribers where status = 'active';
  if v_count = 0 then
    raise exception 'ALERT_NO_SUBSCRIBERS' using errcode = 'P0001';
  end if;
  insert into public.batch_alerts (cycle_id, recipients, triggered_by) values (p_cycle_id, v_count, p_actor)
    returning id into v_alert_id;
  insert into public.batch_alert_sends (alert_id, subscriber_id, to_email)
    select v_alert_id, s.id, s.email from public.batch_alert_subscribers s where s.status = 'active';
  perform public.write_audit(p_actor, 'alert.trigger', 'batch_alerts', v_alert_id::text,
    jsonb_build_object('cycle', v_cycle.number, 'recipients', v_count));
  return jsonb_build_object('alert_id', v_alert_id, 'recipients', v_count);
end $$;

-- Réservation atomique des envois dus (deux processus n'envoient jamais le même message).
create or replace function public.claim_batch_alert_sends(p_limit int)
returns setof public.batch_alert_sends language sql security definer set search_path = '' as $$
  update public.batch_alert_sends s
     set status = 'sending', claimed_at = now(), attempts = s.attempts + 1
   where s.id in (
     select id from public.batch_alert_sends
      where status = 'pending' and (next_attempt_at is null or next_attempt_at <= now())
      order by created_at, id
      limit greatest(1, least(coalesce(p_limit, 25), 100))
      for update skip locked)
  returning s.*;
$$;

-- Réservation interrompue : on ne sait pas si le message est parti. Jamais renvoyé automatiquement.
create or replace function public.release_stale_batch_alert_claims(p_minutes int default 15)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
begin
  update public.batch_alert_sends
     set status = 'failed', error_category = 'unknown_outcome',
         last_error = 'Envoi interrompu : vérifier dans le journal du prestataire avant de réessayer.'
   where status = 'sending' and claimed_at < now() - make_interval(mins => greatest(p_minutes, 5));
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Reprise manuelle d'envois en pause ou en échec (jamais un envoi déjà réussi).
create or replace function public.admin_retry_batch_alert_sends(p_alert_id uuid, p_actor uuid)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_count int;
begin
  update public.batch_alert_sends
     set status = 'pending', next_attempt_at = null, claimed_at = null, error_category = 'retry_requested'
   where alert_id = p_alert_id and status in ('held', 'failed');
  get diagnostics v_count = row_count;
  if v_count > 0 then
    perform public.write_audit(p_actor, 'alert.retry', 'batch_alerts', p_alert_id::text, jsonb_build_object('count', v_count));
  end if;
  return v_count;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.batch_alert_subscribe(text, text, text)',
    'public.batch_alert_unsubscribe(text)',
    'public.admin_unsubscribe_alert_subscriber(uuid, uuid)',
    'public.admin_trigger_batch_alert(uuid, uuid)',
    'public.claim_batch_alert_sends(int)',
    'public.release_stale_batch_alert_claims(int)',
    'public.admin_retry_batch_alert_sends(uuid, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

comment on table public.batch_alert_subscribers is
  'Inscrits aux alertes de prochaine fournée : adresse, consentement explicite (date, texte, source), statut. Aucune adresse IP.';
