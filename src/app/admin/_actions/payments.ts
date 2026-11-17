"use server";

import { revalidatePath } from "next/cache";
import type { AdminState } from "@/lib/admin/errors";
import { requireAdmin } from "@/lib/auth/session";
import { getPaymentSettings, safeMerchantLink } from "@/lib/payments/settings";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface PaymentMethodInput {
  provider: "wave" | "orange_money";
  displayName: string;
  merchantLink: string;
  enabled: boolean;
  instructions: string;
}

/**
 * Réglage d'un moyen de paiement par lien marchand. Aucun lien n'est inventé : sans lien valide, le moyen reste masqué.
 * La vérification reste manuelle (aucune API officielle) ; l'action est journalisée sans enregistrer le lien dans le journal.
 */
export async function savePaymentMethod(input: PaymentMethodInput): Promise<AdminState> {
  const admin = await requireAdmin();
  if (input.provider !== "wave" && input.provider !== "orange_money") return { ok: false, message: "Moyen de paiement inconnu." };
  const displayName = input.displayName.replace(/\s+/g, " ").trim();
  if (displayName.length < 1 || displayName.length > 40) return { ok: false, message: "Le nom affiché doit faire entre 1 et 40 caractères." };
  const instructions = input.instructions.trim().slice(0, 400) || null;

  const rawLink = input.merchantLink.trim();
  let merchantLink: string | null = null;
  if (rawLink) {
    merchantLink = safeMerchantLink(rawLink);
    if (!merchantLink) return { ok: false, message: "Le lien marchand doit être une adresse https complète." };
    if (input.provider === "wave" && !merchantLink.startsWith("https://pay.wave.com/")) {
      return { ok: false, message: "Le lien Wave doit commencer par https://pay.wave.com/ (lien marchand fourni par Wave)." };
    }
  }

  const before = (await getPaymentSettings())[input.provider];
  const { error } = await supabaseAdmin()
    .from("payment_method_settings")
    .upsert({ provider: input.provider, display_name: displayName, merchant_link: merchantLink, enabled: input.enabled, instructions, manual_verification: true, updated_by: admin.id });
  if (error) return { ok: false, message: "Enregistrement impossible." };
  await supabaseAdmin().rpc("write_audit", {
    p_actor: admin.id,
    p_action: "payment_method.update",
    p_entity: "payment_method_settings",
    p_entity_id: input.provider,
    p_details: { enabled: input.enabled, wasEnabled: before.enabled, linkSet: merchantLink !== null, linkChanged: (before.linkSource === "atelier" ? before.merchantLink : null) !== merchantLink },
  });
  revalidatePath("/admin/moyens-de-paiement");
  revalidatePath("/commande");
  revalidatePath("/suivi/[token]", "page");
  return { ok: true, message: input.enabled && !merchantLink && input.provider === "orange_money" ? "Enregistré. Orange Money reste masqué tant qu'aucun lien marchand n'est enregistré." : "Moyen de paiement enregistré." };
}
