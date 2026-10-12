-- Atelier : automatisations traçables et idempotentes.
--   * notifications internes (une seule par sujet grâce à une clé de déduplication) ;
--   * file d'e-mails transactionnels (une seule ligne par événement, jamais deux envois) ;
--   * journal des exécutions automatiques.
-- Aucune donnée existante n'est modifiée. Aucun accès client : serveur uniquement (clé service).

create table public.admin_notifications (
  id bigint generated always as identity primary key,
  dedupe_key text not null unique,
  kind text not null,
  priority text not null check (priority in ('urgent', 'today', 'soon', 'info')),
  title text not null check (char_length(title) <= 200),
  detail text check (char_length(detail) <= 400),
  href text not null check (href like '/admin%'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  read_at timestamptz,
  done_at timestamptz
);
create index admin_notifications_open_idx on public.admin_notifications (done_at, priority, created_at desc);

create table public.email_outbox (
  id bigint generated always as identity primary key,
  idempotency_key text not null unique,
  template text not null check (template in (
    'order_registered', 'payment_confirmed', 'order_preparing', 'order_ready', 'pickup_ready',
    'out_for_delivery', 'order_cancelled', 'refund_recorded', 'admin_digest'
  )),
  order_id uuid references public.orders (id) on delete cascade,
  to_email text not null check (to_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'sent', 'skipped', 'failed')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_outbox_pending_idx on public.email_outbox (status, created_at) where status = 'pending';

create table public.automation_runs (
  id bigint generated always as identity primary key,
  job text not null,
  trigger text not null check (trigger in ('cron', 'visite', 'action')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  result jsonb not null default '{}'
);
create index automation_runs_job_idx on public.automation_runs (job, started_at desc);

alter table public.admin_notifications enable row level security;
alter table public.email_outbox enable row level security;
alter table public.automation_runs enable row level security;
revoke all on table public.admin_notifications, public.email_outbox, public.automation_runs from anon, authenticated;
grant select, insert, update on table public.admin_notifications, public.email_outbox, public.automation_runs to service_role;

-- ---------------------------------------------------------------------------
-- E-mails transactionnels : mis en file par la base au moment même où l'étape change,
-- avec une clé unique par événement. Rejouer une action ne crée jamais un second e-mail.
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_order_email(p_order_id uuid, p_template text, p_key text, p_payload jsonb default '{}')
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
begin
  select nullif(trim(customer_email), '') into v_email from public.orders where id = p_order_id;
  if v_email is null or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return; end if;
  insert into public.email_outbox (idempotency_key, template, order_id, to_email, payload)
  values (p_key, p_template, p_order_id, v_email, coalesce(p_payload, '{}'))
  on conflict (idempotency_key) do nothing;
end $$;
revoke all on function public.enqueue_order_email(uuid, text, text, jsonb) from public, anon, authenticated;

create or replace function public.orders_email_events()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Paiement vérifié (Wave à la main) ou confirmé par le prestataire.
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    perform public.enqueue_order_email(new.id, 'payment_confirmed', 'order:' || new.id || ':paid');
  end if;
  if new.status is distinct from old.status then
    case new.status
      when 'confirmed' then
        -- Commande enregistrée (choix de Wave : paiement encore à vérifier).
        if new.payment_status <> 'paid' then
          perform public.enqueue_order_email(new.id, 'order_registered', 'order:' || new.id || ':registered');
        end if;
      when 'preparing' then
        perform public.enqueue_order_email(new.id, 'order_preparing', 'order:' || new.id || ':preparing');
      when 'ready' then
        perform public.enqueue_order_email(new.id, case when new.fulfillment = 'pickup' then 'pickup_ready' else 'order_ready' end, 'order:' || new.id || ':ready');
      when 'out_for_delivery' then
        perform public.enqueue_order_email(new.id, 'out_for_delivery', 'order:' || new.id || ':out_for_delivery');
      when 'cancelled' then
        perform public.enqueue_order_email(new.id, 'order_cancelled', 'order:' || new.id || ':cancelled');
      else null;
    end case;
  end if;
  return new;
end $$;

create trigger orders_email_events after update of status, payment_status on public.orders
  for each row execute function public.orders_email_events();

create or replace function public.order_refunds_email_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.enqueue_order_email(new.order_id, 'refund_recorded', 'refund:' || new.id,
    jsonb_build_object('amount_fcfa', new.amount_fcfa, 'method', new.method));
  return new;
end $$;

create trigger order_refunds_email_event after insert on public.order_refunds
  for each row execute function public.order_refunds_email_event();

comment on table public.email_outbox is
  'E-mails transactionnels à envoyer. idempotency_key unique : un événement = un e-mail au plus. Envoyés par le serveur si un service d''e-mail est configuré ; sinon ils restent en attente (jamais de faux envoi).';
comment on table public.admin_notifications is
  'Centre de notifications de l''atelier. dedupe_key unique : une notification par sujet, mise à jour plutôt que dupliquée ; done_at quand l''action n''est plus nécessaire.';
