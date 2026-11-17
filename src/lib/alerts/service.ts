import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { rateLimit } from "@/lib/http";
import { serverEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Texte de consentement présenté (et conservé) avec chaque inscription : consentement explicite et daté. */
export const ALERT_CONSENT_TEXT = "J'accepte de recevoir un e-mail d'OHMEGATO à l'ouverture de la prochaine fournée. Je peux me désinscrire à tout moment.";

export const ALERT_SOURCES = ["accueil", "fournees", "carte", "pied_de_page", "administration", "autre"] as const;
export type AlertSource = (typeof ALERT_SOURCES)[number];

export const subscribeSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Cette adresse e-mail n'est pas valide.").max(160, "Adresse trop longue.")),
  consent: z.literal(true, { message: "Cochez la case pour accepter de recevoir l'alerte." }),
  source: z.enum(ALERT_SOURCES).catch("autre"),
  /** Champ piège : invisible pour les personnes, rempli par les robots. */
  website: z.string().max(200).optional().default(""),
  /** Instant d'affichage du formulaire (ms) : un envoi instantané est suspect. */
  shownAt: z.number().int().optional(),
});

/** Empreinte non réversible (jamais l'adresse IP ni l'e-mail en clair) pour la limitation de débit. */
function fingerprint(kind: string, value: string): string {
  return createHmac("sha256", serverEnv().TRACKING_TOKEN_SECRET).update(`${kind}:${value}`).digest("hex").slice(0, 32);
}

export type SubscribeOutcome =
  | { ok: true }
  | { ok: false; code: "INVALID" | "RATE_LIMITED" | "UNAVAILABLE"; message: string; field?: "email" | "consent" };

/**
 * Inscription aux alertes. La réponse est la même pour une nouvelle adresse, un doublon ou une réactivation
 * (aucune confirmation de l'existence d'une adresse). Aucune adresse IP n'est conservée.
 */
export async function subscribeToAlerts(input: unknown, ip: string): Promise<SubscribeOutcome> {
  const parsed = subscribeSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0] === "consent" ? "consent" : "email";
    return { ok: false, code: "INVALID", message: issue?.message ?? "Vérifiez les informations saisies.", field };
  }
  const data = parsed.data;
  // Robot probable : réponse de succès sans rien enregistrer.
  if (data.website.trim() !== "") return { ok: true };
  if (typeof data.shownAt === "number" && Date.now() - data.shownAt < 1200) return { ok: true };

  const [ipOk, mailOk] = await Promise.all([rateLimit(`alerte:ip:${fingerprint("ip", ip)}`, 6, 3600), rateLimit(`alerte:mail:${fingerprint("mail", data.email)}`, 3, 3600)]);
  if (!ipOk || !mailOk) return { ok: false, code: "RATE_LIMITED", message: "Trop de tentatives. Patientez quelques minutes avant de réessayer." };

  const { error } = await supabaseAdmin().rpc("batch_alert_subscribe", { p_email: data.email, p_source: data.source, p_consent_text: ALERT_CONSENT_TEXT });
  if (error) {
    console.error("Inscription aux alertes impossible", { code: error.code });
    return { ok: false, code: "UNAVAILABLE", message: "Inscription impossible pour le moment. Réessayez plus tard ou écrivez-nous sur WhatsApp." };
  }
  return { ok: true };
}

const TOKEN = /^[0-9a-f]{64}$/;

export function isWellFormedAlertToken(token: string): boolean {
  return TOKEN.test(token);
}

/** Désinscription par le lien personnel de l'e-mail. Idempotente. */
export async function unsubscribeFromAlerts(token: string): Promise<boolean> {
  if (!isWellFormedAlertToken(token)) return false;
  const { data, error } = await supabaseAdmin().rpc("batch_alert_unsubscribe", { p_token: token });
  if (error) throw error;
  return data === true;
}

export function unsubscribeUrl(token: string): string {
  return `${serverEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/alertes/desinscription/${token}`;
}

/** Adresse de désinscription en un clic (POST), pour l'en-tête List-Unsubscribe. */
export function oneClickUnsubscribeUrl(token: string): string {
  return `${serverEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/api/alertes/desinscription?jeton=${token}`;
}
