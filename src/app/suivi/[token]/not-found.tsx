import Link from "next/link";
import { BrandHeading } from "@/components/brand/BrandHeading";
import { brand } from "@/config/brand";

export default function SuiviIntrouvable() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <BrandHeading as="h1" size="titre">
        Lien introuvable
      </BrandHeading>
      <p className="mt-4 text-[1.1rem]">
        Ce lien de suivi n&apos;est pas valide. Écrivez-nous avec votre référence de commande sur{" "}
        <a href={brand.whatsappUrl} className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
          WhatsApp
        </a>{" "}
        et nous vous renverrons le bon lien.
      </p>
      <Link href="/" className="mt-6 inline-flex min-h-11 items-center font-bold underline decoration-caramel decoration-2 underline-offset-4">
        Retour à la fournée
      </Link>
    </div>
  );
}
