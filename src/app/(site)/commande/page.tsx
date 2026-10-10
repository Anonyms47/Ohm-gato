import type { Metadata } from "next";
import { BrandHeading } from "@/components/brand/BrandHeading";
import { BoxAllergens } from "@/components/cart/BoxAllergens";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { getMyAddresses } from "@/lib/account/data";
import { getCurrentUser } from "@/lib/auth/session";
import { getCatalog, getSlots } from "@/lib/catalog";
import { getCheckoutAcceptance } from "@/lib/legal/documents";
import { formatSenegalPhone } from "@/lib/phone";
import { paymentMethods } from "@/lib/payments";

export const metadata: Metadata = { title: "Le bon de fournée", robots: { index: false } };

export default async function CommandePage() {
  const { cycle } = await getCatalog();
  const [slots, user, legal] = await Promise.all([cycle ? getSlots(cycle.id) : Promise.resolve([]), getCurrentUser(), getCheckoutAcceptance()]);
  const acceptance = legal
    ? { termsVersionId: legal.termsId, termsVersion: legal.termsVersion, cancellationVersionId: legal.cancellationId, cancellationVersion: legal.cancellationVersion }
    : null;
  const member = user
    ? {
        contact: { name: user.fullName ?? "", phone: user.phone ? formatSenegalPhone(user.phone) : "", email: user.email ?? "" },
        addresses: await getMyAddresses(user.id),
      }
    : null;
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:px-6">
      <BrandHeading as="h1" size="titre">
        Le bon de fournée
      </BrandHeading>
      <p className="mt-2 text-encre-douce">Six étapes courtes. Rien n&apos;est débité avant la dernière.</p>
      <CheckoutFlow slots={slots} paymentMethods={paymentMethods()} acceptance={acceptance} member={member} />
      <BoxAllergens className="mt-10" />
    </div>
  );
}
