import { getMyOrder } from "@/lib/account/data";
import { getCurrentUser } from "@/lib/auth/session";
import { providerLabel } from "@/lib/payments/labels";
import { buildReceiptPdf, receiptResponse } from "@/lib/receipt/pdf";

/** Reçu PDF depuis le carnet : seulement pour le propriétaire connecté d'une commande payée. */
export async function GET(_request: Request, { params }: { params: Promise<{ reference: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Connexion requise.", { status: 401, headers: { "Cache-Control": "no-store" } });
  const { reference } = await params;
  const order = await getMyOrder(user.id, decodeURIComponent(reference));
  if (!order || order.paymentStatus !== "paid") {
    return new Response("Reçu indisponible.", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const paid = order.payments.find((p) => p.status === "paid") ?? null;
  const bytes = await buildReceiptPdf({
    reference: order.reference,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    customerName: user.fullName,
    fulfillment: order.fulfillment,
    slot: order.slot,
    items: order.items,
    totalFcfa: order.totalFcfa,
    paymentLabel: paid ? providerLabel(paid.provider) : null,
    paymentReference: null,
  });
  return receiptResponse(bytes, order.reference);
}
