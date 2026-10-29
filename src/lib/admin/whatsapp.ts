import { brand } from "@/config/brand";
import { formatFcfa } from "@/lib/money";

/**
 * Messages WhatsApp pré-rédigés : ils s'ouvrent dans WhatsApp, Alima relit et appuie sur Envoyer.
 * Aucun envoi automatique (WhatsApp Business n'est pas configuré pour ces messages).
 */
export function whatsappLink(phoneE164: string, text: string): string {
  return `https://wa.me/${phoneE164.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export function telLink(phoneE164: string): string {
  return `tel:${phoneE164.replace(/[^\d+]/g, "")}`;
}

export type WhatsappTemplate = "payment_check" | "payment_reminder" | "payment_received" | "ready_pickup" | "out_for_delivery" | "landmark" | "general";

export function whatsappMessage(
  template: WhatsappTemplate,
  o: { customerName: string; reference: string; totalFcfa: number; pickupCode?: string | null; pickupAddress?: string; method?: string },
): string {
  const first = o.customerName.split(/\s+/)[0] ?? o.customerName;
  const method = o.method ?? "Wave";
  switch (template) {
    case "payment_check":
      return `Bonjour ${first}, c'est ${brand.name}. Nous ne retrouvons pas encore votre paiement ${method} de ${formatFcfa(o.totalFcfa)} pour la commande ${o.reference}. Pourriez-vous nous envoyer la capture de la transaction ? Merci !`;
    case "payment_reminder":
      return `Bonjour ${first}, c'est ${brand.name}. Votre commande ${o.reference} (${formatFcfa(o.totalFcfa)}) attend encore votre paiement ${method}. Si c'est déjà fait, envoyez-nous simplement la capture de la transaction ; sinon, vous pouvez payer depuis votre lien de suivi. Merci !`;
    case "payment_received":
      return `Bonjour ${first}, c'est ${brand.name}. Nous avons bien reçu votre paiement pour la commande ${o.reference}. Merci ! Nous vous prévenons dès qu'elle est prête.`;
    case "ready_pickup":
      return `Bonjour ${first}, votre commande ${o.reference} est prête ! Retrait : ${o.pickupAddress ?? brand.pickupAddress}.${o.pickupCode ? ` Votre code de retrait : ${o.pickupCode}.` : ""} À très vite.`;
    case "out_for_delivery":
      return `Bonjour ${first}, votre commande ${o.reference} est en route avec notre livreur. Les frais de livraison se règlent directement au livreur. Bonne dégustation !`;
    case "landmark":
      return `Bonjour ${first}, c'est ${brand.name}. Pour livrer votre commande ${o.reference}, pourriez-vous nous préciser un point de repère ou nous envoyer votre position ? Merci !`;
    default:
      return `Bonjour ${first}, c'est ${brand.name} au sujet de votre commande ${o.reference}.`;
  }
}
