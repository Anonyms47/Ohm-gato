import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, isSameOriginJson, jsonError, rateLimit } from "@/lib/http";
import { getOrderByToken } from "@/lib/orders/get-order";
import { startPayment } from "@/lib/orders/place-order";
import { isAwaitingPayment } from "@/lib/order-status";
import { PaymentUnavailableError } from "@/lib/payments/types";
import { paymentProviderSchema } from "@/lib/validation/checkout";

const schema = z.object({ token: z.string(), provider: paymentProviderSchema });

/** Reprise du paiement d'une commande provisoire (fenêtre fermée, retour arrière…). */
export async function POST(request: Request) {
  if (!isSameOriginJson(request)) return jsonError(403, "FORBIDDEN", "Requête refusée.");
  if (!(await rateLimit(`payment:${clientIp(request)}`, 10, 600))) {
    return jsonError(429, "RATE_LIMITED", "Trop de tentatives. Patientez quelques minutes.");
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "BAD_REQUEST", "Requête illisible.");

  const order = await getOrderByToken(parsed.data.token);
  if (!order) return jsonError(404, "NOT_FOUND", "Commande introuvable.");
  if (!isAwaitingPayment(order.status, order.paymentStatus)) {
    return jsonError(409, "ORDER_NOT_PAYABLE", "Cette commande ne peut plus être payée.");
  }
  try {
    const checkoutUrl = await startPayment(order.id, parsed.data.provider, parsed.data.token);
    return NextResponse.json({ ok: true, checkoutUrl });
  } catch (error) {
    if (error instanceof PaymentUnavailableError) {
      return jsonError(503, "PAYMENT_UNAVAILABLE", "Paiement temporairement indisponible.");
    }
    if (error && typeof error === "object" && "message" in error && error.message === "ORDER_NOT_PAYABLE") {
      return jsonError(409, "ORDER_NOT_PAYABLE", "Cette commande ne peut plus être payée.");
    }
    throw error;
  }
}
