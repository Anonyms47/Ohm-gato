"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { deliverySchema } from "@/lib/validation/checkout";

/**
 * Actions de l'espace membre. Chaque écriture passe par la session de l'utilisateur :
 * la RLS garantit qu'il ne modifie que ses propres données.
 */
export type ActionState = { ok: boolean; message: string } | null;

async function member() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?suite=/compte");
  return user;
}

const profileSchema = z.object({ fullName: z.string().trim().min(2, "Indiquez votre nom.").max(80) });

export async function updateProfile(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await member();
  const parsed = profileSchema.safeParse({ fullName: form.get("fullName") });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  const db = await supabaseServer();
  const { error } = await db.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", user.id);
  if (error) return { ok: false, message: "Enregistrement impossible. Réessayez." };
  revalidatePath("/compte", "layout");
  return { ok: true, message: "Coordonnées enregistrées." };
}

const addressSchema = deliverySchema.extend({
  id: z.uuid().optional(),
  label: z.string().trim().max(40).optional(),
  isDefault: z.boolean(),
});

export async function saveAddress(input: unknown): Promise<ActionState & { fieldErrors?: Record<string, string> }> {
  const user = await member();
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { ok: false, message: "Certaines informations sont à corriger.", fieldErrors };
  }
  const a = parsed.data;
  const db = await supabaseServer();
  if (a.isDefault) await db.from("addresses").update({ is_default: false }).eq("user_id", user.id);
  const row = {
    user_id: user.id,
    label: a.label || null,
    recipient_name: a.recipientName,
    recipient_phone: a.recipientPhone,
    address_line: a.addressLine,
    district: a.district,
    landmark: a.landmark,
    floor_door: a.floorDoor || null,
    instructions: a.instructions || null,
    latitude: a.latitude,
    longitude: a.longitude,
    is_default: a.isDefault,
  };
  const { error } = a.id ? await db.from("addresses").update(row).eq("id", a.id).eq("user_id", user.id) : await db.from("addresses").insert(row);
  if (error) return { ok: false, message: "Enregistrement impossible. Réessayez." };
  revalidatePath("/compte/profil");
  return { ok: true, message: "Adresse enregistrée." };
}

export async function deleteAddress(id: string): Promise<ActionState> {
  const user = await member();
  const db = await supabaseServer();
  const { error } = await db.from("addresses").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, message: "Suppression impossible." };
  revalidatePath("/compte/profil");
  return { ok: true, message: "Adresse supprimée." };
}

export async function toggleFavorite(productId: string, favorite: boolean): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Connectez-vous pour garder vos produits préférés." };
  const db = await supabaseServer();
  const { error } = favorite
    ? await db.from("favorites").upsert({ user_id: user.id, product_id: productId })
    : await db.from("favorites").delete().eq("user_id", user.id).eq("product_id", productId);
  if (error) return { ok: false, message: "Action impossible." };
  revalidatePath("/compte/profil");
  return { ok: true, message: favorite ? "Ajouté à vos préférés." : "Retiré de vos préférés." };
}

const preferencesSchema = z.object({
  newCycle: z.boolean(),
  orderUpdates: z.boolean(),
  channel: z.enum(["whatsapp", "sms", "email"]),
  marketingConsent: z.boolean(),
});

export async function savePreferences(input: unknown): Promise<ActionState> {
  const user = await member();
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Préférences invalides." };
  const db = await supabaseServer();
  const p = parsed.data;
  const [{ error: prefError }, { error: profileError }] = await Promise.all([
    db.from("notification_preferences").upsert({
      user_id: user.id,
      new_cycle: p.newCycle,
      order_updates: p.orderUpdates,
      channel: p.channel,
      updated_at: new Date().toISOString(),
    }),
    db
      .from("profiles")
      .update({ marketing_consent: p.marketingConsent, order_updates_consent: p.orderUpdates, consents_updated_at: new Date().toISOString() })
      .eq("id", user.id),
  ]);
  if (prefError || profileError) return { ok: false, message: "Enregistrement impossible." };
  revalidatePath("/compte/profil");
  return { ok: true, message: "Préférences enregistrées." };
}

export async function revokeSession(sessionId: string): Promise<ActionState> {
  await member();
  const db = await supabaseServer();
  const { data, error } = await db.rpc("revoke_my_session", { p_session_id: sessionId });
  if (error || !data) return { ok: false, message: "Session introuvable." };
  revalidatePath("/compte/profil");
  return { ok: true, message: "Session fermée." };
}

export async function signOutEverywhereElse(): Promise<ActionState> {
  await member();
  const db = await supabaseServer();
  const { error } = await db.auth.signOut({ scope: "others" });
  if (error) return { ok: false, message: "Action impossible." };
  revalidatePath("/compte/profil");
  return { ok: true, message: "Les autres appareils sont déconnectés." };
}

export async function signOut() {
  const db = await supabaseServer();
  await db.auth.signOut({ scope: "local" });
  redirect("/");
}

/**
 * Suppression du compte : le compte et ses données personnelles (profil, adresses,
 * préférés, préférences) sont effacés. Les commandes restent pour la comptabilité
 * d'OHMEGATO, détachées du compte.
 */
export async function deleteAccount(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await member();
  if (String(form.get("confirmation") ?? "").trim().toUpperCase() !== "SUPPRIMER") {
    return { ok: false, message: "Écrivez SUPPRIMER pour confirmer." };
  }
  const admin = supabaseAdmin();
  await admin.rpc("write_audit", {
    p_actor: user.id,
    p_action: "account.delete",
    p_entity: "auth.users",
    p_entity_id: user.id,
    p_details: {},
  });
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { ok: false, message: "Suppression impossible pour le moment. Écrivez-nous sur WhatsApp." };
  const db = await supabaseServer();
  await db.auth.signOut({ scope: "local" });
  redirect("/?compte=supprime");
}
