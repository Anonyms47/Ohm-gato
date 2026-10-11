import { getOrderDetail } from "@/lib/admin/data";
import { getCurrentUser } from "@/lib/auth/session";
import { providerLabel } from "@/lib/payments/labels";
import { buildReceiptPdf, receiptResponse } from "@/lib/receipt/pdf";

/** Reçu PDF pour l'équipe : toute commande payée, avec le nom du client et la référence de paiement. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return new Response("Accès refusé.", { status: 403, headers: { "Cache-Control": "no-store" } });
  const { id } = await params;
  const order = await getOrderDetail(id);
  if (!order || order.paymentStatus !== "paid") {
    return new Response("Reçu indisponible : la commande n'est pas payée.", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const paid = order.payments.find((p) => p.status === "paid") ?? null;
  const bytes = await buildReceiptPdf({
    reference: order.reference,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    customerName: order.customerName,
    fulfillment: order.fulfillment,
    slot: order.slot,
    items: order.items,
    totalFcfa: order.totalFcfa,
    paymentLabel: paid ? providerLabel(paid.provider) : null,
    paymentReference: paid?.providerReference ?? null,
  });
  return receiptResponse(bytes, order.reference);
}
