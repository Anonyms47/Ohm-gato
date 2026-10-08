import "server-only";
import { serverEnv } from "@/lib/env";
import { verifyTimestampedSignature } from "@/lib/payments/signature";
import { PaymentUnavailableError, type PaymentProviderAdapter } from "@/lib/payments/types";

/**
 * Wave Checkout (https://docs.wave.com/checkout).
 *
 * ⚠️ Implémenté d'après la documentation publique, sans identifiants marchands :
 * non vérifié contre l'API réelle. Tant que WAVE_API_KEY et WAVE_WEBHOOK_SECRET
 * sont absents, isConfigured() renvoie false et le paiement Wave est bloqué.
 */
const WAVE_API = "https://api.wave.com/v1";

interface WaveCheckoutData {
  id?: string;
  amount?: string;
  client_reference?: string | null;
  payment_status?: string;
  checkout_status?: string;
  transaction_id?: string | null;
}

export const waveProvider: PaymentProviderAdapter = {
  id: "wave",
  label: "Wave",

  isConfigured() {
    const env = serverEnv();
    return Boolean(env.WAVE_API_KEY && env.WAVE_WEBHOOK_SECRET);
  },

  async createCheckout(request) {
    const env = serverEnv();
    if (!env.WAVE_API_KEY) throw new PaymentUnavailableError("wave");
    const response = await fetch(`${WAVE_API}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WAVE_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": request.paymentId,
      },
      body: JSON.stringify({
        amount: String(request.amountFcfa),
        currency: "XOF",
        client_reference: request.paymentId,
        success_url: request.successUrl,
        error_url: request.errorUrl,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      // Pas de corps dans les journaux : il peut contenir des données personnelles.
      throw new Error(`Wave a refusé la création de session (HTTP ${response.status}).`);
    }
    const session = (await response.json()) as { id?: string; wave_launch_url?: string };
    if (!session.id || !session.wave_launch_url) throw new Error("Réponse Wave inattendue.");
    return { sessionId: session.id, checkoutUrl: session.wave_launch_url };
  },

  async verifyWebhook(rawBody, headers) {
    let body: { id?: string; type?: string; data?: WaveCheckoutData };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return { ok: false, reason: "malformed" };
    }
    const paymentId = body.data?.client_reference ?? undefined;
    if (!body.id || !body.type || !paymentId) return { ok: false, reason: "malformed" };

    const secret = serverEnv().WAVE_WEBHOOK_SECRET;
    if (!secret || !verifyTimestampedSignature(headers.get("wave-signature"), rawBody, secret)) {
      return { ok: false, reason: "bad_signature", eventId: body.id, paymentId };
    }

    const status =
      body.type === "checkout.session.completed" && body.data?.payment_status === "succeeded"
        ? "paid"
        : body.type === "checkout.session.payment_failed"
          ? "failed"
          : body.data?.checkout_status === "expired"
            ? "expired"
            : "pending";
    const amount = body.data?.amount !== undefined ? Number.parseInt(body.data.amount, 10) : NaN;

    return {
      ok: true,
      event: {
        eventId: body.id,
        eventType: body.type,
        paymentId,
        status,
        amountFcfa: Number.isSafeInteger(amount) ? amount : null,
        providerReference: body.data?.transaction_id ?? body.data?.id ?? null,
        payload: body,
      },
    };
  },
};
