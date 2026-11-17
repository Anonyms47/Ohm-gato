"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { processBatchAlerts } from "@/lib/alerts/outbox";
import { adminErrorMessage, type AdminState } from "@/lib/admin/errors";
import { requireAdmin } from "@/lib/auth/session";
import { errorLabel } from "@/lib/email/delivery";
import { supabaseAdmin } from "@/lib/supabase/admin";

function refresh() {
  revalidatePath("/admin/alertes");
}

/**
 * Déclenchement explicite de l'alerte d'ouverture : une seule fois par fournée ouverte, vers les inscrits actifs.
 * Rien ne part sans cette action ; les envois sont conservés en attente si Brevo est indisponible.
 */
export async function triggerBatchAlert(cycleId: string): Promise<AdminState> {
  const admin = await requireAdmin();
  const { data, error } = await supabaseAdmin().rpc("admin_trigger_batch_alert", { p_cycle_id: cycleId, p_actor: admin.id });
  if (error) return { ok: false, message: adminErrorMessage(error) };
  const recipients = (data as { recipients: number }).recipients;
  // Premiers envois juste après la réponse ; le reste suit par lots (visite de l'atelier ou passage quotidien).
  after(() => processBatchAlerts(50).catch(() => undefined));
  refresh();
  return { ok: true, message: `Alerte déclenchée pour ${recipients} inscrit${recipients > 1 ? "s" : ""}. Les e-mails partent par petits lots.` };
}

/** Envoie maintenant les messages en attente (et rend compte clairement d'un éventuel blocage Brevo). */
export async function processAlertsNow(): Promise<AdminState> {
  await requireAdmin();
  const result = await processBatchAlerts(100);
  refresh();
  if (result.blocked) {
    return { ok: false, message: `${errorLabel(result.blocked)}. Les alertes restent en attente (${result.waiting}) et partiront après correction.` };
  }
  return { ok: true, message: `${result.sent} envoyé${result.sent > 1 ? "s" : ""}, ${result.waiting} en attente${result.failed ? `, ${result.failed} en échec` : ""}.` };
}

export async function retryBatchAlert(alertId: string): Promise<AdminState> {
  const admin = await requireAdmin();
  const { data, error } = await supabaseAdmin().rpc("admin_retry_batch_alert_sends", { p_alert_id: alertId, p_actor: admin.id });
  if (error) return { ok: false, message: adminErrorMessage(error) };
  const count = data as number;
  after(() => processBatchAlerts(50).catch(() => undefined));
  refresh();
  return { ok: true, message: count > 0 ? `${count} envoi${count > 1 ? "s" : ""} repris.` : "Aucun envoi à reprendre." };
}

export async function unsubscribeAlertSubscriber(id: string): Promise<AdminState> {
  const admin = await requireAdmin();
  const { error } = await supabaseAdmin().rpc("admin_unsubscribe_alert_subscriber", { p_id: id, p_actor: admin.id });
  if (error) return { ok: false, message: "Désinscription impossible." };
  refresh();
  return { ok: true, message: "Personne désinscrite." };
}
