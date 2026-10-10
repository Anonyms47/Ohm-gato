-- OHMEGATO — documents légaux versionnés, preuve d'acceptation par commande, remboursements.
--
-- Chaque document (conditions générales, annulation, confidentialité…) a des versions :
-- brouillon → publiée → archivée. Une seule version publiée par document. Une commande garde
-- pour toujours la référence de la version qu'elle a acceptée, même après une nouvelle publication.
-- L'adresse IP n'est pas enregistrée avec l'acceptation : elle n'est pas nécessaire à la preuve.

create type public.legal_version_status as enum ('draft', 'published', 'archived');

create table public.legal_documents (
  slug text primary key check (slug ~ '^[a-z-]+$'),
  title text not null,
  description text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  document_slug text not null references public.legal_documents (slug),
  version text not null check (version ~ '^[0-9]+\.[0-9]+$'),
  status public.legal_version_status not null default 'draft',
  title text not null check (char_length(title) between 3 and 120),
  content text not null check (char_length(content) between 1 and 60000),
  content_hash text not null default '',
  effective_at date,
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_slug, version)
);
create unique index legal_one_published on public.legal_document_versions (document_slug) where status = 'published';
create index legal_versions_slug_idx on public.legal_document_versions (document_slug, created_at desc);

-- Empreinte du texte (preuve de la version acceptée) et date de modification.
create or replace function public.legal_version_hash()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.content_hash := encode(sha256(convert_to(new.content, 'UTF8')), 'hex');
  new.updated_at := now();
  return new;
end $$;
create trigger legal_versions_hash before insert or update of content, title on public.legal_document_versions
  for each row execute function public.legal_version_hash();

-- Une version publiée ou archivée ne change plus : on en crée une nouvelle.
create or replace function public.legal_version_freeze()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status <> 'draft' and (new.content is distinct from old.content or new.title is distinct from old.title or new.version is distinct from old.version) then
    raise exception 'LEGAL_VERSION_FROZEN';
  end if;
  return new;
end $$;
create trigger legal_versions_freeze before update on public.legal_document_versions
  for each row execute function public.legal_version_freeze();

-- Publication atomique : l'ancienne version publiée est archivée, la nouvelle publiée.
create or replace function public.admin_publish_legal_version(p_version_id uuid, p_admin uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.legal_document_versions;
begin
  select * into v from public.legal_document_versions where id = p_version_id for update;
  if not found then raise exception 'LEGAL_VERSION_NOT_FOUND'; end if;
  if v.status <> 'draft' then raise exception 'LEGAL_VERSION_NOT_DRAFT'; end if;
  update public.legal_document_versions set status = 'archived', updated_by = p_admin
    where document_slug = v.document_slug and status = 'published';
  update public.legal_document_versions
    set status = 'published', published_at = now(), effective_at = coalesce(effective_at, current_date), updated_by = p_admin
    where id = p_version_id;
  perform public.write_audit(p_admin, 'legal.publish', 'legal_document_versions', p_version_id::text,
    jsonb_build_object('slug', v.document_slug, 'version', v.version));
end $$;
revoke all on function public.admin_publish_legal_version(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_publish_legal_version(uuid, uuid) to service_role;
revoke all on function public.legal_version_hash() from public, anon, authenticated;
revoke all on function public.legal_version_freeze() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Preuve d'acceptation des conditions, une ligne par commande
-- ---------------------------------------------------------------------------
create table public.order_acceptances (
  order_id uuid primary key references public.orders (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  terms_version_id uuid not null references public.legal_document_versions (id),
  cancellation_version_id uuid not null references public.legal_document_versions (id),
  terms_hash text not null,
  cancellation_hash text not null,
  channel text not null default 'web' check (channel in ('web')),
  accepted_at timestamptz not null default now()
);
create index order_acceptances_terms_idx on public.order_acceptances (terms_version_id);
create index order_acceptances_cancellation_idx on public.order_acceptances (cancellation_version_id);

-- ---------------------------------------------------------------------------
-- Remboursements enregistrés à la main par l'équipe (aucun remboursement automatique)
-- ---------------------------------------------------------------------------
create table public.order_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  amount_fcfa int not null check (amount_fcfa > 0),
  reason text not null check (char_length(reason) between 3 and 500),
  method text not null check (char_length(method) between 2 and 80),
  refunded_at date not null,
  recorded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index order_refunds_order_idx on public.order_refunds (order_id);

-- ---------------------------------------------------------------------------
-- RLS : lecture publique des seules versions publiées ; le reste réservé au serveur
-- ---------------------------------------------------------------------------
alter table public.legal_documents enable row level security;
alter table public.legal_documents force row level security;
alter table public.legal_document_versions enable row level security;
alter table public.legal_document_versions force row level security;
alter table public.order_acceptances enable row level security;
alter table public.order_acceptances force row level security;
alter table public.order_refunds enable row level security;
alter table public.order_refunds force row level security;

create policy "documents visibles" on public.legal_documents for select using (true);
create policy "versions publiées visibles" on public.legal_document_versions for select using (status = 'published');

revoke all on public.legal_documents from anon, authenticated;
grant select on public.legal_documents to anon, authenticated;
revoke all on public.legal_document_versions from anon, authenticated;
grant select (id, document_slug, version, status, title, content, content_hash, effective_at, published_at)
  on public.legal_document_versions to anon, authenticated;
revoke all on public.order_acceptances, public.order_refunds from anon, authenticated;
grant all on public.legal_documents, public.legal_document_versions, public.order_acceptances, public.order_refunds to service_role;

-- ---------------------------------------------------------------------------
-- Réglages : coordonnées publiques, identité légale (privée), délais (affichés seulement s'ils sont renseignés)
-- ---------------------------------------------------------------------------
insert into public.site_settings (key, value, is_public) values
  ('legal.identity', '{"civil_name": null, "ninea": null, "rccm": null, "admin_address": null}', false),
  ('legal.refund_delay', 'null', true),
  ('legal.retention', '{"orders": null, "accounts": null, "custom_requests": null}', true)
on conflict (key) do nothing;
update public.site_settings set value = '"contact@ohmegato.com"', is_public = true
  where key = 'brand.email' and (value = 'null'::jsonb or value is null);
