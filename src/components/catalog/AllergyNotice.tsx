import { brand } from "@/config/brand";
import { ALLERGY_NOTICE } from "@/lib/allergens";
import { cn } from "@/lib/cn";

/** Avertissement global : fiches produits, Ma boîte, bon de fournée, sur-mesure. */
export function AllergyNotice({ className }: { className?: string }) {
  return (
    <aside
      aria-label="Allergies et intolérances"
      data-testid="avertissement-allergies"
      className={cn("rounded-[12px] border-2 border-chocolat/20 bg-blanc-casse p-4 text-[0.98rem]", className)}
    >
      <p>{ALLERGY_NOTICE}</p>
      <p className="mt-2">
        <a href={brand.whatsappUrl} className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
          Écrire à OHMEGATO sur WhatsApp
        </a>
      </p>
    </aside>
  );
}
