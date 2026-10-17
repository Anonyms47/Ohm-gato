-- Codes de connexion par e-mail (envoyés par Supabase Auth via le SMTP Brevo, hors de l'application) :
-- seuls les refus d'envoi sont notés ici (date, catégorie, code HTTP). Jamais d'adresse, de code ni de secret.
-- Les envois réussis et les codes validés se lisent déjà dans otp_requests.
create table public.login_email_failures (
  id bigint generated always as identity primary key,
  category text not null check (category in ('smtp_failed', 'rate_limited')),
  http_status int,
  created_at timestamptz not null default now()
);
create index login_email_failures_recent_idx on public.login_email_failures (created_at desc);

alter table public.login_email_failures enable row level security;
alter table public.login_email_failures force row level security;
revoke all on table public.login_email_failures from anon, authenticated;
grant select, insert on table public.login_email_failures to service_role;
