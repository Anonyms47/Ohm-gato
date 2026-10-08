import type { Metadata } from "next";
import { BrandHeading } from "@/components/brand/BrandHeading";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { getCatalog, getSlots } from "@/lib/catalog";
import { paymentMethods } from "@/lib/payments";

export const metadata: Metadata = { title: "Le bon de fournée", robots: { index: false } };

export default async function CommandePage() {
  const { cycle } = await getCatalog();
  const slots = cycle ? await getSlots(cycle.id) : [];
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-6">
      <BrandHeading as="h1" size="titre">
        Le bon de fournée
      </BrandHeading>
      <p className="mt-2 text-encre-douce">Six étapes courtes. Rien n&apos;est débité avant la dernière.</p>
      <CheckoutFlow slots={slots} paymentMethods={paymentMethods()} />
    </div>
  );
}
