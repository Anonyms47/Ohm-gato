import "server-only";
import { getProvider } from "@/lib/payments";
import { getPaymentSettings, isUsable } from "@/lib/payments/settings";
import type { ProviderId } from "@/lib/payments/types";

/**
 * Le moyen peut-il être utilisé maintenant ? Wave et Orange Money suivent les réglages de l'atelier
 * (activé + vrai lien marchand) ; Wave Checkout (API) exige en plus ses identifiants ; le test reste réservé aux essais.
 */
export async function isMethodAvailable(id: ProviderId): Promise<boolean> {
  const settings = await getPaymentSettings();
  switch (id) {
    case "wave_link":
      return isUsable(settings.wave);
    case "orange_money":
      return isUsable(settings.orange_money);
    case "wave":
      return settings.wave.enabled && getProvider("wave").isConfigured();
    default:
      return getProvider(id).isConfigured();
  }
}

/** Moyens par lien marchand : confirmés au choix, paiement vérifié à la main par OHMEGATO. */
export function isLinkMethod(id: ProviderId): id is "wave_link" | "orange_money" {
  return id === "wave_link" || id === "orange_money";
}
