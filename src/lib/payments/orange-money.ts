import "server-only";
import { PaymentUnavailableError, type PaymentProviderAdapter } from "@/lib/payments/types";

/**
 * Orange Money (Sonatel) — intégration à finaliser.
 *
 * Le contrat marchand détermine l'API exacte (paiement web, QR code ou USSD push)
 * et son format de notification. Sans ces documents et identifiants, aucune
 * implémentation ne peut être vérifiée : le moyen de paiement reste bloqué et
 * l'interface affiche « Paiement temporairement indisponible ».
 * Voir docs/INTEGRATIONS.md pour la liste des éléments à obtenir.
 */
export const orangeMoneyProvider: PaymentProviderAdapter = {
  id: "orange_money",
  label: "Orange Money",

  isConfigured() {
    return false;
  },

  async createCheckout() {
    throw new PaymentUnavailableError("orange_money");
  },

  async verifyWebhook() {
    return { ok: false, reason: "malformed" };
  },
};
