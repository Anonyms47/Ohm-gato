import type { Metadata } from "next";
import { BrandHeading } from "@/components/brand/BrandHeading";
import { BoxPage } from "@/components/cart/BoxPage";

export const metadata: Metadata = { title: "Ma boîte", robots: { index: false } };

export default function MaBoitePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-6">
      <BrandHeading as="h1" size="titre">
        Ma boîte <span className="sr-only">(panier)</span>
      </BrandHeading>
      <BoxPage />
    </div>
  );
}
