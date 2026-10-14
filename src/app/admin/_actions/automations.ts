"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { after } from "next/server";
import { runAutomations } from "@/lib/admin/automations";
import { testEmailConnection } from "@/lib/email/health";
import { processOutbox } from "@/lib/email/outbox";
import { rateLimit } from "@/lib/http";
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
  const emails = e ? [e.sent && `${e.sent} e-mail(s) envoyé(s)`, e.retrying && `${e.retrying} à réessayer plus tard`, e.held && `${e.held} en pause`].filter(Boolean) : [];
  return {
    ok: true,
    message: `Atelier à jour : ${n?.opened ?? 0} nouvelle(s) notification(s), ${n?.closed ?? 0} terminée(s)${emails.length ? `, ${emails.join(", ")}` : ""}.`,
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

/** Test minimal du service d'e-mails (aucun envoi). Réservé à l'équipe, limité à 5 essais par 10 minutes. */
export async function testEmailConnectionAction(): Promise<AdminState> {
  const admin = await requireAdmin();
  if (!(await rateLimit(`email-test:${admin.id}`, 5, 600)) || !(await rateLimit("email-test", 20, 3600))) {
    return { ok: false, message: "Trop de tests rapprochés. Réessayez dans quelques minutes." };
  }
  const result = await testEmailConnection(admin.id);
  revalidatePath("/admin", "layout");
  if (result.mode === "test") return { ok: true, message: "Mode test : aucun service réel n'est utilisé ici." };
  return { ok: result.ok, message: result.ok ? result.label : `${result.label}.` };
}

const idsSchema = z.array(z.number().int().positive()).min(1, "Sélectionnez au moins un message.").max(50);

/** Reprise des messages choisis (en pause ou en échec) : même ligne, même clé, un seul envoi. */
export async function retryEmails(ids: number[]): Promise<AdminState> {
  const admin = await requireAdmin();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  const { data, error } = await supabaseAdmin().rpc("admin_retry_emails", { p_ids: parsed.data, p_actor: admin.id });
  if (error) return { ok: false, message: adminErrorMessage(error) };
  after(() => processOutbox().catch(() => undefined));
  revalidatePath("/admin", "layout");
  return { ok: true, message: `${data ?? 0} message(s) remis en envoi.` };
}

/** Abandon des messages choisis : ils ne partiront jamais. */
export async function skipEmails(ids: number[]): Promise<AdminState> {
  const admin = await requireAdmin();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  const { data, error } = await supabaseAdmin().rpc("admin_skip_emails", { p_ids: parsed.data, p_actor: admin.id });
  if (error) return { ok: false, message: adminErrorMessage(error) };
  revalidatePath("/admin", "layout");
  return { ok: true, message: `${data ?? 0} message(s) abandonné(s).` };
}
