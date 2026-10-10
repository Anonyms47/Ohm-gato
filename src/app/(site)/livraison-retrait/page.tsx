import { LegalPage, legalMetadata } from "@/components/legal/LegalPage";

export const metadata = legalMetadata("livraison-retrait");

export default function Page() {
  return (
    <LegalPage
      slug="livraison-retrait"
      before={
        <p
          role="note"
          data-testid="encart-livraison"
          className="rounded-[14px] border-2 border-chocolat bg-caramel/25 p-4 text-[1.15rem] font-bold shadow-[0_4px_0_var(--ohm-chocolat)] print:shadow-none"
        >
          Votre paiement en ligne couvre uniquement les produits. Les frais de livraison sont réglés séparément au livreur.
        </p>
      }
    />
  );
}
