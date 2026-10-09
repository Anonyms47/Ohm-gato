import type { Metadata } from "next";
import { Annotation, BrandHeading } from "@/components/brand/BrandHeading";
import { AllergyNotice } from "@/components/catalog/AllergyNotice";
import { CustomRequestFlow } from "@/components/custom/CustomRequestFlow";
import { getMyAddresses } from "@/lib/account/data";
import { getCurrentUser } from "@/lib/auth/session";
import { formatSenegalPhone } from "@/lib/phone";

export const metadata: Metadata = {
  title: "Sur-mesure & Événements",
  description:
    "Anniversaires, mariages, événements : demandez des verrines, brownies, muffins, choux, gâteaux entiers ou une création. OHMEGATO vous répond avec une proposition.",
};

export default async function SurMesurePage() {
  const user = await getCurrentUser();
  const addresses = user ? await getMyAddresses(user.id) : [];
  return (
    <div className="ohm-grille">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <Annotation>pour vos grands moments</Annotation>
        <BrandHeading as="h1" size="titre">
          Sur-mesure & Événements
        </BrandHeading>
        <p className="mt-3 max-w-prose text-[1.1rem]">
          Racontez-nous votre événement, une question à la fois. Nous étudions chaque demande et revenons vers vous avec une proposition et un
          prix. Comptez 2 à 4 jours selon la quantité.
        </p>
        <AllergyNotice className="mt-4 max-w-prose" />
        <div className="mt-8">
          <CustomRequestFlow
            memberArea={Boolean(user)}
            prefill={user ? { name: user.fullName ?? "", phone: user.phone ? formatSenegalPhone(user.phone) : "", email: user.email ?? "" } : null}
            savedAddresses={addresses}
          />
        </div>
      </div>
    </div>
  );
}
