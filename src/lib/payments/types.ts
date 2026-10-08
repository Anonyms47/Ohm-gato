import type { PaymentStatus } from "@/lib/order-status";

export type ProviderId = "test" | "wave" | "wave_link" | "orange_money";

export interface CheckoutRequest {
  paymentId: string;
  orderReference: string;
  amountFcfa: number;
  successUrl: string;
  errorUrl: string;
}

export interface CheckoutSession {
  sessionId: string;
  checkoutUrl: string;
}

/** Événement vérifié (signature contrôlée) et normalisé. */
export interface VerifiedPaymentEvent {
  eventId: string;
  eventType: string;
  /** Notre identifiant de paiement, transmis au fournisseur comme référence client. */
  paymentId: string;
  status: PaymentStatus | "pending";
  amountFcfa: number | null;
  providerReference: string | null;
  payload: unknown;
}

export type WebhookVerification =
  | { ok: true; event: VerifiedPaymentEvent }
  | { ok: false; reason: "bad_signature" | "malformed"; eventId?: string; paymentId?: string };

export interface PaymentProviderAdapter {
  id: ProviderId;
  label: string;
  /** Faux si un identifiant marchand manque : le paiement est alors bloqué proprement. */
  isConfigured(): boolean;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookVerification>;
}

export class PaymentUnavailableError extends Error {
  constructor(public readonly provider: ProviderId) {
    super(`Paiement temporairement indisponible (${provider}).`);
  }
}
