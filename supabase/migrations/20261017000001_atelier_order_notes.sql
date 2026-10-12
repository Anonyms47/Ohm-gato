-- Atelier : notes internes des commandes et suivi des paiements Wave introuvables.
-- Aucune donnée existante n'est modifiée. Accès réservé au serveur (clé service, après contrôle du rôle).

create table public.order_notes (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  kind text not null default 'note' check (kind in ('note', 'payment_not_found')),
  body text not null default '' check (char_length(body) <= 1000),
  created_at timestamptz not null default now()
);

create index order_notes_order_idx on public.order_notes (order_id, created_at desc);

alter table public.order_notes enable row level security;
-- Aucune politique : ni les clientes ni les visiteurs n'y ont accès, seul le serveur lit et écrit.
revoke all on table public.order_notes from anon, authenticated;
grant select, insert on table public.order_notes to service_role;

comment on table public.order_notes is
  'Notes internes de l''équipe sur une commande (jamais visibles des clientes). kind = payment_not_found : paiement Wave cherché sans succès, la commande n''est ni annulée ni modifiée.';
