import type { ProviderId } from "@/lib/payments/types";

const labels: Record<ProviderId, string> = { wave: "Wave", wave_link: "Wave (lien marchand)", orange_money: "Orange Money", test: "Paiement de test" };

export function providerLabel(id: ProviderId): string {
  return labels[id];
}
