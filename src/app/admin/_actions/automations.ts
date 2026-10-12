"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAutomations } from "@/lib/admin/automations";
import { AUTOMATION_SETTINGS_KEY, automationSettingsSchema } from "@/lib/admin/automation-settings";
import { adminErrorMessage, type AdminState } from "@/lib/admin/errors";
import { requireAdmin } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Marque une notification comme lue (ou toutes, sans identifiant). */
export async function markNotificationsRead(id?: number): Promise<AdminState> {
  await requireAdmin();
  const db = supabaseAdmin();
  let query = db.from("admin_notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (id !== undefined) {
    if (!Number.isInteger(id) || id < 1) return { ok: false, message: "Notification introuvable." };
    query = query.eq("id", id);
  }
  const { error } = await query;
  if (error) return { ok: false, message: adminErrorMessage(error) };
  revalidatePath("/admin", "layout");
  return { ok: true, message: id === undefined ? "Tout est marqué comme lu." : "Notification lue." };
}

/** Recalcul immédiat des tâches, notifications et e-mails en attente (idempotent). */
export async function runAutomationsNow(): Promise<AdminState> {
  await requireAdmin();
  const result = await runAutomations("action");
  revalidatePath("/admin", "layout");
  const n = result.notifications;
  const e = result.emails;
  return {
    ok: true,
    message: `Atelier à jour : ${n?.opened ?? 0} nouvelle(s) notification(s), ${n?.closed ?? 0} terminée(s)${e && e.sent ? `, ${e.sent} e-mail(s) envoyé(s)` : ""}.`,
  };
}

const formSchema = z.object({
  paymentAlertHours: z.coerce.number().int().min(1, "Au moins 1 heure.").max(240),
  customAnswerHours: z.coerce.number().int().min(1, "Au moins 1 heure.").max(240),
  slotReminderHours: z.coerce.number().int().min(1, "Au moins 1 heure.").max(72),
});

/** Délais des alertes internes et e-mails (jamais un délai commercial public). */
export async function saveAutomationSettings(_: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const parsed = formSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  const value = automationSettingsSchema.parse({
    ...parsed.data,
    customerEmails: form.get("customerEmails") === "on",
    dailyDigest: form.get("dailyDigest") === "on",
  });
  const db = supabaseAdmin();
  const { error } = await db.from("site_settings").upsert({ key: AUTOMATION_SETTINGS_KEY, value, is_public: false }, { onConflict: "key" });
  if (error) return { ok: false, message: adminErrorMessage(error) };
  await db.rpc("write_audit", { p_actor: admin.id, p_action: "automation.settings", p_entity: "site_settings", p_entity_id: AUTOMATION_SETTINGS_KEY, p_details: value });
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Réglages des automatisations enregistrés." };
}
