import { cn } from "@/lib/cn";
import { deliveryFeeLine } from "@/lib/delivery/zones";

/** Texte officiel : les frais de livraison ne sont jamais payés sur le site. */
export const DELIVERY_FEE_NOTICE = "Frais de livraison non compris, à régler directement au livreur selon votre position.";

/** Phrase de frais : montant de la zone (réglé au livreur) ou, sans zone connue, le texte officiel. */
export function deliveryFeeNotice(feeFcfa?: number | null): string {
  return typeof feeFcfa === "number" ? `${deliveryFeeLine(feeFcfa)} Non inclus dans votre paiement en ligne.` : DELIVERY_FEE_NOTICE;
}

export function DeliveryFeeNotice({ className, feeFcfa }: { className?: string; feeFcfa?: number | null }) {
  return (
    <p className={cn("rounded-[10px] border-2 border-caramel-encre bg-blanc-casse px-3 py-2 font-bold text-caramel-encre", className)}>
      {deliveryFeeNotice(feeFcfa)}
    </p>
  );
}
