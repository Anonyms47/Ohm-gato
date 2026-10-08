import type { Metadata } from "next";
import { BrandHeading } from "@/components/brand/BrandHeading";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { getCatalog, getSlots, getZones } from "@/lib/catalog";
import { paymentMethods } from "@/lib/payments";

export const metadata: Metadata = { title: "Le bon de fournée", robots: { index: false } };

export default async function CommandePage() {
  const { cycle } = await getCatalog();
  const [slots, zones] = await Promise.all([cycle ? getSlots(cycle.id) : Promise.resolve([]), getZones()]);
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-6">
      <BrandHeading as="h1" size="titre">
        Le bon de fournée
      </BrandHeading>
      <p className="mt-2 text-encre-douce">Six étapes courtes. Rien n&apos;est débité avant la dernière.</p>
      <CheckoutFlow slots={slots} zones={zones} paymentMethods={paymentMethods()} />
    </div>
  );
}
