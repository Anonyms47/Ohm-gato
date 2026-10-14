/**
 * Envoi des e-mails : classification des erreurs du prestataire, nettoyage des messages,
 * politique de nouvelles tentatives. Fonctions pures (aucune lecture d'environnement) :
 * la clé est passée en argument par le serveur et n'apparaît jamais dans un résultat.
 */

export type EmailErrorCategory =
  | "key_missing"
  | "key_invalid"
  | "ip_not_allowed"
  | "sender_unverified"
  | "account_restricted"
  | "quota"
  | "recipient_blocked"
  | "bad_request"
  | "rate_limited"
  | "provider_unavailable"
  | "network"
  | "auth_rejected"
  | "unknown_outcome"
  | "stale"
  | "unknown";

/**
 * provider : configuration du service à corriger (tous les envois s'arrêtent) ;
 * message : ce message seul est refusé ; temporary : nouvelle tentative plus tard.
 */
export type ErrorScope = "provider" | "message" | "temporary";

export const ERROR_INFO: Record<EmailErrorCategory, { scope: ErrorScope; label: string }> = {
  key_missing: { scope: "provider", label: "La clé Brevo n'est pas configurée" },
  key_invalid: { scope: "provider", label: "La clé Brevo n'est pas reconnue" },
  ip_not_allowed: { scope: "provider", label: "Brevo refuse actuellement l'adresse du serveur" },
  sender_unverified: { scope: "provider", label: "L'adresse expéditrice doit être vérifiée" },
  account_restricted: { scope: "provider", label: "Le compte Brevo est suspendu ou en cours de validation" },
  quota: { scope: "provider", label: "Le quota d'envoi est atteint" },
  auth_rejected: { scope: "provider", label: "Brevo a refusé l'accès (clé ou adresse du serveur)" },
  recipient_blocked: { scope: "message", label: "Brevo bloque cette adresse de destination" },
  bad_request: { scope: "message", label: "Brevo a refusé ce message (contenu incorrect)" },
  unknown_outcome: { scope: "message", label: "Envoi interrompu : vérifiez dans Brevo avant de réessayer" },
  stale: { scope: "message", label: "Message de plus de 3 jours : à confirmer avant l'envoi" },
  rate_limited: { scope: "temporary", label: "Brevo est temporairement indisponible" },
  provider_unavailable: { scope: "temporary", label: "Brevo est temporairement indisponible" },
  network: { scope: "temporary", label: "Brevo est temporairement indisponible" },
  unknown: { scope: "temporary", label: "Erreur inattendue du service d'envoi" },
};

export function errorLabel(category: string | null | undefined): string {
  return (category && ERROR_INFO[category as EmailErrorCategory]?.label) || "Erreur inattendue du service d'envoi";
}

export function errorScope(category: string | null | undefined): ErrorScope {
  return (category && ERROR_INFO[category as EmailErrorCategory]?.scope) || "temporary";
}

const SECRET_PATTERNS = [/xkeysib-[A-Za-z0-9-]+/g, /xsmtpsib-[A-Za-z0-9-]+/g, /\bre_[A-Za-z0-9_]{10,}/g, /\b(api[-_ ]?key|password|authorization)\s*[:=]\s*\S+/gi];
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const IPV6 = /\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}\b/gi;
const EMAIL = /[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+/g;
const URL = /https?:\/\/\S+/g;

/** Message du prestataire sans secret, adresse IP, adresse e-mail ni lien ; 200 caractères au plus. */
export function sanitizeProviderMessage(message: unknown, secrets: (string | undefined)[] = []): string {
  let text = typeof message === "string" ? message : "";
  for (const secret of secrets) if (secret && secret.length >= 6) text = text.split(secret).join("[secret]");
  for (const pattern of SECRET_PATTERNS) text = text.replace(pattern, "[secret]");
  text = text.replace(URL, "[lien]").replace(EMAIL, "[adresse]").replace(IPV4, "[IP]").replace(IPV6, "[IP]");
  return text.replace(/\s+/g, " ").trim().slice(0, 200);
}

/** Catégorie d'une réponse d'erreur Brevo (corps JSON { code, message }). */
export function classifyBrevoError(status: number, body: { code?: unknown; message?: unknown } | null): EmailErrorCategory {
  const code = typeof body?.code === "string" ? body.code.toLowerCase() : "";
  const message = typeof body?.message === "string" ? body.message.toLowerCase() : "";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "provider_unavailable";
  if (status === 401) {
    if (/\bip\b|ip address|unrecogni[sz]ed ip|authori[sz]ed_?ips/.test(message)) return "ip_not_allowed";
    if (/key not found|invalid api key|api key is not enabled|key.*(disabled|revoked|not valid|invalid)/.test(message) || code === "unauthorized") return "key_invalid";
    return "auth_rejected";
  }
  if (status === 402 || code === "not_enough_credits" || /credit|quota|limit exceeded/.test(message)) return "quota";
  if (status === 403) {
    if (/sender|from address/.test(message)) return "sender_unverified";
    return "account_restricted";
  }
  if (/sender|from address/.test(message)) return "sender_unverified";
  if (/blacklist|blocked|unsubscribed|hard ?bounce/.test(message)) return "recipient_blocked";
  if (status >= 400) return "bad_request";
  return "unknown";
}

export interface DeliveryFailure {
  ok: false;
  category: EmailErrorCategory;
  httpStatus: number | null;
  providerCode: string | null;
  message: string;
}

export type DeliveryResult = { ok: true; messageId: string | null } | DeliveryFailure;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const BREVO_API = "https://api.brevo.com/v3";

async function failure(response: Response, secrets: string[]): Promise<DeliveryFailure> {
  const body = (await response.json().catch(() => null)) as { code?: unknown; message?: unknown } | null;
  return {
    ok: false,
    category: classifyBrevoError(response.status, body),
    httpStatus: response.status,
    providerCode: typeof body?.code === "string" ? sanitizeProviderMessage(body.code, secrets).slice(0, 80) : null,
    message: sanitizeProviderMessage(body?.message, secrets),
  };
}

function networkFailure(error: unknown, secrets: string[]): DeliveryFailure {
  return { ok: false, category: "network", httpStatus: null, providerCode: null, message: sanitizeProviderMessage(error instanceof Error ? error.message : "", secrets) };
}

export interface BrevoMessage {
  sender: { name?: string; email: string };
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Repère de l'événement (clé d'idempotence de la file), transmis en en-tête. */
  reference: string;
}

/** Envoi transactionnel Brevo. Ne renvoie jamais la clé ni les en-têtes. */
export async function brevoSend(fetchImpl: FetchLike, apiKey: string | undefined, message: BrevoMessage): Promise<DeliveryResult> {
  if (!apiKey) return { ok: false, category: "key_missing", httpStatus: null, providerCode: null, message: "" };
  try {
    const response = await fetchImpl(`${BREVO_API}/smtp/email`, {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: message.sender,
        to: [{ email: message.to }],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
        headers: { "X-Ohmegato-Reference": message.reference },
      }),
    });
    if (!response.ok) return failure(response, [apiKey]);
    const body = (await response.json().catch(() => null)) as { messageId?: unknown } | null;
    return { ok: true, messageId: typeof body?.messageId === "string" ? body.messageId.slice(0, 200) : null };
  } catch (error) {
    return networkFailure(error, [apiKey]);
  }
}

export type ConnectionCheck = { ok: true; senderAllowed: boolean } | DeliveryFailure;

/**
 * Test minimal : la clé est-elle reconnue (compte), l'expéditeur est-il autorisé
 * (expéditeur actif ou domaine authentifié) ? Aucun e-mail n'est envoyé.
 */
export async function brevoCheck(fetchImpl: FetchLike, apiKey: string | undefined, senderEmail: string): Promise<ConnectionCheck> {
  if (!apiKey) return { ok: false, category: "key_missing", httpStatus: null, providerCode: null, message: "" };
  const headers = { "api-key": apiKey, Accept: "application/json" };
  try {
    const account = await fetchImpl(`${BREVO_API}/account`, { headers });
    if (!account.ok) return failure(account, [apiKey]);
    const [senders, domains] = await Promise.all([fetchImpl(`${BREVO_API}/senders`, { headers }), fetchImpl(`${BREVO_API}/senders/domains`, { headers })]);
    const email = senderEmail.toLowerCase();
    const domain = email.split("@")[1] ?? "";
    let allowed = false;
    if (senders.ok) {
      const list = ((await senders.json().catch(() => null)) as { senders?: { email?: string; active?: boolean }[] } | null)?.senders ?? [];
      allowed = list.some((s) => s.email?.toLowerCase() === email && s.active !== false);
    }
    if (!allowed && domains.ok) {
      const list = ((await domains.json().catch(() => null)) as { domains?: { domain_name?: string; authenticated?: boolean }[] } | null)?.domains ?? [];
      allowed = list.some((d) => d.domain_name?.toLowerCase() === domain && d.authenticated === true);
    }
    return { ok: true, senderAllowed: allowed };
  } catch (error) {
    return networkFailure(error, [apiKey]);
  }
}

/** Délais progressifs avant chaque nouvelle tentative d'une erreur temporaire. */
export const RETRY_DELAYS_MS = [5 * 60_000, 30 * 60_000, 2 * 3_600_000, 6 * 3_600_000];
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;

export type NextStep = { status: "pending"; nextAttemptAt: Date } | { status: "held" } | { status: "failed" };

/**
 * Suite d'un échec : erreur de configuration → message en pause (aucune boucle) ;
 * refus du message → échec définitif ; erreur temporaire → nouvelle tentative datée,
 * puis échec définitif après le nombre maximal d'essais.
 */
export function nextStepAfterFailure(category: EmailErrorCategory, attempts: number, now: Date): NextStep {
  if (category === "stale") return { status: "held" };
  const scope = ERROR_INFO[category].scope;
  if (scope === "provider") return { status: "held" };
  if (scope === "message") return { status: "failed" };
  if (attempts >= MAX_ATTEMPTS) return { status: "failed" };
  const delay = RETRY_DELAYS_MS[Math.max(0, attempts - 1)] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]!;
  return { status: "pending", nextAttemptAt: new Date(now.getTime() + delay) };
}

/** Au-delà, un message jamais parti n'est plus envoyé automatiquement (il serait hors de propos). */
export const STALE_AFTER_MS = 3 * 24 * 3_600_000;

/** Un message ancien attend la confirmation de l'équipe, sauf s'il a été repris à la main. */
export function isStale(createdAt: string, now: Date, retryRequested: boolean): boolean {
  return !retryRequested && now.getTime() - Date.parse(createdAt) > STALE_AFTER_MS;
}

/** Catégorie d'une réponse d'erreur Resend (service de secours). */
export function classifyHttpError(status: number): EmailErrorCategory {
  if (status === 401 || status === 403) return "key_invalid";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "provider_unavailable";
  return "bad_request";
}
