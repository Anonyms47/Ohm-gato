import "server-only";
import { oneClickUnsubscribeUrl, unsubscribeUrl } from "@/lib/alerts/service";
import { deliver, emailChannel, providerBlock, recordProviderCheck } from "@/lib/email/outbox";
import { errorLabel, errorScope, nextStepAfterFailure, type DeliveryResult, type EmailErrorCategory } from "@/lib/email/delivery";
import { renderBatchAlert } from "@/lib/email/templates";
import { preorderMessage } from "@/lib/cycle-status";
import { serverEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

interface SendRow {
  id: number;
  alert_id: string;
  subscriber_id: string;
  to_email: string;
  attempts: number;
}

export interface BatchAlertResult {
  channel: ReturnType<typeof emailChannel>;
  sent: number;
  retrying: number;
  failed: number;
  held: number;
  waiting: number;
  /** Envois suspendus : configuration du prestataire à corriger. */
  blocked?: EmailErrorCategory;
}

async function waiting(): Promise<number> {
  const { count } = await supabaseAdmin().from("batch_alert_sends").select("id", { count: "exact", head: true }).in("status", ["pending", "sending"]);
  return count ?? 0;
}

/**
 * Envoie les alertes d'ouverture dues, par petits lots. Chaque envoi est réservé atomiquement : deux passages simultanés
 * n'envoient jamais le même message. Prestataire indisponible : les envois restent en attente (ou en pause si la
 * configuration est à corriger) et sont repris plus tard, sans jamais être doublés.
 */
export async function processBatchAlerts(limit = 50): Promise<BatchAlertResult> {
  const db = supabaseAdmin();
  const channel = emailChannel();
  const result: BatchAlertResult = { channel, sent: 0, retrying: 0, failed: 0, held: 0, waiting: 0 };
  await db.rpc("release_stale_batch_alert_claims", { p_minutes: 15 });

  if (channel === "none") {
    result.blocked = "key_missing";
    result.waiting = await waiting();
    return result;
  }
  const provider = channel === "brevo" || channel === "resend" ? channel : null;
  if (provider) {
    const block = await providerBlock(provider);
    if (block) {
      result.blocked = block.category;
      result.waiting = await waiting();
      return result;
    }
  }

  const { data, error } = await db.rpc("claim_batch_alert_sends", { p_limit: limit });
  if (error) throw error;
  const rows = (data ?? []) as SendRow[];
  if (rows.length === 0) {
    result.waiting = await waiting();
    return result;
  }

  // Une seule lecture de la fournée par alerte.
  const messages = new Map<string, { cycleNumber: number; message: string } | null>();
  const site = serverEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const update = (id: number, values: Record<string, unknown>) => db.from("batch_alert_sends").update(values).eq("id", id).eq("status", "sending");
  let successRecorded = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    let outcome: DeliveryResult;
    try {
      if (!messages.has(row.alert_id)) {
        const { data: alert } = await db.from("batch_alerts").select("cycle_id").eq("id", row.alert_id).maybeSingle();
        const { data: cycle } = alert
          ? await db.from("production_cycles").select("number, closes_at, production_date, production_dates, fulfillment_date").eq("id", alert.cycle_id as string).maybeSingle()
          : { data: null };
        const c = cycle as { number: number; closes_at: string; production_dates: string[] | null; fulfillment_date: string } | null;
        // Dates réelles de la fournée : rien n'est inventé.
        messages.set(row.alert_id, c ? { cycleNumber: c.number, message: preorderMessage({ closesAt: c.closes_at, fulfillmentDate: c.fulfillment_date, productionDates: c.production_dates ?? [] }) } : null);
      }
      const info = messages.get(row.alert_id);
      const { data: sub } = await db.from("batch_alert_subscribers").select("unsubscribe_token, status").eq("id", row.subscriber_id).maybeSingle();
      if (!info || !sub || sub.status !== "active") {
        await update(row.id, { status: "skipped", last_error: "Inscription inactive ou fournée introuvable." });
        continue;
      }
      const token = sub.unsubscribe_token as string;
      const email = renderBatchAlert({
        cycleNumber: info.cycleNumber,
        message: info.message,
        siteUrl: `${site}/carte`,
        unsubscribeUrl: unsubscribeUrl(token),
        oneClickUrl: oneClickUnsubscribeUrl(token),
      });
      outcome = await deliver(channel, { to_email: row.to_email, idempotency_key: `alert:${row.alert_id}:${row.subscriber_id}` }, email);
    } catch {
      outcome = { ok: false, category: "unknown", httpStatus: null, providerCode: null, message: "" };
    }

    if (outcome.ok) {
      await update(row.id, { status: "sent", sent_at: new Date().toISOString(), provider_message_id: outcome.messageId, next_attempt_at: null, last_error: null, error_category: null });
      result.sent += 1;
      if (provider && !successRecorded) {
        await recordProviderCheck({ kind: "send", provider, ok: true, template: "next_batch_alert", attempts: row.attempts });
        successRecorded = true;
      }
      continue;
    }

    const step = nextStepAfterFailure(outcome.category, row.attempts, new Date());
    await update(row.id, {
      status: step.status,
      next_attempt_at: step.status === "pending" ? step.nextAttemptAt.toISOString() : null,
      error_category: outcome.category,
      last_error: errorLabel(outcome.category),
    });
    if (provider) {
      await recordProviderCheck({ kind: "send", provider, ok: false, category: outcome.category, httpStatus: outcome.httpStatus, providerCode: outcome.providerCode, message: outcome.message, template: "next_batch_alert", attempts: row.attempts });
    }
    if (step.status === "pending") result.retrying += 1;
    else if (step.status === "failed") result.failed += 1;
    else {
      result.held += 1;
      if (errorScope(outcome.category) === "provider") {
        // Configuration à corriger : les autres envois réservés repartent en attente, sans tentative comptée.
        for (const other of rows.slice(i + 1)) await update(other.id, { status: "pending", attempts: other.attempts - 1, claimed_at: null });
        result.blocked = outcome.category;
        break;
      }
    }
  }
  result.waiting = await waiting();
  return result;
}

