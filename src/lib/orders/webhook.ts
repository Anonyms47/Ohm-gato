import "server-only";
import { getProvider } from "@/lib/payments";
import type { ProviderId } from "@/lib/payments/types";
import { supabaseAdmin } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Traite un webhook de paiement. La base garantit l'idempotence
 * (unicité fournisseur + identifiant d'événement) et l'atomicité du stock.
 */
export async function handlePaymentWebhook(
  providerId: ProviderId,
  rawBody: string,
  headers: Headers,
): Promise<{ httpStatus: number; outcome: string }> {
  const provider = getProvider(providerId);
  const verification = await provider.verifyWebhook(rawBody, headers);

  if (!verification.ok) {
    if (verification.reason === "bad_signature" && verification.eventId) {
      // Journalisé pour enquête, sans effet sur la commande.
      await supabaseAdmin().rpc("apply_payment_event", {
        p_provider: providerId,
        p_event_id: `rejected:${verification.eventId}`,
        p_event_type: "rejected",
        p_payment_id: verification.paymentId && UUID.test(verification.paymentId) ? verification.paymentId : null,
        p_status: "pending",
        p_amount_fcfa: null,
        p_provider_reference: null,
        p_signature_valid: false,
        p_payload: {},
      });
    }
    return { httpStatus: verification.reason === "bad_signature" ? 401 : 400, outcome: verification.reason };
  }

  const event = verification.event;
  if (!UUID.test(event.paymentId)) return { httpStatus: 400, outcome: "malformed" };

  const { data, error } = await supabaseAdmin().rpc("apply_payment_event", {
    p_provider: providerId,
    p_event_id: event.eventId,
    p_event_type: event.eventType,
    p_payment_id: event.paymentId,
    p_status: event.status,
    p_amount_fcfa: event.amountFcfa,
    p_provider_reference: event.providerReference,
    p_signature_valid: true,
    p_payload: event.payload,
  });
  if (error) throw error;
  return { httpStatus: 200, outcome: String(data) };
}
