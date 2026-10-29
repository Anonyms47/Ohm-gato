import "server-only";
import { serverEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Moyens de paiement par lien marchand (Wave, Orange Money) réglés dans l'atelier.
 * La vérification reste manuelle : seul un administrateur marque une commande payée, jamais le clic sur le lien.
 */
export type MerchantProvider = "wave" | "orange_money";

export interface PaymentMethodSetting {
  provider: MerchantProvider;
  displayName: string;
  /** Lien marchand effectif : celui de l'atelier ; pour Wave, repli sur WAVE_PAYMENT_LINK (fonctionnement historique). */
  merchantLink: string | null;
  /** Le lien vient de l'atelier ou de l'environnement (jamais affiché en entier côté public). */
  linkSource: "atelier" | "environnement" | null;
  enabled: boolean;
  instructions: string | null;
  manualVerification: true;
  updatedAt: string | null;
}

const DEFAULTS: Record<MerchantProvider, { displayName: string; enabled: boolean }> = {
  wave: { displayName: "Wave", enabled: true },
  orange_money: { displayName: "Orange Money", enabled: false },
};

interface Row {
  provider: MerchantProvider;
  display_name: string;
  merchant_link: string | null;
  enabled: boolean;
  instructions: string | null;
  updated_at: string | null;
}

/** Lien https d'un domaine attendu, sinon rien (jamais de lien douteux affiché). */
export function safeMerchantLink(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.hostname.includes(".") ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function getPaymentSettings(): Promise<Record<MerchantProvider, PaymentMethodSetting>> {
  let rows: Row[] = [];
  try {
    const { data, error } = await supabaseAdmin().from("payment_method_settings").select("provider, display_name, merchant_link, enabled, instructions, updated_at");
    if (error) throw error;
    rows = (data ?? []) as Row[];
  } catch (error) {
    // Réglages illisibles (migration non appliquée, base indisponible) : fonctionnement historique, sans bloquer la commande.
    console.error("Réglages de paiement illisibles", { reason: error instanceof Error ? error.message : "inconnue" });
  }
  const envWave = safeMerchantLink(serverEnv().WAVE_PAYMENT_LINK);
  const build = (provider: MerchantProvider): PaymentMethodSetting => {
    const row = rows.find((r) => r.provider === provider);
    const own = safeMerchantLink(row?.merchant_link);
    const fallback = provider === "wave" ? envWave : null;
    return {
      provider,
      displayName: row?.display_name?.trim() || DEFAULTS[provider].displayName,
      merchantLink: own ?? fallback,
      linkSource: own ? "atelier" : fallback ? "environnement" : null,
      enabled: row ? row.enabled : DEFAULTS[provider].enabled,
      instructions: row?.instructions?.trim() || null,
      manualVerification: true,
      updatedAt: row?.updated_at ?? null,
    };
  };
  return { wave: build("wave"), orange_money: build("orange_money") };
}

/** Un moyen est proposé aux clientes seulement s'il est activé ET possède un vrai lien marchand. */
export function isUsable(setting: PaymentMethodSetting): boolean {
  return setting.enabled && setting.merchantLink !== null;
}

/**
 * Lien de paiement à ouvrir. Wave accepte le montant dans le lien ; pour Orange Money aucun paramètre n'est inventé :
 * le montant et la référence sont affichés à la cliente.
 */
export async function merchantLinkFor(provider: MerchantProvider, amountFcfa: number): Promise<string | null> {
  const setting = (await getPaymentSettings())[provider];
  if (!setting.merchantLink) return null;
  if (provider !== "wave") return setting.merchantLink;
  const url = new URL(setting.merchantLink);
  url.searchParams.set("amount", String(amountFcfa));
  return url.toString();
}
