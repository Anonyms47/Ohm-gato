import "server-only";
import { orangeMoneyProvider } from "@/lib/payments/orange-money";
import { testProvider } from "@/lib/payments/test-provider";
import type { PaymentProviderAdapter, ProviderId } from "@/lib/payments/types";
import { waveProvider } from "@/lib/payments/wave";
import { getPaymentSettings, isUsable } from "@/lib/payments/settings";
import { waveLinkProvider } from "@/lib/payments/wave-link";

const providers: Record<ProviderId, PaymentProviderAdapter> = {
  wave: waveProvider,
  wave_link: waveLinkProvider,
  orange_money: orangeMoneyProvider,
  test: testProvider,
};

export function getProvider(id: ProviderId): PaymentProviderAdapter {
  return providers[id];
}

export interface PaymentMethodOption {
  id: ProviderId;
  label: string;
  available: boolean;
  /** Consigne d'OHMEGATO pour ce moyen (réglée dans l'atelier). */
  instructions?: string | null;
}

/**
 * Moyens affichés au client, réglés dans l'atelier : un moyen désactivé n'apparaît pas ; Orange Money n'apparaît
 * qu'avec un vrai lien marchand enregistré. Wave Checkout (API) reste prioritaire s'il est configuré.
 * Le fournisseur de test n'apparaît que s'il est actif.
 */
export async function paymentMethods(): Promise<PaymentMethodOption[]> {
  const settings = await getPaymentSettings();
  const list: PaymentMethodOption[] = [];
  if (settings.wave.enabled) {
    if (waveProvider.isConfigured()) list.push({ id: "wave", label: settings.wave.displayName, available: true, instructions: settings.wave.instructions });
    else if (isUsable(settings.wave)) list.push({ id: "wave_link", label: settings.wave.displayName, available: true, instructions: settings.wave.instructions });
    else list.push({ id: "wave", label: settings.wave.displayName, available: false });
  }
  if (isUsable(settings.orange_money)) {
    list.push({ id: "orange_money", label: settings.orange_money.displayName, available: true, instructions: settings.orange_money.instructions });
  }
  if (testProvider.isConfigured()) list.push({ id: "test", label: testProvider.label, available: true });
  return list;
}
