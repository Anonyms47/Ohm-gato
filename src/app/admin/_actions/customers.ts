"use server";

import { revalidatePath } from "next/cache";
import type { AdminState } from "@/lib/admin/errors";
import { requireAdmin } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function addCustomerNote(phone: string, body: string): Promise<AdminState> {
  const admin = await requireAdmin();
  const text = body.trim();
  if (!text) return { ok: false, message: "La note est vide." };
  const db = supabaseAdmin();
  const { error } = await db.from("customer_notes").insert({ customer_phone: phone, body: text.slice(0, 2000), author_id: admin.id });
  if (error) return { ok: false, message: "Enregistrement impossible." };
  await db.rpc("write_audit", { p_actor: admin.id, p_action: "customer.note.add", p_entity: "customers", p_entity_id: phone, p_details: {} });
  revalidatePath(`/admin/clients/${encodeURIComponent(phone)}`);
  return { ok: true, message: "Note ajoutée." };
}

export async function deleteCustomerNote(noteId: string, phone: string): Promise<AdminState> {
  const admin = await requireAdmin();
  const db = supabaseAdmin();
  const { error } = await db.from("customer_notes").delete().eq("id", noteId);
  if (error) return { ok: false, message: "Suppression impossible." };
  await db.rpc("write_audit", { p_actor: admin.id, p_action: "customer.note.delete", p_entity: "customers", p_entity_id: phone, p_details: { noteId } });
  revalidatePath(`/admin/clients/${encodeURIComponent(phone)}`);
  return { ok: true, message: "Note supprimée." };
}
