import type { Metadata } from "next";
import { BrandHeading } from "@/components/brand/BrandHeading";
import { UnsubscribeForm } from "@/components/alerts/UnsubscribeForm";
import { isWellFormedAlertToken } from "@/lib/alerts/service";

export const metadata: Metadata = { title: "Se désinscrire des alertes", robots: { index: false, follow: false } };

/** Page de désinscription : rien ne change à l'ouverture du lien (les messageries le pré-chargent), seulement au clic. */
export default async function DesinscriptionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="mx-auto max-w-xl px-4 pb-16 pt-8 sm:px-6">
      <BrandHeading as="h1" size="titre">
        Se désinscrire des alertes
      </BrandHeading>
      {isWellFormedAlertToken(token) ? (
        <UnsubscribeForm token={token} />
      ) : (
        <p className="mt-4" role="alert">
          Ce lien de désinscription n&apos;est pas valide. Écrivez-nous à contact@ohmegato.com et nous retirerons votre adresse.
        </p>
      )}
    </div>
  );
}
