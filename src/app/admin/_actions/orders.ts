"use server";

import { revalidatePath } from "next/cache";
import { adminErrorMessage, type AdminState } from "@/lib/admin/errors";
import { requireAdmin } from "@/lib/auth/session";
import { normalizeSenegalPhone } from "@/lib/phone";
import { supabaseAdmin } from "@/lib/supabase/admin";

function refresh(orderId: string) {
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
