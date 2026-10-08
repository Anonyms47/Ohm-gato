import "server-only";
import { randomUUID } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { signTimestamped, verifyTimestampedSignature } from "@/lib/payments/signature";
import type { PaymentProviderAdapter, VerifiedPaymentEvent } from "@/lib/payments/types";

export const TEST_SIGNATURE_HEADER = "x-ohmegato-test-signature";

/**
 * Fournisseur fictif, actif uniquement hors production (PAYMENT_TEST_MODE=true).
 * Il suit exactement le même chemin qu'un vrai fournisseur : session, redirection,
 * webhook signé, idempotence.
 */
export const testProvider: PaymentProviderAdapter = {
  id: "test",
  label: "Paiement de test",

  isConfigured() {
    const env = serverEnv();
    return env.APP_ENV !== "production" && env.PAYMENT_TEST_MODE && Boolean(env.PAYMENT_TEST_WEBHOOK_SECRET);
  },

  async createCheckout(request) {
    const sessionId = `test_${randomUUID()}`;
    const url = new URL(`/paiement-test/${request.paymentId}`, serverEnv().NEXT_PUBLIC_SITE_URL);
    url.searchParams.set("session", sessionId);
    // Comme un vrai fournisseur, la page de test renvoie ensuite vers l'adresse de retour.
    url.searchParams.set("retour", request.successUrl);
    return { sessionId, checkoutUrl: url.toString() };
  },

  async verifyWebhook(rawBody, headers) {
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return { ok: false, reason: "malformed" };
    }
    const event = body as Partial<VerifiedPaymentEvent> & { id?: string; type?: string; payment_id?: string; status?: string; amount?: number };
    if (typeof event.id !== "string" || typeof event.payment_id !== "string" || typeof event.type !== "string") {
      return { ok: false, reason: "malformed" };
    }
    const secret = serverEnv().PAYMENT_TEST_WEBHOOK_SECRET;
    if (!secret || !verifyTimestampedSignature(headers.get(TEST_SIGNATURE_HEADER), rawBody, secret)) {
      return { ok: false, reason: "bad_signature", eventId: event.id, paymentId: event.payment_id };
    }
    const status = event.status;
    if (status !== "paid" && status !== "failed" && status !== "cancelled" && status !== "expired" && status !== "pending") {
      return { ok: false, reason: "malformed" };
    }
    return {
      ok: true,
      event: {
        eventId: event.id,
        eventType: event.type,
        paymentId: event.payment_id,
        status,
        amountFcfa: typeof event.amount === "number" ? event.amount : null,
        providerReference: `TEST-${event.id.slice(0, 8)}`,
        payload: body,
      },
    };
  },
};

/** Construit un webhook signé, comme le ferait un fournisseur (page de paiement de test). */
export function buildTestWebhook(input: {
  paymentId: string;
  status: "paid" | "failed" | "cancelled";
  amountFcfa: number;
}): { body: string; signature: string } {
  const secret = serverEnv().PAYMENT_TEST_WEBHOOK_SECRET;
  if (!secret) throw new Error("PAYMENT_TEST_WEBHOOK_SECRET manquant.");
  const body = JSON.stringify({
    id: `evt_${randomUUID()}`,
    type: `checkout.${input.status}`,
    payment_id: input.paymentId,
    status: input.status,
    amount: input.amountFcfa,
  });
  return { body, signature: signTimestamped(body, secret) };
}
