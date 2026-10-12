import "server-only";
import { getAutomationSettings } from "@/lib/admin/today";
import { renderDigest, renderOrderEmail, type EmailTemplate, type RenderedEmail } from "@/lib/email/templates";
import { serverEnv } from "@/lib/env";
import { generateTrackingToken } from "@/lib/orders/tracking";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type EmailChannel = "resend" | "test" | "none";

/** Service d'envoi disponible : Resend si configuré ; boîte de test hors production ; sinon aucun (rien n'est envoyé). */
export function emailChannel(): EmailChannel {
  const env = serverEnv();
  if (env.RESEND_API_KEY && env.EMAIL_FROM) return "resend";
  if (env.APP_ENV !== "production") return "test";
  return "none";
}

interface OutboxRow {
  id: number;
  idempotency_key: string;
  template: EmailTemplate;
  order_id: string | null;
  to_email: string;
  payload: Record<string, unknown>;
  attempts: number;
}

async function render(row: OutboxRow): Promise<RenderedEmail | null> {
  const site = serverEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (row.template === "admin_digest") {
    return renderDigest(String(row.payload.date ?? ""), (row.payload.lines as string[] | undefined) ?? [], `${site}/admin`);
  }
  if (!row.order_id) return null;
  const { data: o, error } = await supabaseAdmin()
    .from("orders")
    .select("reference, customer_name, total_fcfa, fulfillment, pickup_code, idempotency_key, payment_status, delivery_slots(starts_at, ends_at)")
    .eq("id", row.order_id)
    .maybeSingle();
  if (error) throw error;
  if (!o) return null;
  const slot = o.delivery_slots as unknown as { starts_at: string; ends_at: string } | null;
  const token = generateTrackingToken(o.idempotency_key as string).token;
  return renderOrderEmail(row.template, {
    customerName: o.customer_name as string,
    reference: o.reference as string,
    totalFcfa: o.total_fcfa as number,
    fulfillment: o.fulfillment as "pickup" | "delivery",
    slot: slot ? { startsAt: slot.starts_at, endsAt: slot.ends_at } : null,
    pickupCode: (o.pickup_code as string | null) ?? null,
    trackingUrl: `${site}/suivi/${token}`,
    // Le reçu payé n'existe qu'après la vérification du paiement.
    receiptUrl: o.payment_status === "paid" ? `${site}/suivi/${token}/recu` : null,
    refund: row.payload.amount_fcfa ? { amountFcfa: Number(row.payload.amount_fcfa), method: String(row.payload.method ?? "") } : null,
  });
}

async function deliver(channel: Exclude<EmailChannel, "none">, row: OutboxRow, email: RenderedEmail) {
  if (channel === "test") {
    const { error } = await supabaseAdmin().from("test_messages").insert({ channel: "email", destination: row.to_email, body: `${email.subject}\n\n${email.text}` });
    if (error) throw error;
    return;
  }
  const env = serverEnv();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      // Même clé à chaque tentative : le service n'envoie jamais deux fois le même e-mail.
      "Idempotency-Key": row.idempotency_key,
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [row.to_email], subject: email.subject, text: email.text, html: email.html }),
  });
  if (!response.ok) throw new Error(`Envoi refusé (${response.status})`);
}

export interface OutboxResult {
  channel: EmailChannel;
  sent: number;
  skipped: number;
  failed: number;
  waiting: number;
}

/**
 * Envoie les e-mails en attente. Chaque ligne est « réservée » par un verrou optimiste (attempts),
 * si bien que deux exécutions simultanées n'envoient jamais la même ligne ; la clé d'idempotence
 * protège aussi côté service d'envoi.
 */
export async function processOutbox(limit = 25): Promise<OutboxResult> {
  const db = supabaseAdmin();
  const channel = emailChannel();
  const result: OutboxResult = { channel, sent: 0, skipped: 0, failed: 0, waiting: 0 };
  const { data, error } = await db.from("email_outbox").select("id, idempotency_key, template, order_id, to_email, payload, attempts").eq("status", "pending").order("created_at").limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as OutboxRow[];
  if (rows.length === 0) return result;
  if (channel === "none") {
    result.waiting = rows.length;
    return result;
  }
  const settings = await getAutomationSettings();

  for (const row of rows) {
    const claim = await db.from("email_outbox").update({ attempts: row.attempts + 1 }).eq("id", row.id).eq("status", "pending").eq("attempts", row.attempts).select("id");
    if (claim.error || (claim.data ?? []).length === 0) continue; // déjà pris par une autre exécution
    if (row.template !== "admin_digest" && !settings.customerEmails) {
      await db.from("email_outbox").update({ status: "skipped", last_error: "E-mails clientes désactivés dans les réglages." }).eq("id", row.id);
      result.skipped += 1;
      continue;
    }
    try {
      const email = await render(row);
      if (!email) {
        await db.from("email_outbox").update({ status: "skipped", last_error: "Commande introuvable." }).eq("id", row.id);
        result.skipped += 1;
        continue;
      }
      await deliver(channel, row, email);
      await db.from("email_outbox").update({ status: "sent", sent_at: new Date().toISOString(), last_error: null }).eq("id", row.id);
      result.sent += 1;
    } catch (e) {
      const message = e instanceof Error ? e.message.slice(0, 300) : "Erreur d'envoi";
      // Trois essais au plus ; ensuite la ligne reste visible comme échouée dans l'atelier.
      await db.from("email_outbox").update({ status: row.attempts + 1 >= 3 ? "failed" : "pending", last_error: message }).eq("id", row.id);
      result.failed += 1;
    }
  }
  return result;
}
