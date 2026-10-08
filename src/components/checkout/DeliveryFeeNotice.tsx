import { cn } from "@/lib/cn";

/** Texte officiel : les frais de livraison ne sont jamais payés sur le site. */
export const DELIVERY_FEE_NOTICE = "Frais de livraison non compris, à régler directement au livreur selon votre position.";

export function DeliveryFeeNotice({ className }: { className?: string }) {
  return (
    <p className={cn("rounded-[10px] border-2 border-caramel-encre bg-blanc-casse px-3 py-2 font-bold text-caramel-encre", className)}>
      {DELIVERY_FEE_NOTICE}
    </p>
  );
}
