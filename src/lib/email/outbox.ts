import "server-only";
import { getAutomationSettings } from "@/lib/admin/today";
import { brevoSend, classifyHttpError, errorLabel, errorScope, isStale, nextStepAfterFailure, type DeliveryResult, type EmailErrorCategory } from "@/lib/email/delivery";
import { DEFAULT_EMAIL_FROM, parseSender } from "@/lib/email/sender";
import { renderDigest, renderOrderEmail, type EmailTemplate, type RenderedEmail } from "@/lib/email/templates";
import { serverEnv } from "@/lib/env";
import { generateTrackingToken } from "@/lib/orders/tracking";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type EmailChannel = "brevo" | "resend" | "test" | "none";

/** Service d'envoi disponible : Brevo, sinon Resend si configuré ; boîte de test hors production ; sinon aucun (rien n'est envoyé). */
export function emailChannel(): EmailChannel {
  const env = serverEnv();
  if (env.BREVO_API_KEY) return "brevo";
  if (env.RESEND_API_KEY && env.EMAIL_FROM) return "resend";
  if (env.APP_ENV !== "production") return "test";
  return "none";
}

/** Expéditeur des e-mails (adresse du domaine, jamais secrète). */
export function emailSender(): { name?: string; email: string } {
  return parseSender(serverEnv().EMAIL_FROM ?? DEFAULT_EMAIL_FROM);
}

/** Déploiement en cours : une nouvelle configuration du service n'est prise en compte qu'après redéploiement. */
export function currentDeployment(): string {
  return (process.env.VERCEL_DEPLOYMENT_ID ?? "local").slice(0, 80);
}

interface OutboxRow {
  id: number;
  idempotency_key: string;
  template: EmailTemplate;
  order_id: string | null;
  to_email: string;
  payload: Record<string, unknown>;
  attempts: number;
  created_at: string;
  error_category: string | null;
}

export interface ProviderCheck {
  kind: "test" | "send";
  provider: "brevo" | "resend";
  ok: boolean;
  category?: EmailErrorCategory | null;
  httpStatus?: number | null;
  providerCode?: string | null;
  message?: string | null;
  outboxId?: number | null;
  template?: string | null;
  attempts?: number | null;
  actor?: string | null;
}

/** Journal du prestataire : catégorie, code HTTP et message déjà nettoyés. Jamais de clé ni d'en-tête. */
export async function recordProviderCheck(check: ProviderCheck): Promise<void> {
  await supabaseAdmin()
    .from("email_provider_checks")
    .insert({
      kind: check.kind,
      provider: check.provider,
      ok: check.ok,
      category: check.category ?? null,
      http_status: check.httpStatus ?? null,
      provider_code: check.providerCode ?? null,
      message: check.message || null,
      outbox_id: check.outboxId ?? null,
      template: check.template ?? null,
      attempts: check.attempts ?? null,
      environment: serverEnv().APP_ENV,
      deployment: currentDeployment(),
      actor: check.actor ?? null,
    });
}

/**
 * Envois suspendus ? Oui si le dernier résultat connu du prestataire est une erreur de configuration
 * (clé, adresse du serveur, expéditeur, quota) obtenue avec le déploiement actuel. Un redéploiement
 * (nouvelle configuration) ou un test de connexion réussi lève la suspension : aucune boucle d'échecs.
 */
export async function providerBlock(provider: "brevo" | "resend"): Promise<{ category: EmailErrorCategory; at: string } | null> {
  const { data, error } = await supabaseAdmin()
    .from("email_provider_checks")
    .select("ok, category, deployment, created_at")
    .eq("provider", provider)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.ok || errorScope(data.category as string) !== "provider") return null;
  if (data.deployment !== currentDeployment()) return null;
  return { category: data.category as EmailErrorCategory, at: data.created_at as string };
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

/** Envoi d'un message rendu (file d'envoi ou e-mail d'essai de l'atelier). */
export async function deliver(channel: Exclude<EmailChannel, "none">, row: Pick<OutboxRow, "to_email" | "idempotency_key">, email: RenderedEmail): Promise<DeliveryResult> {
  if (channel === "test") {
    const { error } = await supabaseAdmin().from("test_messages").insert({ channel: "email", destination: row.to_email, body: `${email.subject}\n\n${email.text}` });
    if (error) throw error;
    return { ok: true, messageId: null };
  }
  const env = serverEnv();
  if (channel === "brevo") {
    // Brevo n'a pas de clé d'idempotence : la réservation atomique de la ligne évite le double envoi.
    return brevoSend(fetch, env.BREVO_API_KEY, { sender: emailSender(), to: row.to_email, subject: email.subject, html: email.html, text: email.text, reference: row.idempotency_key });
  }
  try {
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
    if (!response.ok) return { ok: false, category: classifyHttpError(response.status), httpStatus: response.status, providerCode: null, message: "" };
    const body = (await response.json().catch(() => null)) as { id?: unknown } | null;
    return { ok: true, messageId: typeof body?.id === "string" ? body.id : null };
  } catch {
    return { ok: false, category: "network", httpStatus: null, providerCode: null, message: "" };
  }
}

export interface OutboxResult {
  channel: EmailChannel;
  sent: number;
  skipped: number;
  /** Échecs définitifs pendant ce passage. */
  failed: number;
  /** Erreurs temporaires : nouvelle tentative datée. */
  retrying: number;
  /** Mis en pause (configuration à corriger ou message ancien). */
  held: number;
  /** Messages restant à envoyer (en attente ou réservés). */
  waiting: number;
  /** Envois suspendus : erreur de configuration du prestataire. */
  blocked?: EmailErrorCategory;
}

async function countWaiting(): Promise<number> {
  const { count } = await supabaseAdmin().from("email_outbox").select("id", { count: "exact", head: true }).in("status", ["pending", "sending"]);
  return count ?? 0;
}

/**
 * Envoie les e-mails dus. Chaque ligne est réservée atomiquement (claim_email_outbox) : deux processus
 * n'envoient jamais le même message. Erreur temporaire → nouvelle tentative au délai progressif ;
 * refus du message → échec définitif ; erreur de configuration → message en pause et envois suspendus
 * jusqu'au prochain déploiement ou test réussi. Les messages anciens attendent la confirmation de l'équipe.
 */
export async function processOutbox(limit = 25): Promise<OutboxResult> {
  const db = supabaseAdmin();
  const channel = emailChannel();
  const result: OutboxResult = { channel, sent: 0, skipped: 0, failed: 0, retrying: 0, held: 0, waiting: 0 };
  await db.rpc("release_stale_email_claims", { p_minutes: 15 });

  if (channel === "none") {
    result.blocked = "key_missing";
    result.waiting = await countWaiting();
    return result;
  }
  const provider = channel === "brevo" || channel === "resend" ? channel : null;
  if (provider) {
    const block = await providerBlock(provider);
    if (block) {
      result.blocked = block.category;
      result.waiting = await countWaiting();
      return result;
    }
  }

  const { data, error } = await db.rpc("claim_email_outbox", { p_limit: limit });
  if (error) throw error;
  const rows = (data ?? []) as OutboxRow[];
  if (rows.length === 0) return result;
  const settings = await getAutomationSettings();
  const now = new Date();
  let successRecorded = false;
  const update = (id: number, values: Record<string, unknown>) => db.from("email_outbox").update({ ...values, updated_at: new Date().toISOString() }).eq("id", id).eq("status", "sending");

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.template !== "admin_digest" && !settings.customerEmails) {
      await update(row.id, { status: "skipped", last_error: "E-mails clientes désactivés dans les réglages." });
      result.skipped += 1;
      continue;
    }
    if (isStale(row.created_at, now, row.error_category === "retry_requested")) {
      await update(row.id, { status: "held", error_category: "stale", last_error: errorLabel("stale"), attempts: row.attempts - 1 });
      result.held += 1;
      continue;
    }
    let outcome: DeliveryResult;
    try {
      const email = await render(row);
      if (!email) {
        await update(row.id, { status: "skipped", last_error: "Commande introuvable." });
        result.skipped += 1;
        continue;
      }
      outcome = await deliver(channel, row, email);
    } catch {
      outcome = { ok: false, category: "unknown", httpStatus: null, providerCode: null, message: "" };
    }

    if (outcome.ok) {
      await update(row.id, {
        status: "sent",
        sent_at: new Date().toISOString(),
        provider_message_id: outcome.messageId,
        next_attempt_at: null,
        last_error: null,
        error_category: null,
        error_http_status: null,
        error_provider_code: null,
      });
      result.sent += 1;
      if (provider && !successRecorded) {
        await recordProviderCheck({ kind: "send", provider, ok: true, outboxId: row.id, template: row.template, attempts: row.attempts });
        successRecorded = true;
      }
      continue;
    }

    const step = nextStepAfterFailure(outcome.category, row.attempts, now);
    await update(row.id, {
      status: step.status,
      next_attempt_at: step.status === "pending" ? step.nextAttemptAt.toISOString() : null,
      error_category: outcome.category,
      error_http_status: outcome.httpStatus,
      error_provider_code: outcome.providerCode,
      last_error: errorLabel(outcome.category),
    });
    if (provider) {
      await recordProviderCheck({
        kind: "send",
        provider,
        ok: false,
        category: outcome.category,
        httpStatus: outcome.httpStatus,
        providerCode: outcome.providerCode,
        message: outcome.message,
        outboxId: row.id,
        template: row.template,
        attempts: row.attempts,
      });
    }
    if (step.status === "pending") result.retrying += 1;
    else if (step.status === "failed") result.failed += 1;
    else {
      result.held += 1;
      if (errorScope(outcome.category) === "provider") {
        // Configuration à corriger : les autres messages réservés reviennent en attente, sans tentative comptée.
        const rest = rows.slice(i + 1);
        for (const other of rest) await update(other.id, { status: "pending", attempts: other.attempts - 1, claimed_at: null });
        result.blocked = outcome.category;
        break;
      }
    }
  }
  result.waiting = await countWaiting();
  return result;
}
