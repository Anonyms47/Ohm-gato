"use server";

import { unsubscribeFromAlerts } from "@/lib/alerts/service";

export async function unsubscribeAction(token: string): Promise<{ ok: boolean; message: string }> {
  try {
    const found = await unsubscribeFromAlerts(token);
    return found
      ? { ok: true, message: "C'est fait : vous ne recevrez plus d'alerte d'ouverture de fournée." }
      : { ok: false, message: "Ce lien de désinscription n'est pas reconnu. Écrivez-nous à contact@ohmegato.com." };
  } catch {
    return { ok: false, message: "Désinscription impossible pour le moment. Réessayez dans quelques minutes." };
  }
}
