import type { Metadata } from "next";
import Link from "next/link";
import { Annotation, BrandHeading } from "@/components/brand/BrandHeading";
import { RememberedOrders } from "@/components/order/RememberedOrders";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Suivre ma commande",
  description: "Retrouvez le suivi de votre commande OHMEGATO grâce à votre lien personnel ou à votre compte.",
  alternates: { canonical: "/suivi" },
};

const linkClass = "font-bold underline decoration-caramel decoration-2 underline-offset-4";

export default function SuiviPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Annotation>où en est votre boîte ?</Annotation>
      <BrandHeading as="h1" size="titre">
        Suivre ma commande
      </BrandHeading>
      <p className="mt-4 text-[1.1rem]">
        Chaque commande a son lien de suivi personnel, envoyé par e-mail et affiché après le paiement. Ouvrez ce lien pour voir où en est votre
        commande.
      </p>
      <RememberedOrders />
      <ul className="mt-8 flex flex-col gap-3 text-[1.05rem]">
        <li>
          Vous avez un compte ?{" "}
          <Link href="/compte/commandes" className={linkClass}>
            Retrouvez toutes vos commandes
          </Link>
          .
        </li>
        <li>
          Lien perdu ? Écrivez-nous avec votre référence de commande sur{" "}
          <a href={brand.whatsappUrl} className={linkClass}>
            WhatsApp
          </a>{" "}
          ou à{" "}
          <a href={`mailto:${brand.email}`} className={linkClass}>
            {brand.email}
          </a>
          .
        </li>
      </ul>
    </div>
  );
}
