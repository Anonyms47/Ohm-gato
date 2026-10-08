import "server-only";
import { serverEnv } from "@/lib/env";
import { rateLimit } from "@/lib/http";
import { orderErrorMessage } from "@/lib/orders/errors";
import { generateTrackingToken } from "@/lib/orders/tracking";
import { getProvider } from "@/lib/payments";
import { PaymentUnavailableError, type ProviderId } from "@/lib/payments/types";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { placeOrderSchema } from "@/lib/validation/checkout";

export type PlaceOrderResult =
  | {
      ok: true;
      reference: string;
      trackingToken: string;
      status: "pending_payment" | "awaiting_validation";
      checkoutUrl: string | null;
    }
  | {
      ok: false;
      code: string;
      message: string;
      fieldErrors?: Record<string, string>;
      status: number;
    };

function parseDbError(error: { message: string; details?: string | null }) {
  let detail: Record<string, unknown> | undefined;
  try {
    detail = error.details ? (JSON.parse(error.details) as Record<string, unknown>) : undefined;
  } catch {
    detail = undefined;
  }
  return { code: error.message, detail };
}

export async function placeOrder(
  input: unknown,
  context: { ip: string; userId: string | null },
): Promise<PlaceOrderResult> {
  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) fieldErrors[path] = issue.message;
    }
    return { ok: false, code: "VALIDATION", message: "Certaines informations sont à corriger.", fieldErrors, status: 422 };
  }
  const data = parsed.data;

  const [ipAllowed, phoneAllowed] = await Promise.all([
    rateLimit(`order:ip:${context.ip}`, 12, 600),
    rateLimit(`order:phone:${data.contact.phone}`, 6, 600),
  ]);
  if (!ipAllowed || !phoneAllowed) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "Trop de tentatives en peu de temps. Patientez quelques minutes avant de réessayer.",
      status: 429,
    };
  }

  const db = supabaseAdmin();

  // Hors zone (quartier absent ou zone sur devis) : aucune demande de paiement avant validation.
  let requiresValidation = false;
  if (data.fulfillment === "delivery" && data.delivery) {
    if (data.delivery.zoneId === null) requiresValidation = true;
    else {
      const { data: zone, error: zoneError } = await db
        .from("delivery_zones")
        .select("fee_fcfa")
        .eq("id", data.delivery.zoneId)
        .eq("is_active", true)
        .maybeSingle();
      if (zoneError) throw zoneError;
      requiresValidation = zone !== null && zone.fee_fcfa === null;
    }
  }

  if (!requiresValidation) {
    const provider = data.paymentProvider ? getProvider(data.paymentProvider) : null;
    if (!provider) {
      return { ok: false, code: "PAYMENT_REQUIRED", message: "Choisissez un moyen de paiement.", status: 422 };
    }
    if (!provider.isConfigured()) {
      return {
        ok: false,
        code: "PAYMENT_UNAVAILABLE",
        message: `Paiement ${provider.label} temporairement indisponible. Choisissez un autre moyen ou contactez-nous sur WhatsApp.`,
        status: 503,
      };
    }
  }

  const { token, hash } = generateTrackingToken(data.idempotencyKey);
  const delivery = data.fulfillment === "delivery" ? data.delivery : null;

  const { data: placed, error } = await db.rpc("place_order", {
    p: {
      idempotency_key: data.idempotencyKey,
      cycle_id: data.cycleId,
      fulfillment: data.fulfillment,
      slot_id: data.slotId,
      tracking_token_hash: hash,
      user_id: context.userId,
      notes: data.notes ?? null,
      customer: { name: data.contact.name, phone: data.contact.phone, email: data.contact.email ?? null },
      delivery: delivery && {
        zone_id: delivery.zoneId,
        address_line: delivery.addressLine,
        district: delivery.district,
        landmark: delivery.landmark ?? null,
        floor_door: delivery.floorDoor ?? null,
        recipient_name: delivery.recipientName,
        recipient_phone: delivery.recipientPhone,
        instructions: delivery.instructions ?? null,
        latitude: delivery.latitude,
        longitude: delivery.longitude,
      },
      items: data.lines.map((l) => ({ variant_id: l.variantId, flavor_id: l.flavorId, quantity: l.quantity })),
    },
  });

  if (error) {
    const { code, detail } = parseDbError(error);
    // Erreurs métier levées par place_order (codes en majuscules) ; le reste est inattendu.
    if (/^[A-Z_]+$/.test(code)) {
      return { ok: false, code, message: orderErrorMessage(code, detail), status: 409 };
    }
    throw error;
  }

  const result = placed as { order_id: string; reference: string; status: string; replayed: boolean };

  if (result.status === "awaiting_validation") {
    return { ok: true, reference: result.reference, trackingToken: token, status: "awaiting_validation", checkoutUrl: null };
  }
  if (result.status !== "pending_payment") {
    return { ok: false, code: "ORDER_NOT_PAYABLE", message: orderErrorMessage("ORDER_NOT_PAYABLE"), status: 409 };
  }

  if (!data.paymentProvider) {
    return { ok: false, code: "PAYMENT_REQUIRED", message: "Choisissez un moyen de paiement.", status: 422 };
  }
  try {
    const checkoutUrl = await startPayment(result.order_id, data.paymentProvider, token);
    return { ok: true, reference: result.reference, trackingToken: token, status: "pending_payment", checkoutUrl };
  } catch (cause) {
    // La commande provisoire existe : le client pourra relancer le paiement depuis son suivi.
    console.error("Création de la session de paiement impossible", {
      reference: result.reference,
      provider: data.paymentProvider,
      reason: cause instanceof Error ? cause.message : "inconnue",
    });
    return { ok: true, reference: result.reference, trackingToken: token, status: "pending_payment", checkoutUrl: null };
  }
}

/**
 * Crée (ou reprend) le paiement d'une commande provisoire et renvoie l'URL du fournisseur.
 * Le montant vient de la commande en base, jamais du navigateur.
 */
export async function startPayment(orderId: string, providerId: ProviderId, trackingToken: string): Promise<string> {
  const provider = getProvider(providerId);
  if (!provider.isConfigured()) throw new PaymentUnavailableError(providerId);

  const db = supabaseAdmin();
  const { data: payment, error } = await db.rpc("create_payment", { p_order_id: orderId, p_provider: providerId });
  if (error) throw error;
  const row = payment as { id: string; amount_fcfa: number; checkout_url: string | null };
  if (row.checkout_url) return row.checkout_url;

  const { data: order, error: orderError } = await db.from("orders").select("reference").eq("id", orderId).single();
  if (orderError) throw orderError;

  const returnUrl = new URL(`/suivi/${trackingToken}`, serverEnv().NEXT_PUBLIC_SITE_URL);
  returnUrl.searchParams.set("retour", "paiement");
  const session = await provider.createCheckout({
    paymentId: row.id,
    orderReference: order.reference as string,
    amountFcfa: row.amount_fcfa,
    successUrl: returnUrl.toString(),
    errorUrl: returnUrl.toString(),
  });

  const { error: attachError } = await db.rpc("attach_payment_session", {
    p_payment_id: row.id,
    p_session_id: session.sessionId,
    p_checkout_url: session.checkoutUrl,
  });
  if (attachError) throw attachError;
  return session.checkoutUrl;
}
