import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderTracker } from "@/components/order/OrderTracker";
import { brand } from "@/config/brand";
import { getCurrentUser } from "@/lib/auth/session";
import { phoneLoginAvailable } from "@/lib/messaging";
import { getOrderByToken } from "@/lib/orders/get-order";
import { ownedReferences } from "@/lib/orders/owner-cookie";
import { paymentMethods } from "@/lib/payments";
import { waveLinkFor } from "@/lib/payments/wave-link";

export const metadata: Metadata = {
  title: "Suivi de commande",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function SuiviPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ retour?: string }>;
}) {
  const [{ token }, { retour }] = await Promise.all([params, searchParams]);
  const order = await getOrderByToken(token);

  if (!order) notFound();
  const [owned, user] = await Promise.all([ownedReferences("commandes"), getCurrentUser()]);
  // Informations personnelles : navigateur d'origine, propriétaire connecté ou équipe.
  const showPrivate = owned.includes(order.reference) || (user !== null && (user.id === order.userId || user.isAdmin));

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-8 sm:px-6">
      <OrderTracker
        token={token}
        returningFromPayment={retour === "paiement"}
        paymentMethods={paymentMethods()}
        pickupAddress={brand.pickupAddress}
        phoneLogin={phoneLoginAvailable()}
        waveLink={order.lastPaymentProvider === "wave_link" ? waveLinkFor(order.totalFcfa) : null}
        order={{
          reference: order.reference,
          status: order.status,
          paymentStatus: order.paymentStatus,
          fulfillment: order.fulfillment,
          customerName: showPrivate ? order.customerName : null,
          addressLine: showPrivate ? order.addressLine : null,
          district: showPrivate ? order.district : null,
          landmark: showPrivate ? order.landmark : null,
          latitude: showPrivate ? order.latitude : null,
          longitude: showPrivate ? order.longitude : null,
          pickupCode: showPrivate ? order.pickupCode : null,
          showPrivate,
          subtotalFcfa: order.subtotalFcfa,
          deliveryFeeFcfa: order.deliveryFeeFcfa,
          totalFcfa: order.totalFcfa,
          reservationExpiresAt: order.reservationExpiresAt,
          cycleNumber: order.cycleNumber,
          slot: order.slot,
          items: order.items,
          history: order.history,
          storage: order.storage,
        }}
      />
    </div>
  );
}
