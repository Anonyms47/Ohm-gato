"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminErrorMessage, type AdminState } from "@/lib/admin/errors";
import { requireAdmin } from "@/lib/auth/session";
import { storeAttachment } from "@/lib/custom/files";
import { CUSTOM_STATUSES } from "@/lib/custom/status";
import { supabaseAdmin } from "@/lib/supabase/admin";

function refresh(requestId: string) {
  revalidatePath("/admin/sur-mesure", "layout");
  revalidatePath(`/admin/sur-mesure/${requestId}`);
}

export async function setRequestStatus(requestId: string, status: string, note: string): Promise<AdminState> {
  const admin = await requireAdmin();
  if (!(CUSTOM_STATUSES as readonly string[]).includes(status)) return { ok: false, message: "Statut inconnu." };
  const db = supabaseAdmin();
  const { error } = await db.rpc("set_custom_request_status", { p_request_id: requestId, p_status: status, p_note: note.trim().slice(0, 300) || null, p_actor: admin.id });
  if (error) return { ok: false, message: adminErrorMessage(error) };
  await db.rpc("write_audit", { p_actor: admin.id, p_action: "custom.status", p_entity: "custom_requests", p_entity_id: requestId, p_details: { status, note } });
  refresh(requestId);
  return { ok: true, message: "Statut mis à jour." };
}

/** Message d'OHMEGATO au client, avec pièce jointe éventuelle ; « poser une question » passe la demande en attente d'informations. */
export async function sendStaffMessage(_: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const requestId = String(form.get("requestId") ?? "");
  const body = String(form.get("body") ?? "").trim().slice(0, 2000);
  const askQuestion = form.get("askQuestion") === "on";
  const file = form.get("file");
  const upload = file instanceof File && file.size > 0 ? file : null;
  if (!body && !upload) return { ok: false, message: "Écrivez un message ou joignez un document." };
  const db = supabaseAdmin();
  let stored = null;
  if (upload) {
    stored = await storeAttachment(requestId, upload);
    if ("error" in stored) return { ok: false, message: stored.error };
  }
  const { data: message, error } = await db
    .from("custom_request_messages")
    .insert({ request_id: requestId, body: body || "Document joint", from_staff: true, author_id: admin.id })
    .select("id")
    .single();
  if (error) return { ok: false, message: "Envoi impossible." };
  if (stored && !("error" in stored)) {
    await db.from("custom_request_attachments").insert({
      request_id: requestId,
      message_id: message.id,
      storage_path: stored.path,
      mime_type: stored.mime,
      size_bytes: stored.size,
      original_name: stored.name,
      from_staff: true,
    });
  }
  if (askQuestion) {
    await db.rpc("set_custom_request_status", { p_request_id: requestId, p_status: "info_requested", p_note: "Question d'OHMEGATO", p_actor: admin.id });
  }
  await db.rpc("write_audit", { p_actor: admin.id, p_action: "custom.message", p_entity: "custom_requests", p_entity_id: requestId, p_details: { attachment: Boolean(upload) } });
  refresh(requestId);
  return { ok: true, message: "Message envoyé au client." };
}

const proposalSchema = z.object({
  body: z.string().trim().min(5, "Décrivez la proposition.").max(3000),
  lines: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(120),
        detail: z.string().trim().max(200).optional(),
        quantity: z.number().int().min(1),
        unit_price_fcfa: z.number().int().min(0),
      }),
    )
    .max(20),
  totalFcfa: z.number().int().min(1, "Indiquez le prix total."),
  validUntil: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
});

export async function addProposal(requestId: string, input: unknown): Promise<AdminState> {
  const admin = await requireAdmin();
  const parsed = proposalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  const p = parsed.data;
  const linesTotal = p.lines.reduce((sum, l) => sum + l.quantity * l.unit_price_fcfa, 0);
  if (p.lines.length > 0 && linesTotal !== p.totalFcfa) {
    return { ok: false, message: `Le total (${p.totalFcfa} FCFA) ne correspond pas à la somme des lignes (${linesTotal} FCFA).` };
  }
  const db = supabaseAdmin();
  const { error } = await db.rpc("add_custom_proposal", {
    p_request_id: requestId,
    p_body: p.body,
    p_lines: p.lines,
    p_total_fcfa: p.totalFcfa,
    p_valid_until: p.validUntil || null,
    p_actor: admin.id,
  });
  if (error) return { ok: false, message: adminErrorMessage(error) };
  await db.rpc("write_audit", { p_actor: admin.id, p_action: "custom.proposal", p_entity: "custom_requests", p_entity_id: requestId, p_details: { total: p.totalFcfa } });
  refresh(requestId);
  return { ok: true, message: "Proposition envoyée au client." };
}

export async function saveInternalNote(requestId: string, body: string): Promise<AdminState> {
  const admin = await requireAdmin();
  const { error } = await supabaseAdmin()
    .from("custom_request_internal_notes")
    .upsert({ request_id: requestId, body: body.slice(0, 4000), updated_by: admin.id, updated_at: new Date().toISOString() });
  if (error) return { ok: false, message: "Enregistrement impossible." };
  refresh(requestId);
  return { ok: true, message: "Note interne enregistrée." };
}
