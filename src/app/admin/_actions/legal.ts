"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AdminState } from "@/lib/admin/errors";
import { requireAdmin } from "@/lib/auth/session";
import { LEGAL_SLUGS } from "@/lib/legal/documents";
import { normalizeSenegalPhone } from "@/lib/phone";
import { supabaseAdmin } from "@/lib/supabase/admin";

const uuid = z.uuid();
const slugSchema = z.enum(LEGAL_SLUGS);
/** Caractères de contrôle retirés (hors retours à la ligne et tabulations). */
const clean = (value: string) => value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\r\n?/g, "\n");

const draftSchema = z.object({
  title: z.string().trim().min(3, "Le titre compte au moins 3 caractères.").max(120),
  version: z.string().trim().regex(/^[0-9]+\.[0-9]+$/, "Numéro de version au format 1.1, 2.0…"),
  effectiveAt: z.union([z.literal(""), z.iso.date("Date d'entrée en vigueur invalide.")]),
  content: z.string().transform(clean).pipe(z.string().trim().min(1, "Le texte est vide.").max(60000, "Le texte dépasse 60 000 caractères.")),
});

export type LegalDraftInput = z.input<typeof draftSchema>;

async function audit(actor: string, action: string, entity: string, id: string, details: unknown) {
  await supabaseAdmin().rpc("write_audit", { p_actor: actor, p_action: action, p_entity: entity, p_entity_id: id, p_details: details });
}

function revalidateLegal(slug?: string) {
  if (slug) revalidatePath(`/${slug}`);
  revalidatePath("/admin/documents", "layout");
}

const versionKey = (v: string) => v.split(".").map(Number) as [number, number];
const greater = (a: string, b: string) => {
  const [am, an] = versionKey(a);
  const [bm, bn] = versionKey(b);
  return am > bm || (am === bm && an > bn);
};

/** Enregistre le brouillon d'un document (un seul brouillon par document). */
export async function saveLegalDraft(slug: string, input: LegalDraftInput): Promise<AdminState & { versionId?: string }> {
  const admin = await requireAdmin();
  const parsedSlug = slugSchema.safeParse(slug);
  if (!parsedSlug.success) return { ok: false, message: "Document inconnu." };
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Vérifiez le brouillon." };
  const { title, version, effectiveAt, content } = parsed.data;

  const db = supabaseAdmin();
  const { data: versions, error } = await db.from("legal_document_versions").select("id, version, status").eq("document_slug", parsedSlug.data);
  if (error) return { ok: false, message: "Enregistrement impossible." };
  const rows = (versions ?? []) as { id: string; version: string; status: string }[];
  const draft = rows.find((r) => r.status === "draft");
  const others = rows.filter((r) => r.status !== "draft");
  if (others.some((r) => r.version === version)) return { ok: false, message: `La version ${version} existe déjà : choisissez un numéro plus élevé.` };
  if (others.some((r) => !greater(version, r.version))) {
    return { ok: false, message: "Le numéro de version doit être supérieur à toutes les versions déjà publiées." };
  }

  const values = { title, version, content, effective_at: effectiveAt || null, updated_by: admin.id };
  let versionId: string;
  if (draft) {
    const { error: updateError } = await db.from("legal_document_versions").update(values).eq("id", draft.id).eq("status", "draft");
    if (updateError) return { ok: false, message: "Enregistrement impossible." };
    versionId = draft.id;
  } else {
    const { data: created, error: insertError } = await db
      .from("legal_document_versions")
      .insert({ ...values, document_slug: parsedSlug.data, status: "draft", created_by: admin.id })
      .select("id")
      .single();
    if (insertError || !created) return { ok: false, message: "Enregistrement impossible." };
    versionId = created.id as string;
  }
  await audit(admin.id, "legal.draft", "legal_document_versions", versionId, { slug: parsedSlug.data, version, length: content.length });
  revalidateLegal();
  return { ok: true, message: "Brouillon enregistré. Il n'est pas visible sur le site tant qu'il n'est pas publié.", versionId };
}

/** Publie le brouillon : l'ancienne version est archivée, les commandes passées gardent la leur. */
export async function publishLegalVersion(versionId: string): Promise<AdminState> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(versionId).success) return { ok: false, message: "Version introuvable." };
  const db = supabaseAdmin();
  const { data: row } = await db.from("legal_document_versions").select("document_slug").eq("id", versionId).maybeSingle();
  const { error } = await db.rpc("admin_publish_legal_version", { p_version_id: versionId, p_admin: admin.id });
  if (error) {
    if (error.message === "LEGAL_VERSION_NOT_DRAFT") return { ok: false, message: "Seul un brouillon peut être publié." };
    if (error.message === "LEGAL_VERSION_NOT_FOUND") return { ok: false, message: "Version introuvable." };
    return { ok: false, message: "Publication impossible." };
  }
  revalidateLegal(row?.document_slug as string | undefined);
  return { ok: true, message: "Nouvelle version publiée sur le site." };
}

/** Reprend le texte d'une ancienne version dans le brouillon (publié ensuite comme nouvelle version). */
export async function restoreLegalVersion(versionId: string): Promise<AdminState> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(versionId).success) return { ok: false, message: "Version introuvable." };
  const db = supabaseAdmin();
  const { data: source } = await db.from("legal_document_versions").select("document_slug, version, title, content").eq("id", versionId).maybeSingle();
  if (!source) return { ok: false, message: "Version introuvable." };
  const { data: versions } = await db.from("legal_document_versions").select("version").eq("document_slug", source.document_slug);
  const highest = ((versions ?? []) as { version: string }[]).map((v) => v.version).reduce((a, b) => (greater(a, b) ? a : b), "0.0");
  const [major, minor] = versionKey(highest);
  const result = await saveLegalDraft(source.document_slug as string, {
    title: source.title as string,
    version: `${major}.${minor + 1}`,
    effectiveAt: "",
    content: source.content as string,
  });
  if (!result?.ok) return result;
  await audit(admin.id, "legal.restore", "legal_document_versions", versionId, { slug: source.document_slug, from: source.version });
  return { ok: true, message: `Le texte de la version ${source.version as string} est repris dans le brouillon. Relisez-le puis publiez-le.` };
}

/** Abandonne le brouillon en cours (les versions publiées et archivées ne sont jamais supprimées). */
export async function discardLegalDraft(versionId: string): Promise<AdminState> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(versionId).success) return { ok: false, message: "Brouillon introuvable." };
  const db = supabaseAdmin();
  const { data, error } = await db.from("legal_document_versions").delete().eq("id", versionId).eq("status", "draft").select("document_slug, version");
  if (error || !data?.length) return { ok: false, message: "Brouillon introuvable." };
  await audit(admin.id, "legal.discard", "legal_document_versions", versionId, { slug: data[0]!.document_slug, version: data[0]!.version });
  revalidateLegal();
  return { ok: true, message: "Brouillon abandonné." };
}

const optionalText = (max: number) =>
  z
    .string()
    .transform(clean)
    .pipe(z.string().trim().max(max, `${max} caractères maximum.`))
    .transform((v) => v || null);

async function saveSetting(adminId: string, key: string, value: unknown, isPublic: boolean, details: unknown) {
  const { error } = await supabaseAdmin().from("site_settings").upsert({ key, value, is_public: isPublic });
  if (error) return false;
  await audit(adminId, "settings.update", "site_settings", key, details);
  return true;
}

const coordinatesSchema = z.object({
  email: z.email("Adresse e-mail invalide.").max(160),
  phone: z.string().trim().min(1, "Indiquez un numéro."),
  pickupAddress: z.string().transform(clean).pipe(z.string().trim().min(5, "Indiquez l'adresse de retrait.").max(200)),
});

/** Coordonnées publiques reprises dans les pages légales et le pied de page des documents. */
export async function saveLegalCoordinates(input: z.input<typeof coordinatesSchema>): Promise<AdminState> {
  const admin = await requireAdmin();
  const parsed = coordinatesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Vérifiez les coordonnées." };
  const phone = normalizeSenegalPhone(parsed.data.phone);
  if (!phone) return { ok: false, message: "Numéro sénégalais invalide." };
  const ok =
    (await saveSetting(admin.id, "brand.email", parsed.data.email, true, { field: "email" })) &&
    (await saveSetting(admin.id, "brand.phone", phone, true, { field: "phone" })) &&
    (await saveSetting(admin.id, "brand.pickup_address", parsed.data.pickupAddress, true, { field: "pickup_address" }));
  if (!ok) return { ok: false, message: "Enregistrement impossible." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Coordonnées enregistrées." };
}

const identitySchema = z.object({
  civil_name: optionalText(120),
  ninea: optionalText(40),
  rccm: optionalText(60),
  admin_address: optionalText(200),
});

/** Identité légale : privée, jamais lue par le site public. */
export async function saveLegalIdentity(input: z.input<typeof identitySchema>): Promise<AdminState> {
  const admin = await requireAdmin();
  const parsed = identitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Vérifiez les champs." };
  const filled = Object.entries(parsed.data)
    .filter(([, v]) => v)
    .map(([k]) => k);
  if (!(await saveSetting(admin.id, "legal.identity", parsed.data, false, { filled }))) return { ok: false, message: "Enregistrement impossible." };
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Identité légale enregistrée (non publiée)." };
}

/** Délai de remboursement : affiché sur la page Annulation et remboursement seulement s'il est renseigné. */
export async function saveRefundDelay(value: string): Promise<AdminState> {
  const admin = await requireAdmin();
  const parsed = optionalText(200).safeParse(value);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Texte invalide." };
  if (!(await saveSetting(admin.id, "legal.refund_delay", parsed.data, true, { set: Boolean(parsed.data) }))) return { ok: false, message: "Enregistrement impossible." };
  revalidatePath("/annulation-remboursement");
  revalidatePath("/admin/documents", "layout");
  return { ok: true, message: parsed.data ? "Délai enregistré et affiché sur le site." : "Délai retiré du site." };
}

const retentionSchema = z.object({ orders: optionalText(160), accounts: optionalText(160), custom_requests: optionalText(160) });

/** Durées de conservation : affichées sur la page Confidentialité seulement si elles sont renseignées. */
export async function saveRetention(input: z.input<typeof retentionSchema>): Promise<AdminState> {
  const admin = await requireAdmin();
  const parsed = retentionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Texte invalide." };
  if (!(await saveSetting(admin.id, "legal.retention", parsed.data, true, {}))) return { ok: false, message: "Enregistrement impossible." };
  revalidatePath("/confidentialite");
  revalidatePath("/admin/documents", "layout");
  return { ok: true, message: "Durées de conservation enregistrées." };
}

const refundSchema = z.object({
  amountFcfa: z.coerce.number().int("Montant entier en FCFA.").min(1, "Montant supérieur à 0.").max(10_000_000),
  reason: z.string().transform(clean).pipe(z.string().trim().min(3, "Indiquez le motif.").max(500)),
  method: z.string().transform(clean).pipe(z.string().trim().min(2, "Indiquez le moyen utilisé (Wave, espèces…).").max(80)),
  refundedAt: z.iso.date("Date invalide."),
});

/** Enregistre un remboursement déjà effectué à la main (aucun remboursement automatique). */
export async function recordRefund(orderId: string, _: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(orderId).success) return { ok: false, message: "Commande introuvable." };
  const parsed = refundSchema.safeParse({
    amountFcfa: form.get("amountFcfa"),
    reason: String(form.get("reason") ?? ""),
    method: String(form.get("method") ?? ""),
    refundedAt: String(form.get("refundedAt") ?? ""),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Vérifiez le remboursement." };
  const db = supabaseAdmin();
  const { data: order } = await db.from("orders").select("id, total_fcfa").eq("id", orderId).maybeSingle();
  if (!order) return { ok: false, message: "Commande introuvable." };
  const { data: previous } = await db.from("order_refunds").select("amount_fcfa").eq("order_id", orderId);
  const already = ((previous ?? []) as { amount_fcfa: number }[]).reduce((sum, r) => sum + r.amount_fcfa, 0);
  if (already + parsed.data.amountFcfa > (order.total_fcfa as number)) {
    return { ok: false, message: "Le total remboursé dépasserait le montant payé pour les produits." };
  }
  const { data: created, error } = await db
    .from("order_refunds")
    .insert({
      order_id: orderId,
      amount_fcfa: parsed.data.amountFcfa,
      reason: parsed.data.reason,
      method: parsed.data.method,
      refunded_at: parsed.data.refundedAt,
      recorded_by: admin.id,
    })
    .select("id")
    .single();
  if (error || !created) return { ok: false, message: "Enregistrement impossible." };
  await audit(admin.id, "refund.record", "orders", orderId, { amount_fcfa: parsed.data.amountFcfa, method: parsed.data.method });
  revalidatePath(`/admin/commandes/${orderId}`);
  return { ok: true, message: "Remboursement enregistré." };
}
