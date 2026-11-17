import { getCurrentUser } from "@/lib/auth/session";
import { getOrderByToken } from "@/lib/orders/get-order";
import { ownedReferences } from "@/lib/orders/owner-cookie";
import { providerLabel } from "@/lib/payments/labels";
import { buildReceiptPdf, receiptResponse } from "@/lib/receipt/pdf";

/**
 * Reçu PDF depuis le lien personnel de suivi. Uniquement pour une commande payée.
 * Le nom du client n'y figure que pour son navigateur d'origine, son compte ou l'équipe,
 * comme sur la page de suivi.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await getOrderByToken(token);
  if (!order || order.paymentStatus !== "paid") {
    return new Response("Reçu indisponible.", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const [owned, user] = await Promise.all([ownedReferences("commandes"), getCurrentUser()]);
  const showPrivate = owned.includes(order.reference) || (user !== null && (user.id === order.userId || user.isAdmin));
  const bytes = await buildReceiptPdf({
    reference: order.reference,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    customerName: showPrivate ? order.customerName : null,
    fulfillment: order.fulfillment,
    slot: order.slot,
    items: order.items,
    totalFcfa: order.totalFcfa,
    deliveryFeeFcfa: order.deliveryFeeFcfa,
    deliveryZoneName: order.deliveryZoneName,
    paymentLabel: order.lastPaymentProvider ? providerLabel(order.lastPaymentProvider) : null,
    paymentReference: null,
  });
  return receiptResponse(bytes, order.reference);
}
