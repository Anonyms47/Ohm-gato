import "server-only";
import { LEGAL_SLUGS, type LegalSlug } from "@/lib/legal/documents";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Identité légale (privée) : jamais affichée sur le site tant qu'elle n'est pas complète et validée. */
export interface LegalIdentity {
  civil_name: string | null;
  ninea: string | null;
  rccm: string | null;
  admin_address: string | null;
}

export const IDENTITY_FIELDS: { key: keyof LegalIdentity; label: string }[] = [
  { key: "civil_name", label: "Nom civil complet de l'exploitante" },
  { key: "ninea", label: "NINEA" },
  { key: "rccm", label: "RCCM" },
  { key: "admin_address", label: "Adresse administrative" },
];

export const IDENTITY_ALERT =
  "Identité légale incomplète : renseigner le nom civil complet de l'exploitante, le NINEA, le RCCM et l'adresse administrative dès la formalisation d'OHMEGATO.";

export interface Retention {
  orders: string | null;
  accounts: string | null;
  custom_requests: string | null;
}

export interface AdminLegalVersion {
  id: string;
  version: string;
  status: "draft" | "published" | "archived";
  title: string;
  content: string;
  contentHash: string;
  effectiveAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  updatedBy: string | null;
  acceptances: number;
}

export interface AdminLegalDocument {
  slug: LegalSlug;
  title: string;
  published: AdminLegalVersion | null;
  draft: AdminLegalVersion | null;
  versions: AdminLegalVersion[];
}

type VersionRow = {
  id: string;
  document_slug: LegalSlug;
  version: string;
  status: AdminLegalVersion["status"];
  title: string;
  content: string;
  content_hash: string;
  effective_at: string | null;
  published_at: string | null;
  updated_at: string;
  updated_by: string | null;
};

const db = () => supabaseAdmin();

/** Nombre de commandes ayant accepté chaque version (conditions générales ou annulation). */
async function acceptanceCounts(): Promise<Map<string, number>> {
  const { data, error } = await db().from("order_acceptances").select("terms_version_id, cancellation_version_id");
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { terms_version_id: string; cancellation_version_id: string }[]) {
    counts.set(row.terms_version_id, (counts.get(row.terms_version_id) ?? 0) + 1);
    counts.set(row.cancellation_version_id, (counts.get(row.cancellation_version_id) ?? 0) + 1);
  }
  return counts;
}

async function adminNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const { data } = await db().from("profiles").select("id, full_name").in("id", unique);
  return new Map(((data ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name || "Administrateur"]));
}

export async function listLegalDocuments(): Promise<AdminLegalDocument[]> {
  const [{ data: docs, error }, { data: versions, error: versionError }, counts] = await Promise.all([
    db().from("legal_documents").select("slug, title, sort_order").order("sort_order"),
    db()
      .from("legal_document_versions")
      .select("id, document_slug, version, status, title, content, content_hash, effective_at, published_at, updated_at, updated_by")
      .order("created_at", { ascending: false }),
    acceptanceCounts(),
  ]);
  if (error) throw error;
  if (versionError) throw versionError;
  const rows = (versions ?? []) as VersionRow[];
  const names = await adminNames(rows.map((r) => r.updated_by).filter((v): v is string => Boolean(v)));
  const toVersion = (r: VersionRow): AdminLegalVersion => ({
    id: r.id,
    version: r.version,
    status: r.status,
    title: r.title,
    content: r.content,
    contentHash: r.content_hash,
    effectiveAt: r.effective_at,
    publishedAt: r.published_at,
    updatedAt: r.updated_at,
    updatedBy: r.updated_by ? (names.get(r.updated_by) ?? "Administrateur") : null,
    acceptances: counts.get(r.id) ?? 0,
  });
  return ((docs ?? []) as { slug: LegalSlug; title: string }[])
    .filter((d) => (LEGAL_SLUGS as readonly string[]).includes(d.slug))
    .map((d) => {
      const own = rows.filter((r) => r.document_slug === d.slug).map(toVersion);
      return {
        slug: d.slug,
        title: d.title,
        published: own.find((v) => v.status === "published") ?? null,
        draft: own.find((v) => v.status === "draft") ?? null,
        versions: own,
      };
    });
}

export async function getLegalDocumentAdmin(slug: string): Promise<AdminLegalDocument | null> {
  return (await listLegalDocuments()).find((d) => d.slug === slug) ?? null;
}

/** Dernières commandes ayant accepté une version (référence et date d'acceptation). */
export async function recentAcceptances(versionId: string, limit = 10): Promise<{ orderId: string; reference: string; acceptedAt: string }[]> {
  const { data, error } = await db()
    .from("order_acceptances")
    .select("order_id, accepted_at, orders!inner(reference)")
    .or(`terms_version_id.eq.${versionId},cancellation_version_id.eq.${versionId}`)
    .order("accepted_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as { order_id: string; accepted_at: string; orders: { reference: string } | { reference: string }[] }[]).map((r) => ({
    orderId: r.order_id,
    reference: Array.isArray(r.orders) ? (r.orders[0]?.reference ?? "") : r.orders.reference,
    acceptedAt: r.accepted_at,
  }));
}

/** Versions acceptées par une commande (affichées sur sa fiche). */
export async function orderAcceptance(orderId: string) {
  const { data, error } = await db()
    .from("order_acceptances")
    .select("accepted_at, channel, terms_hash, terms:legal_document_versions!order_acceptances_terms_version_id_fkey(version, title), cancellation:legal_document_versions!order_acceptances_cancellation_version_id_fkey(version, title)")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const row = data as unknown as {
    accepted_at: string;
    channel: string;
    terms: { version: string; title: string } | { version: string; title: string }[] | null;
    cancellation: { version: string; title: string } | { version: string; title: string }[] | null;
  };
  return { acceptedAt: row.accepted_at, channel: row.channel, terms: one(row.terms), cancellation: one(row.cancellation) };
}

export interface RefundRow {
  id: string;
  amountFcfa: number;
  reason: string;
  method: string;
  refundedAt: string;
  recordedBy: string | null;
}

export async function orderRefunds(orderId: string): Promise<RefundRow[]> {
  const { data, error } = await db()
    .from("order_refunds")
    .select("id, amount_fcfa, reason, method, refunded_at, recorded_by")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as { id: string; amount_fcfa: number; reason: string; method: string; refunded_at: string; recorded_by: string | null }[];
  const names = await adminNames(rows.map((r) => r.recorded_by).filter((v): v is string => Boolean(v)));
  return rows.map((r) => ({
    id: r.id,
    amountFcfa: r.amount_fcfa,
    reason: r.reason,
    method: r.method,
    refundedAt: r.refunded_at,
    recordedBy: r.recorded_by ? (names.get(r.recorded_by) ?? "Administrateur") : null,
  }));
}

export interface LegalSettings {
  identity: LegalIdentity;
  refundDelay: string;
  retention: Retention;
  email: string;
  phone: string;
  pickupAddress: string;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

export async function getLegalSettings(): Promise<LegalSettings> {
  const { data, error } = await db()
    .from("site_settings")
    .select("key, value")
    .in("key", ["legal.identity", "legal.refund_delay", "legal.retention", "brand.email", "brand.phone", "brand.pickup_address"]);
  if (error) throw error;
  const map = new Map(((data ?? []) as { key: string; value: unknown }[]).map((s) => [s.key, s.value]));
  const identity = (map.get("legal.identity") ?? {}) as Partial<LegalIdentity>;
  const retention = (map.get("legal.retention") ?? {}) as Partial<Retention>;
  return {
    identity: {
      civil_name: identity.civil_name ?? null,
      ninea: identity.ninea ?? null,
      rccm: identity.rccm ?? null,
      admin_address: identity.admin_address ?? null,
    },
    refundDelay: str(map.get("legal.refund_delay")),
    retention: { orders: retention.orders ?? null, accounts: retention.accounts ?? null, custom_requests: retention.custom_requests ?? null },
    email: str(map.get("brand.email")),
    phone: str(map.get("brand.phone")),
    pickupAddress: str(map.get("brand.pickup_address")),
  };
}

/** Champs d'identité légale encore vides (affichés uniquement dans l'administration). */
export function missingIdentityFields(identity: LegalIdentity): string[] {
  return IDENTITY_FIELDS.filter((f) => !identity[f.key]?.trim()).map((f) => f.label);
}
