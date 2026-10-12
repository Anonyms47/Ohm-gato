"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { processOutbox } from "@/lib/email/outbox";
import { z } from "zod";
import { BULK_ACTIONS, bulkEligible, type BulkTarget } from "@/lib/admin/order-stage";
import type { Fulfillment, OrderStatus, PaymentStatus } from "@/lib/order-status";
import { adminErrorMessage, type AdminState } from "@/lib/admin/errors";
import { requireAdmin } from "@/lib/auth/session";
import { normalizeSenegalPhone } from "@/lib/phone";
import { supabaseAdmin } from "@/lib/supabase/admin";

function refresh(orderId: string) {
  // E-mails mis en file par la base au changement d'étape : envoyés juste après la réponse.
  after(() => processOutbox().catch(() => undefined));
  revalidatePath("/admin", "layout");
  revalidatePath(`/admin/commandes/${orderId}`);
}

export async function setOrderStatus(orderId: string, status: string, note: string): Promise<AdminState> {
  const admin = await requireAdmin();
  const { error } = await supabaseAdmin().rpc("admin_set_order_status", {
    p_order_id: orderId,
    p_status: status,
    p_note: note.trim().slice(0, 300),
    p_actor: admin.id,
  });
  if (error) return { ok: false, message: adminErrorMessage(error) };
  refresh(orderId);
  return { ok: true, message: "Statut mis à jour." };
}

/** Paiement constaté par OHMEGATO dans son application Wave (lien marchand, sans notification). */
export async function recordPayment(orderId: string, reference: string): Promise<AdminState> {
  const admin = await requireAdmin();
  const { error } = await supabaseAdmin().rpc("admin_record_payment", {
    p_order_id: orderId,
    p_reference: reference.trim().slice(0, 80),
    p_actor: admin.id,
  });
  if (error) return { ok: false, message: adminErrorMessage(error) };
  refresh(orderId);
  return { ok: true, message: "Paiement enregistré : la commande est payée." };
}

/** Commande confiée au livreur : son nom et son numéro restent avec la commande. */
export async function handToCourier(orderId: string, courierName: string, courierPhone: string): Promise<AdminState> {
  const admin = await requireAdmin();
  const phone = courierPhone.trim() ? normalizeSenegalPhone(courierPhone) : null;
  if (courierPhone.trim() && !phone) return { ok: false, message: "Numéro du livreur invalide." };
  const db = supabaseAdmin();
  await db.from("orders").update({ courier_name: courierName.trim().slice(0, 80) || null, courier_phone: phone }).eq("id", orderId);
  const { error } = await db.rpc("admin_set_order_status", {
    p_order_id: orderId,
    p_status: "out_for_delivery",
    p_note: courierName.trim() ? `Confiée à ${courierName.trim().slice(0, 80)}` : "Confiée au livreur",
    p_actor: admin.id,
  });
  if (error) return { ok: false, message: adminErrorMessage(error) };
  refresh(orderId);
  return { ok: true, message: "Commande confiée au livreur." };
}

const uuid = z.string().uuid();

/** Note interne (jamais visible de la cliente). */
export async function addOrderNote(orderId: string, body: string): Promise<AdminState> {
  const admin = await requireAdmin();
  const text = (body ?? "").trim().slice(0, 1000);
  if (!uuid.safeParse(orderId).success) return { ok: false, message: "Commande introuvable." };
  if (!text) return { ok: false, message: "Écrivez la note avant de l'enregistrer." };
  const db = supabaseAdmin();
  const { error } = await db.from("order_notes").insert({ order_id: orderId, author_id: admin.id, kind: "note", body: text });
  if (error) return { ok: false, message: adminErrorMessage(error) };
  await db.rpc("write_audit", { p_actor: admin.id, p_action: "order.note", p_entity: "orders", p_entity_id: orderId, p_details: {} });
  refresh(orderId);
  return { ok: true, message: "Note enregistrée." };
}

/**
 * « Introuvable pour le moment » : trace la recherche sans rien changer à la commande
 * (ni annulation, ni relance automatique). Alima peut réessayer ou contacter la cliente.
 */
export async function markPaymentNotFound(orderId: string): Promise<AdminState> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(orderId).success) return { ok: false, message: "Commande introuvable." };
  const db = supabaseAdmin();
  const { data: order, error: readError } = await db.from("orders").select("payment_status, status").eq("id", orderId).maybeSingle();
  if (readError) return { ok: false, message: adminErrorMessage(readError) };
  if (!order || order.payment_status !== "pending") return { ok: false, message: "Ce paiement n'est plus en attente." };
  const { error } = await db.from("order_notes").insert({ order_id: orderId, author_id: admin.id, kind: "payment_not_found", body: "Paiement cherché dans Wave, introuvable pour le moment." });
  if (error) return { ok: false, message: adminErrorMessage(error) };
  await db.rpc("write_audit", { p_actor: admin.id, p_action: "order.payment_not_found", p_entity: "orders", p_entity_id: orderId, p_details: {} });
  refresh(orderId);
  revalidatePath("/admin/paiements");
  return { ok: true, message: "Noté : paiement introuvable pour le moment. La commande reste en attente." };
}

const bulkSchema = z.object({
  ids: z.array(uuid).min(1).max(60),
  target: z.enum(["preparing", "ready", "picked_up"]),
});

export interface BulkResult {
  ok: boolean;
  message: string;
  done: string[];
  skipped: { reference: string; reason: string }[];
}

/**
 * Changement d'étape groupé, après confirmation. Chaque commande est revérifiée côté serveur
 * (étape, paiement, mode de réception) puis passée par la même fonction sécurisée qu'à l'unité.
 * Jamais d'annulation ni de remboursement groupés.
 */
export async function bulkSetStatus(ids: string[], target: BulkTarget): Promise<BulkResult> {
  const admin = await requireAdmin();
  const parsed = bulkSchema.safeParse({ ids: [...new Set(ids)], target });
  if (!parsed.success) return { ok: false, message: "Sélection invalide.", done: [], skipped: [] };
  const db = supabaseAdmin();
  const { data, error } = await db.from("orders").select("id, reference, status, payment_status, fulfillment").in("id", parsed.data.ids);
  if (error) return { ok: false, message: adminErrorMessage(error), done: [], skipped: [] };
  const done: string[] = [];
  const skipped: { reference: string; reason: string }[] = [];
  for (const o of (data ?? []) as { id: string; reference: string; status: OrderStatus; payment_status: PaymentStatus; fulfillment: Fulfillment }[]) {
    if (!bulkEligible(parsed.data.target, { status: o.status, paymentStatus: o.payment_status, fulfillment: o.fulfillment })) {
      skipped.push({ reference: o.reference, reason: "étape ou paiement incompatible" });
      continue;
    }
    const { error: rpcError } = await db.rpc("admin_set_order_status", {
      p_order_id: o.id,
      p_status: parsed.data.target,
      p_note: "Action groupée",
      p_actor: admin.id,
    });
    if (rpcError) skipped.push({ reference: o.reference, reason: adminErrorMessage(rpcError) });
    else done.push(o.reference);
  }
  if (done.length > 0) {
    await db.rpc("write_audit", { p_actor: admin.id, p_action: "order.bulk_status", p_entity: "orders", p_entity_id: null, p_details: { target: parsed.data.target, orders: done } });
  }
  revalidatePath("/admin", "layout");
  after(() => processOutbox().catch(() => undefined));
  const label = BULK_ACTIONS[parsed.data.target].label.toLowerCase();
  return {
    ok: done.length > 0,
    message: done.length > 0 ? `${done.length} commande${done.length > 1 ? "s" : ""} : ${label}.${skipped.length ? ` ${skipped.length} laissée${skipped.length > 1 ? "s" : ""} de côté.` : ""}` : "Aucune commande n'a pu être modifiée.",
    done,
    skipped,
  };
}
