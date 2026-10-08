import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderTracker } from "@/components/order/OrderTracker";
import { brand } from "@/config/brand";
import { getOrderByToken } from "@/lib/orders/get-order";
import { paymentMethods } from "@/lib/payments";

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

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-8 sm:px-6">
      <OrderTracker
        token={token}
        returningFromPayment={retour === "paiement"}
        paymentMethods={paymentMethods()}
        pickupAddress={brand.pickupAddress}
        order={{
          reference: order.reference,
          status: order.status,
          paymentStatus: order.paymentStatus,
          fulfillment: order.fulfillment,
          customerName: order.customerName,
          addressLine: order.addressLine,
          district: order.district,
          landmark: order.landmark,
          latitude: order.latitude,
          longitude: order.longitude,
          pickupCode: order.pickupCode,
          subtotalFcfa: order.subtotalFcfa,
          deliveryFeeFcfa: order.deliveryFeeFcfa,
          totalFcfa: order.totalFcfa,
          reservationExpiresAt: order.reservationExpiresAt,
          cycleNumber: order.cycleNumber,
          slot: order.slot,
          items: order.items,
          history: order.history,
        }}
      />
    </div>
  );
}
