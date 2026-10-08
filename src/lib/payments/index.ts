import "server-only";
import { orangeMoneyProvider } from "@/lib/payments/orange-money";
import { testProvider } from "@/lib/payments/test-provider";
import type { PaymentProviderAdapter, ProviderId } from "@/lib/payments/types";
import { waveProvider } from "@/lib/payments/wave";
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
}

/** Moyens affichés au client. Le fournisseur de test n'apparaît que s'il est actif. */
export function paymentMethods(): PaymentMethodOption[] {
  const list: PaymentMethodOption[] = [
    // Wave Checkout (API) si configuré, sinon le lien marchand Wave.
    waveProvider.isConfigured() || !waveLinkProvider.isConfigured()
      ? { id: "wave", label: waveProvider.label, available: waveProvider.isConfigured() }
      : { id: "wave_link", label: waveLinkProvider.label, available: true },
    { id: "orange_money", label: orangeMoneyProvider.label, available: orangeMoneyProvider.isConfigured() },
  ];
  if (testProvider.isConfigured()) list.push({ id: "test", label: testProvider.label, available: true });
  return list;
}
