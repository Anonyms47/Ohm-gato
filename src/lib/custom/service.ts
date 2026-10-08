import "server-only";
import { randomUUID } from "node:crypto";
import { rateLimit } from "@/lib/http";
import { storeAttachment } from "@/lib/custom/files";
import { customRequestEditable, customRequestOpen, type CustomStatus } from "@/lib/custom/status";
import { generateTrackingToken, hashTrackingToken, isWellFormedToken } from "@/lib/orders/tracking";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { customEditSchema, customRequestSchema, eventDateTime } from "@/lib/validation/custom-request";

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; code: string; message: string; fieldErrors?: Record<string, string> };

const customErrorMessages: Record<string, string> = {
  EMPTY_REQUEST: "Ajoutez au moins un produit à votre demande.",
  TOO_MANY_LINES: "12 lignes au maximum par demande.",
  EVENT_TOO_SOON: "Prévoyez au moins 2 jours : le sur-mesure demande 2 à 4 jours selon la quantité.",
  PROPOSAL_NOT_FOUND: "Cette proposition est introuvable.",
  PROPOSAL_CLOSED: "Cette proposition n'est plus valable : une version plus récente existe ou elle a déjà reçu une réponse.",
  PROPOSAL_EXPIRED: "Cette proposition a expiré. Écrivez-nous pour en recevoir une nouvelle.",
  REQUEST_LOCKED: "Cette demande ne peut plus être modifiée.",
};

function dbFailure(error: { message: string }): ServiceResult<never> {
  if (/^[A-Z_]+$/.test(error.message)) {
    return { ok: false, status: 409, code: error.message, message: customErrorMessages[error.message] ?? "Action impossible pour le moment." };
  }
  throw error;
}

export async function createCustomRequest(
  input: unknown,
  context: { ip: string; userId: string | null },
): Promise<ServiceResult<{ reference: string; token: string; requestId: string }>> {
  const parsed = customRequestSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { ok: false, status: 422, code: "VALIDATION", message: "Certaines informations sont à corriger.", fieldErrors };
  }
  const data = parsed.data;
  const [ipOk, phoneOk] = await Promise.all([
    rateLimit(`custom:ip:${context.ip}`, 6, 3600),
    rateLimit(`custom:phone:${data.contact.phone}`, 4, 3600),
  ]);
  if (!ipOk || !phoneOk) {
    return { ok: false, status: 429, code: "RATE_LIMITED", message: "Trop de demandes en peu de temps. Patientez avant de réessayer ou écrivez-nous sur WhatsApp." };
  }

  const { token, hash } = generateTrackingToken(data.idempotencyKey, "sur-mesure");
  const delivery = data.fulfillment === "delivery" ? data.delivery : null;
  const occasion = data.occasion === "Autre occasion" && data.occasionDetail ? data.occasionDetail : data.occasion;
  const { data: created, error } = await supabaseAdmin().rpc("create_custom_request", {
    p: {
      idempotency_key: data.idempotencyKey,
      tracking_token_hash: hash,
      user_id: context.userId,
      occasion,
      event_at: eventDateTime(data.eventDate, data.eventTime)!.toISOString(),
      guests: data.guests,
      ambiance: data.ambiance ?? null,
      personalization: data.personalization ?? null,
      budget_fcfa: data.budgetFcfa ?? null,
      fulfillment: data.fulfillment,
      notes: data.notes ?? null,
      customer: { name: data.contact.name, phone: data.contact.phone, email: data.contact.email ?? null },
      delivery: delivery && {
        address_line: [delivery.addressLine, delivery.floorDoor].filter(Boolean).join(", "),
        district: delivery.district,
        landmark: delivery.landmark,
        recipient_name: delivery.recipientName,
        recipient_phone: delivery.recipientPhone,
        latitude: delivery.latitude,
        longitude: delivery.longitude,
      },
      items: data.items.map((i) => ({
        kind: i.kind,
        quantity: i.quantity,
        format: i.format ?? null,
        flavors: i.flavors ?? null,
        description: i.description ?? null,
        product_slug: i.kind === "verrines" ? "verrines-fruitees" : i.kind === "choux" ? "choux-creme" : null,
      })),
    },
  });
  if (error) return dbFailure(error);
  const result = created as { request_id: string; reference: string };
  return { ok: true, data: { reference: result.reference, token, requestId: result.request_id } };
}

/**
 * Accès à une demande : lien personnel ouvert sur le navigateur d'origine (cookie signé)
 * ou par son propriétaire connecté, ou session du membre (RLS).
 */
export type CustomAccess = ({ token: string } | { reference: string }) & { ownedRefs?: string[]; userId?: string | null };

async function resolveRequest(access: CustomAccess): Promise<{ id: string; status: CustomStatus } | null> {
  if ("token" in access) {
    if (!isWellFormedToken(access.token)) return null;
    const { data } = await supabaseAdmin()
      .from("custom_requests")
      .select("id, status, reference, user_id")
      .eq("tracking_token_hash", hashTrackingToken(access.token))
      .maybeSingle<{ id: string; status: CustomStatus; reference: string; user_id: string | null }>();
    if (!data) return null;
    const owner = (access.ownedRefs ?? []).includes(data.reference) || (access.userId != null && access.userId === data.user_id);
    return owner ? { id: data.id, status: data.status } : null;
  }
  const db = await supabaseServer();
  const { data } = await db
    .from("custom_requests")
    .select("id, status")
    .eq("reference", access.reference)
    .maybeSingle<{ id: string; status: CustomStatus }>();
  return data;
}

const notFound: ServiceResult<never> = { ok: false, status: 404, code: "NOT_FOUND", message: "Demande introuvable." };

export async function addClientMessage(access: CustomAccess, body: string, file: File | null, ip: string): Promise<ServiceResult<null>> {
  const request = await resolveRequest(access);
  if (!request) return notFound;
  if (!customRequestOpen(request.status)) {
    return { ok: false, status: 409, code: "REQUEST_CLOSED", message: "Cette demande est close : écrivez-nous sur WhatsApp." };
  }
  if (!(await rateLimit(`custom:msg:${request.id}:${ip}`, 20, 3600))) {
    return { ok: false, status: 429, code: "RATE_LIMITED", message: "Trop de messages en peu de temps. Patientez un peu." };
  }
  const text = body.trim().slice(0, 2000);
  if (!text && !file) return { ok: false, status: 422, code: "EMPTY", message: "Écrivez un message ou joignez un fichier." };

  const admin = supabaseAdmin();
  let stored: Awaited<ReturnType<typeof storeAttachment>> | null = null;
  if (file) {
    stored = await storeAttachment(request.id, file);
    if ("error" in stored) return { ok: false, status: 422, code: "FILE_INVALID", message: stored.error };
  }
  const { data: message, error } = await admin
    .from("custom_request_messages")
    .insert({ request_id: request.id, body: text || "Pièce jointe", from_staff: false })
    .select("id")
    .single();
  if (error) throw error;
  if (stored && !("error" in stored)) {
    const { error: attachError } = await admin.from("custom_request_attachments").insert({
      request_id: request.id,
      message_id: message.id,
      storage_path: stored.path,
      mime_type: stored.mime,
      size_bytes: stored.size,
      original_name: stored.name,
    });
    if (attachError) throw attachError;
  }
  if (request.status === "info_requested") {
    await admin.rpc("set_custom_request_status", {
      p_request_id: request.id,
      p_status: "studying",
      p_note: "Réponse du client",
      p_actor: null,
    });
  }
  return { ok: true, data: null };
}

export async function addInspiration(access: CustomAccess, file: File, ip: string): Promise<ServiceResult<null>> {
  const request = await resolveRequest(access);
  if (!request) return notFound;
  if (!(await rateLimit(`custom:file:${request.id}:${ip}`, 10, 3600))) {
    return { ok: false, status: 429, code: "RATE_LIMITED", message: "Trop de fichiers envoyés. Patientez un peu." };
  }
  const stored = await storeAttachment(request.id, file);
  if ("error" in stored) return { ok: false, status: 422, code: "FILE_INVALID", message: stored.error };
  const { error } = await supabaseAdmin().from("custom_request_attachments").insert({
    request_id: request.id,
    storage_path: stored.path,
    mime_type: stored.mime,
    size_bytes: stored.size,
    original_name: stored.name,
  });
  if (error) throw error;
  return { ok: true, data: null };
}

export async function editCustomRequest(access: CustomAccess, input: unknown): Promise<ServiceResult<null>> {
  const request = await resolveRequest(access);
  if (!request) return notFound;
  if (!customRequestEditable(request.status)) {
    return { ok: false, status: 409, code: "REQUEST_LOCKED", message: customErrorMessages.REQUEST_LOCKED! };
  }
  const parsed = customEditSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 422, code: "VALIDATION", message: "Certaines informations sont à corriger." };
  const at = eventDateTime(parsed.data.eventDate, parsed.data.eventTime);
  if (!at || at.getTime() < Date.now() + 47 * 3600 * 1000) {
    return { ok: false, status: 422, code: "EVENT_TOO_SOON", message: customErrorMessages.EVENT_TOO_SOON! };
  }
  const admin = supabaseAdmin();
  const { error } = await admin
    .from("custom_requests")
    .update({
      event_at: at.toISOString(),
      guests: parsed.data.guests,
      ambiance: parsed.data.ambiance ?? null,
      personalization: parsed.data.personalization ?? null,
      budget_fcfa: parsed.data.budgetFcfa ?? null,
      notes: parsed.data.notes ?? null,
    })
    .eq("id", request.id);
  if (error) throw error;
  await admin.from("custom_request_events").insert({ request_id: request.id, status: request.status, note: "Demande modifiée par le client" });
  return { ok: true, data: null };
}

export async function respondToProposal(
  access: CustomAccess,
  proposalId: string,
  accept: boolean,
): Promise<ServiceResult<{ trackingPath: string | null }>> {
  const request = await resolveRequest(access);
  if (!request) return notFound;
  const admin = supabaseAdmin();
  const { data: proposal } = await admin.from("custom_proposals").select("request_id").eq("id", proposalId).maybeSingle();
  if (!proposal || proposal.request_id !== request.id) return notFound;

  const idempotencyKey = randomUUID();
  const { token, hash } = generateTrackingToken(idempotencyKey);
  const { data, error } = await admin.rpc("respond_custom_proposal", {
    p_proposal_id: proposalId,
    p_accept: accept,
    p_tracking_token_hash: hash,
    p_idempotency_key: idempotencyKey,
  });
  if (error) return dbFailure(error);
  const result = data as { order_id?: string; replayed?: boolean; declined?: boolean };
  if (!accept || result.declined) return { ok: true, data: { trackingPath: null } };
  if (result.replayed && result.order_id) {
    const { data: order } = await admin.from("orders").select("idempotency_key").eq("id", result.order_id).single();
    return { ok: true, data: { trackingPath: `/suivi/${generateTrackingToken(order!.idempotency_key as string).token}` } };
  }
  return { ok: true, data: { trackingPath: `/suivi/${token}` } };
}
