import "server-only";
import { serverEnv } from "@/lib/env";
import { PaymentUnavailableError, type PaymentProviderAdapter } from "@/lib/payments/types";

/** Lien Wave avec le montant pré-rempli quand Wave l'accepte ; le montant reste aussi affiché au client. */
export function waveLinkFor(amountFcfa: number): string | null {
  const link = serverEnv().WAVE_PAYMENT_LINK;
  if (!link) return null;
  const url = new URL(link);
  url.searchParams.set("amount", String(amountFcfa));
  return url.toString();
}

/**
 * Lien de paiement marchand Wave (pas d'API, pas de webhook).
 * Décision d'OHMEGATO : la commande est confirmée dès que le client choisit Wave ;
 * le paiement reste « en attente » jusqu'à son enregistrement par l'équipe dans /admin.
 */
export const waveLinkProvider: PaymentProviderAdapter = {
  id: "wave_link",
  label: "Wave",

  isConfigured() {
    return Boolean(serverEnv().WAVE_PAYMENT_LINK);
  },

  async createCheckout(request) {
    const url = waveLinkFor(request.amountFcfa);
    if (!url) throw new PaymentUnavailableError("wave_link");
    return { sessionId: `lien-${request.paymentId}`, checkoutUrl: url };
  },

  async verifyWebhook() {
    // Wave ne notifie pas les paiements par lien : aucun webhook n'est accepté.
    return { ok: false, reason: "malformed" };
  },
};
