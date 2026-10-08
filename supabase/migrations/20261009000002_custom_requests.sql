-- OHMEGATO — Sur-mesure & Événements.
-- Une demande n'est jamais une commande : elle le devient seulement quand le client
-- accepte une proposition dont le prix a été fixé par OHMEGATO. Le paiement porte
-- alors sur une commande liée (orders.custom_request_id), sans fournée ni stock.

create type public.custom_proposal_status as enum ('sent', 'accepted', 'declined', 'superseded', 'withdrawn');

alter table public.custom_requests
  add column idempotency_key uuid unique,
  add column tracking_token_hash text unique,
  add column wanted_kinds text[] not null default '{}',
  add column personalization text,
  add column budget_fcfa int check (budget_fcfa is null or budget_fcfa >= 0),
  add column district text,
  add column landmark text,
  add column recipient_name text,
  add column recipient_phone text,
  add column latitude numeric(9, 6) check (latitude between -90 and 90),
  add column longitude numeric(9, 6) check (longitude between -180 and 180);

-- Note interne d'OHMEGATO sur une demande : table à part, jamais lisible par le client
-- (la RLS d'une ligne de custom_requests exposerait toutes ses colonnes au propriétaire).
create table public.custom_request_internal_notes (
  request_id uuid primary key references public.custom_requests (id) on delete cascade,
  body text not null default '',
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);
create index custom_requests_user_idx on public.custom_requests (user_id);
create index custom_requests_status_idx on public.custom_requests (status, event_at);

alter table public.custom_request_items
  add column kind text not null default 'creation'
    check (kind in ('verrines', 'brownies-mms', 'muffins-fruites', 'choux', 'gateau-entier', 'standard', 'creation')),
  add column format text,
  add column flavors text;

create table public.custom_request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.custom_requests (id) on delete cascade,
  message_id uuid references public.custom_request_messages (id) on delete set null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 5242880),
  original_name text not null,
  from_staff boolean not null default false,
  created_at timestamptz not null default now()
);
create index custom_request_attachments_request_idx on public.custom_request_attachments (request_id);

create table public.custom_proposals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.custom_requests (id) on delete cascade,
  version int not null,
  body text not null,
  lines jsonb not null default '[]',
  total_fcfa int not null check (total_fcfa > 0),
  valid_until date,
  status public.custom_proposal_status not null default 'sent',
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (request_id, version)
);

create table public.custom_request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.custom_requests (id) on delete cascade,
  status public.custom_request_status not null,
  note text,
  actor_id uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index custom_request_events_request_idx on public.custom_request_events (request_id, created_at);

create index custom_request_messages_request_idx on public.custom_request_messages (request_id, created_at);

-- Commande issue d'une proposition acceptée : ni fournée, ni créneau, ni stock.
alter table public.orders
  alter column cycle_id drop not null,
  alter column slot_id drop not null,
  add column custom_request_id uuid unique references public.custom_requests (id),
  add constraint orders_kind_check check (
    custom_request_id is not null or (cycle_id is not null and slot_id is not null)
  );
alter table public.orders drop constraint if exists orders_check;
alter table public.orders add constraint orders_delivery_address_check
  check (fulfillment = 'pickup' or custom_request_id is not null or (address_line is not null and recipient_phone is not null));

-- ---------------------------------------------------------------------------
-- Création d'une demande (serveur uniquement, idempotente)
-- ---------------------------------------------------------------------------
create or replace function public.create_custom_request(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_existing public.custom_requests;
  v_id uuid := gen_random_uuid();
  v_reference text;
  v_item jsonb;
begin
  select * into v_existing from public.custom_requests where idempotency_key = (p ->> 'idempotency_key')::uuid;
  if found then
    return jsonb_build_object('request_id', v_existing.id, 'reference', v_existing.reference, 'replayed', true);
  end if;
  if jsonb_typeof(p -> 'items') <> 'array' or jsonb_array_length(p -> 'items') = 0 then
    perform public.raise_order_error('EMPTY_REQUEST');
  end if;
  if jsonb_array_length(p -> 'items') > 12 then
    perform public.raise_order_error('TOO_MANY_LINES');
  end if;
  if (p ->> 'event_at')::timestamptz < now() + interval '47 hours' then
    perform public.raise_order_error('EVENT_TOO_SOON');
  end if;

  loop
    v_reference := 'SM-' || public.random_code(6);
    exit when not exists (select 1 from public.custom_requests where reference = v_reference);
  end loop;

  insert into public.custom_requests (
    id, reference, idempotency_key, tracking_token_hash, user_id, status, occasion, event_at, guests,
    ambiance, personalization, budget_fcfa, wanted_kinds, customer_name, customer_phone, customer_email,
    fulfillment, address_line, district, landmark, recipient_name, recipient_phone, latitude, longitude, notes
  ) values (
    v_id, v_reference, (p ->> 'idempotency_key')::uuid, p ->> 'tracking_token_hash', (p ->> 'user_id')::uuid,
    'received', p ->> 'occasion', (p ->> 'event_at')::timestamptz, (p ->> 'guests')::int,
    nullif(p ->> 'ambiance', ''), nullif(p ->> 'personalization', ''), (p ->> 'budget_fcfa')::int,
    coalesce((select array_agg(distinct e ->> 'kind') from jsonb_array_elements(p -> 'items') e), '{}'),
    p #>> '{customer,name}', p #>> '{customer,phone}', nullif(p #>> '{customer,email}', ''),
    (p ->> 'fulfillment')::public.fulfillment_method,
    nullif(p #>> '{delivery,address_line}', ''), nullif(p #>> '{delivery,district}', ''),
    nullif(p #>> '{delivery,landmark}', ''), nullif(p #>> '{delivery,recipient_name}', ''),
    nullif(p #>> '{delivery,recipient_phone}', ''),
    (p #>> '{delivery,latitude}')::numeric, (p #>> '{delivery,longitude}')::numeric,
    nullif(p ->> 'notes', '')
  );

  for v_item in select * from jsonb_array_elements(p -> 'items') loop
    insert into public.custom_request_items (request_id, product_id, kind, description, format, flavors, quantity)
    values (
      v_id,
      (select id from public.products where slug = v_item ->> 'product_slug'),
      v_item ->> 'kind',
      coalesce(nullif(v_item ->> 'description', ''), v_item ->> 'kind'),
      nullif(v_item ->> 'format', ''),
      nullif(v_item ->> 'flavors', ''),
      (v_item ->> 'quantity')::int
    );
  end loop;

  insert into public.custom_request_events (request_id, status, note) values (v_id, 'received', 'Demande envoyée');
  return jsonb_build_object('request_id', v_id, 'reference', v_reference, 'replayed', false);
end $$;

-- ---------------------------------------------------------------------------
-- Changement de statut journalisé
-- ---------------------------------------------------------------------------
create or replace function public.set_custom_request_status(
  p_request_id uuid, p_status public.custom_request_status, p_note text, p_actor uuid
) returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.custom_requests set status = p_status where id = p_request_id;
  if not found then perform public.raise_order_error('REQUEST_NOT_FOUND'); end if;
  insert into public.custom_request_events (request_id, status, note, actor_id)
    values (p_request_id, p_status, p_note, p_actor);
end $$;

-- Proposition d'OHMEGATO : remplace la précédente encore ouverte.
create or replace function public.add_custom_proposal(
  p_request_id uuid, p_body text, p_lines jsonb, p_total_fcfa int, p_valid_until date, p_actor uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_request public.custom_requests;
  v_id uuid;
  v_version int;
begin
  select * into v_request from public.custom_requests where id = p_request_id for update;
  if not found then perform public.raise_order_error('REQUEST_NOT_FOUND'); end if;
  if v_request.status in ('paid', 'preparing', 'done', 'awaiting_payment') then
    perform public.raise_order_error('REQUEST_LOCKED');
  end if;
  if p_total_fcfa is null or p_total_fcfa <= 0 then perform public.raise_order_error('PRICE_REQUIRED'); end if;
  update public.custom_proposals set status = 'superseded'
    where request_id = p_request_id and status = 'sent';
  select coalesce(max(version), 0) + 1 into v_version from public.custom_proposals where request_id = p_request_id;
  insert into public.custom_proposals (request_id, version, body, lines, total_fcfa, valid_until, created_by)
    values (p_request_id, v_version, p_body, coalesce(p_lines, '[]'), p_total_fcfa, p_valid_until, p_actor)
    returning id into v_id;
  update public.custom_requests set quoted_total_fcfa = p_total_fcfa where id = p_request_id;
  perform public.set_custom_request_status(p_request_id, 'proposal_sent', 'Proposition n°' || v_version, p_actor);
  return v_id;
end $$;

-- Réponse du client. Acceptée : une commande à payer est créée au prix fixé par OHMEGATO.
create or replace function public.respond_custom_proposal(
  p_proposal_id uuid, p_accept boolean, p_tracking_token_hash text, p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_proposal public.custom_proposals;
  v_request public.custom_requests;
  v_order_id uuid := gen_random_uuid();
  v_reference text;
  v_line jsonb;
begin
  select * into v_proposal from public.custom_proposals where id = p_proposal_id for update;
  if not found then perform public.raise_order_error('PROPOSAL_NOT_FOUND'); end if;
  select * into v_request from public.custom_requests where id = v_proposal.request_id for update;

  if v_proposal.status = 'accepted' and p_accept then
    return jsonb_build_object('order_id', v_request.order_id, 'replayed', true);
  end if;
  if v_proposal.status <> 'sent' then perform public.raise_order_error('PROPOSAL_CLOSED'); end if;
  if v_proposal.valid_until is not null and v_proposal.valid_until < (now() at time zone 'Africa/Dakar')::date then
    perform public.raise_order_error('PROPOSAL_EXPIRED');
  end if;

  update public.custom_proposals
    set status = case when p_accept then 'accepted'::public.custom_proposal_status else 'declined' end,
        responded_at = now()
    where id = p_proposal_id;

  if not p_accept then
    perform public.set_custom_request_status(v_request.id, 'info_requested', 'Proposition déclinée par le client', null);
    return jsonb_build_object('declined', true);
  end if;

  perform public.set_custom_request_status(v_request.id, 'accepted', 'Proposition n°' || v_proposal.version || ' acceptée', null);

  v_reference := v_request.reference || '-P' || v_proposal.version;
  insert into public.orders (
    id, reference, tracking_token_hash, idempotency_key, user_id, cycle_id, status, payment_status,
    fulfillment, slot_id, customer_name, customer_phone, customer_email, address_line, district, landmark,
    recipient_name, recipient_phone, latitude, longitude, pickup_code, notes,
    subtotal_fcfa, delivery_fee_fcfa, total_fcfa, custom_request_id
  ) values (
    v_order_id, v_reference, p_tracking_token_hash, p_idempotency_key, v_request.user_id, null,
    'pending_payment', 'pending', coalesce(v_request.fulfillment, 'pickup'), null,
    v_request.customer_name, v_request.customer_phone, v_request.customer_email, v_request.address_line,
    v_request.district, v_request.landmark, v_request.recipient_name, v_request.recipient_phone,
    v_request.latitude, v_request.longitude,
    case when coalesce(v_request.fulfillment, 'pickup') = 'pickup' then public.random_code(6) end,
    'Sur-mesure ' || v_request.reference,
    v_proposal.total_fcfa,
    case when coalesce(v_request.fulfillment, 'pickup') = 'pickup' then 0 end,
    v_proposal.total_fcfa, v_request.id
  );

  if jsonb_array_length(v_proposal.lines) > 0 then
    for v_line in select * from jsonb_array_elements(v_proposal.lines) loop
      insert into public.order_items (order_id, product_name, variant_label, units_per_item, quantity, unit_price_fcfa, line_total_fcfa)
      values (v_order_id, v_line ->> 'label', coalesce(nullif(v_line ->> 'detail', ''), 'Sur-mesure'), 1,
              (v_line ->> 'quantity')::int, (v_line ->> 'unit_price_fcfa')::int,
              (v_line ->> 'quantity')::int * (v_line ->> 'unit_price_fcfa')::int);
    end loop;
  else
    insert into public.order_items (order_id, product_name, variant_label, units_per_item, quantity, unit_price_fcfa, line_total_fcfa)
    values (v_order_id, 'Création sur-mesure', 'Proposition n°' || v_proposal.version, 1, 1, v_proposal.total_fcfa, v_proposal.total_fcfa);
  end if;

  insert into public.order_status_history (order_id, status, note)
    values (v_order_id, 'pending_payment', 'Proposition sur-mesure acceptée');
  update public.custom_requests set order_id = v_order_id where id = v_request.id;
  perform public.set_custom_request_status(v_request.id, 'awaiting_payment', 'Paiement ouvert', null);
  return jsonb_build_object('order_id', v_order_id, 'reference', v_reference, 'replayed', false);
end $$;

-- Paiement confirmé d'une commande sur-mesure : la demande suit.
create or replace function public.sync_custom_request_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.custom_request_id is not null and new.payment_status is distinct from old.payment_status then
    if new.payment_status = 'paid' then
      perform public.set_custom_request_status(new.custom_request_id, 'paid', 'Paiement confirmé', null);
    elsif new.payment_status in ('failed', 'cancelled', 'expired') then
      perform public.set_custom_request_status(new.custom_request_id, 'awaiting_payment', 'Paiement ' || new.payment_status::text || ' : à relancer', null);
    end if;
  end if;
  return new;
end $$;
create trigger orders_custom_payment after update of payment_status on public.orders
  for each row execute function public.sync_custom_request_payment();

-- Un paiement échoué d'une commande sur-mesure ne l'annule pas : le client peut relancer.
-- (apply_payment_event remet le statut à pending_payment pour ces commandes.)

do $$
declare f text;
begin
  foreach f in array array[
    'public.create_custom_request(jsonb)',
    'public.set_custom_request_status(uuid, public.custom_request_status, text, uuid)',
    'public.add_custom_proposal(uuid, text, jsonb, int, date, uuid)',
    'public.respond_custom_proposal(uuid, boolean, text, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.custom_request_attachments enable row level security;
alter table public.custom_request_attachments force row level security;
alter table public.custom_proposals enable row level security;
alter table public.custom_proposals force row level security;
alter table public.custom_request_events enable row level security;
alter table public.custom_request_internal_notes enable row level security;
alter table public.custom_request_internal_notes force row level security;
create policy "notes internes des demandes" on public.custom_request_internal_notes
  for select using (public.is_admin());
alter table public.custom_request_events force row level security;

create policy "pièces jointes des demandes personnelles" on public.custom_request_attachments
  for select using (exists (
    select 1 from public.custom_requests r where r.id = request_id and (r.user_id = auth.uid() or public.is_admin())
  ));
create policy "propositions des demandes personnelles" on public.custom_proposals
  for select using (exists (
    select 1 from public.custom_requests r where r.id = request_id and (r.user_id = auth.uid() or public.is_admin())
  ));
create policy "historique des demandes personnelles" on public.custom_request_events
  for select using (exists (
    select 1 from public.custom_requests r where r.id = request_id and (r.user_id = auth.uid() or public.is_admin())
  ));

-- Pièces jointes : stockage privé, lecture par URL signée générée côté serveur.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sur-mesure', 'sur-mesure', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
