import "server-only";
import { brevoCheck, errorLabel, type EmailErrorCategory } from "@/lib/email/delivery";
import { deliver, emailChannel, emailSender, providerBlock, recordProviderCheck, type EmailChannel } from "@/lib/email/outbox";
import { renderTestEmail } from "@/lib/email/templates";
import { brand } from "@/config/brand";
import { formatDay, formatTime } from "@/lib/dates";
import { serverEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface EmailIssue {
  id: number;
  template: string;
  orderId: string | null;
  orderReference: string | null;
  status: "held" | "failed";
  label: string;
  createdAt: string;
  attempts: number;
}

export interface EmailHealth {
  channel: EmailChannel;
  /** Service d'envoi réel configuré (clé présente). */
  configured: boolean;
  sender: string;
  lastTestOkAt: string | null;
  lastSentAt: string | null;
  lastFailure: { at: string; label: string } | null;
  /** Envois suspendus (configuration à corriger). */
  blocked: { label: string; at: string } | null;
  waiting: number;
  held: number;
  failed: number;
  issues: EmailIssue[];
  login: LoginEmailHealth;
}

/** Codes de connexion par e-mail (Supabase Auth → SMTP Brevo) : dates seulement. */
export interface LoginEmailHealth {
  /** true : dernier code parti ; false : dernier essai refusé ; null : aucun code demandé. */
  operational: boolean | null;
  lastSentAt: string | null;
  lastValidatedAt: string | null;
  lastFailure: { at: string; label: string } | null;
}

const LOGIN_FAILURE_LABELS: Record<string, string> = {
  smtp_failed: "Supabase n'a pas pu envoyer le code (réglages SMTP Brevo dans Supabase à vérifier)",
  rate_limited: "Limite d'envoi de codes atteinte (réglage Supabase), nouvel essai possible plus tard",
};

async function getLoginEmailHealth(): Promise<LoginEmailHealth> {
  const db = supabaseAdmin();
  const [sent, validated, failure] = await Promise.all([
    db.from("otp_requests").select("created_at").eq("channel", "email").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("otp_requests").select("consumed_at").eq("channel", "email").not("consumed_at", "is", null).order("consumed_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("login_email_failures").select("created_at, category").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  for (const r of [sent, validated, failure]) if (r.error) throw r.error;
  const lastSentAt = (sent.data?.created_at as string | undefined) ?? null;
  const lastFailure = failure.data
    ? { at: failure.data.created_at as string, label: LOGIN_FAILURE_LABELS[failure.data.category as string] ?? "Envoi du code refusé" }
    : null;
  const operational = !lastSentAt && !lastFailure ? null : !lastFailure || (lastSentAt !== null && Date.parse(lastSentAt) > Date.parse(lastFailure.at));
  return { operational, lastSentAt, lastValidatedAt: (validated.data?.consumed_at as string | undefined) ?? null, lastFailure };
}

const TEMPLATE_LABELS: Record<string, string> = {
  order_registered: "Commande enregistrée",
  payment_confirmed: "Paiement confirmé",
  order_preparing: "En préparation",
  order_ready: "Prête",
  pickup_ready: "Prête au retrait",
  out_for_delivery: "En route",
  order_delivered: "Livrée ou retirée",
  order_cancelled: "Annulation",
  refund_recorded: "Remboursement",
  admin_digest: "Résumé quotidien",
};

export const templateLabel = (t: string) => TEMPLATE_LABELS[t] ?? t;

function providerOf(channel: EmailChannel): "brevo" | "resend" | null {
  return channel === "brevo" || channel === "resend" ? channel : null;
}

/** État des e-mails pour l'atelier : uniquement des dates, des nombres et des messages compréhensibles. */
export async function getEmailHealth(): Promise<EmailHealth> {
  const db = supabaseAdmin();
  const channel = emailChannel();
  const provider = providerOf(channel);
  const [lastTest, lastSent, lastFailure, waiting, held, failed, issues, block, login] = await Promise.all([
    db.from("email_provider_checks").select("created_at").eq("kind", "test").eq("ok", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("email_outbox").select("sent_at").eq("status", "sent").order("sent_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("email_provider_checks").select("created_at, category").eq("ok", false).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("email_outbox").select("id", { count: "exact", head: true }).in("status", ["pending", "sending"]),
    db.from("email_outbox").select("id", { count: "exact", head: true }).eq("status", "held"),
    db.from("email_outbox").select("id", { count: "exact", head: true }).eq("status", "failed"),
    db
      .from("email_outbox")
      .select("id, template, order_id, status, error_category, created_at, attempts, orders(reference)")
      .in("status", ["held", "failed"])
      .order("created_at", { ascending: false })
      .limit(50),
    provider ? providerBlock(provider) : Promise.resolve(null),
    getLoginEmailHealth(),
  ]);
  for (const r of [lastTest, lastSent, lastFailure, issues]) if (r.error) throw r.error;

  const legacyFailure = !lastFailure.data && issues.data?.some((i) => i.error_category === "auth_rejected");
  return {
    channel,
    configured: provider !== null,
    sender: `${emailSender().name ? `${emailSender().name} ` : ""}<${emailSender().email}>`,
    lastTestOkAt: (lastTest.data?.created_at as string | undefined) ?? null,
    lastSentAt: (lastSent.data?.sent_at as string | undefined) ?? null,
    lastFailure: lastFailure.data
      ? { at: lastFailure.data.created_at as string, label: errorLabel(lastFailure.data.category as string) }
      : legacyFailure
        ? { at: issues.data!.find((i) => i.error_category === "auth_rejected")!.created_at as string, label: errorLabel("auth_rejected") }
        : null,
    blocked:
      channel === "none"
        ? { label: errorLabel("key_missing"), at: new Date().toISOString() }
        : block
          ? { label: errorLabel(block.category), at: block.at }
          : null,
    waiting: waiting.count ?? 0,
    held: held.count ?? 0,
    failed: failed.count ?? 0,
    issues: ((issues.data ?? []) as unknown as { id: number; template: string; order_id: string | null; status: "held" | "failed"; error_category: string | null; created_at: string; attempts: number; orders: { reference: string } | null }[]).map((i) => ({
      id: i.id,
      template: i.template,
      orderId: i.order_id,
      orderReference: i.orders?.reference ?? null,
      status: i.status,
      label: errorLabel(i.error_category),
      createdAt: i.created_at,
      attempts: i.attempts,
    })),
    login,
  };
}

/** Alerte de l'atelier : envois suspendus, puis messages en pause ou en échec. */
export async function getEmailAlertState(): Promise<{ blockedLabel: string | null; toReview: number }> {
  const db = supabaseAdmin();
  const channel = emailChannel();
  const provider = providerOf(channel);
  const [block, review] = await Promise.all([
    provider ? providerBlock(provider) : Promise.resolve(null),
    db.from("email_outbox").select("id", { count: "exact", head: true }).in("status", ["held", "failed"]),
  ]);
  return {
    blockedLabel: channel === "none" ? errorLabel("key_missing") : block ? errorLabel(block.category) : null,
    toReview: review.count ?? 0,
  };
}

export type ConnectionTestResult =
  | { mode: "test" }
  | { mode: "real"; configured: boolean; ok: boolean; category: EmailErrorCategory | null; label: string; testedAt: string };

/**
 * Test minimal du prestataire (aucun e-mail envoyé) : clé reconnue, expéditeur autorisé.
 * Le résultat enregistré ne contient que la catégorie, le code HTTP et un message nettoyé.
 */
export async function testEmailConnection(actor: string): Promise<ConnectionTestResult> {
  const channel = emailChannel();
  const testedAt = new Date().toISOString();
  if (channel === "test") return { mode: "test" };
  if (channel === "resend") {
    await recordProviderCheck({ kind: "test", provider: "resend", ok: true, actor });
    return { mode: "real", configured: true, ok: true, category: null, label: "Service d'envoi configuré.", testedAt };
  }
  const check = await brevoCheck(fetch, serverEnv().BREVO_API_KEY, emailSender().email);
  if (check.ok && check.senderAllowed) {
    await recordProviderCheck({ kind: "test", provider: "brevo", ok: true, actor });
    return { mode: "real", configured: true, ok: true, category: null, label: "Connexion à Brevo réussie, expéditeur autorisé.", testedAt };
  }
  const failure = check.ok
    ? { category: "sender_unverified" as const, httpStatus: null, providerCode: null, message: "" }
    : { category: check.category, httpStatus: check.httpStatus, providerCode: check.providerCode, message: check.message };
  await recordProviderCheck({ kind: "test", provider: "brevo", ok: false, actor, ...failure });
  return { mode: "real", configured: failure.category !== "key_missing", ok: false, category: failure.category, label: errorLabel(failure.category), testedAt };
}


/**
 * Envoi réel d'un e-mail d'essai à l'adresse de la marque (contact@ohmegato.com) : prouve que les
 * e-mails de commande partent. Jamais envoyé à une cliente ; résultat noté sans aucun secret.
 */
export async function sendTestEmail(actor: string): Promise<ConnectionTestResult & { to?: string }> {
  const channel = emailChannel();
  const testedAt = new Date().toISOString();
  if (channel === "none") return { mode: "real", configured: false, ok: false, category: "key_missing", label: errorLabel("key_missing"), testedAt };
  const email = renderTestEmail(`${formatDay(testedAt)} à ${formatTime(testedAt)}`);
  const result = await deliver(channel, { to_email: brand.email, idempotency_key: `test:${testedAt}` }, email);
  if (channel === "test") return { mode: "test" };
  const provider = channel;
  if (result.ok) {
    await recordProviderCheck({ kind: "test", provider, ok: true, actor, template: "test" });
    return { mode: "real", configured: true, ok: true, category: null, label: `E-mail d'essai envoyé à ${brand.email}`, testedAt, to: brand.email };
  }
  await recordProviderCheck({ kind: "test", provider, ok: false, actor, template: "test", category: result.category, httpStatus: result.httpStatus, providerCode: result.providerCode, message: result.message });
  return { mode: "real", configured: result.category !== "key_missing", ok: false, category: result.category, label: errorLabel(result.category), testedAt };
}
