import "server-only";
import type { Fulfillment, OrderStatus, PaymentStatus } from "@/lib/order-status";
import { hashTrackingToken, isWellFormedToken } from "@/lib/orders/tracking";
import type { ProviderId } from "@/lib/payments/types";
import { storageAdvice, type StorageRule } from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface OrderView {
  id: string;
  reference: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillment: Fulfillment;
  customerName: string;
  customerPhone: string;
  addressLine: string | null;
  district: string | null;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  pickupCode: string | null;
  subtotalFcfa: number;
  deliveryFeeFcfa: number | null;
  totalFcfa: number;
  reservationExpiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
  cycleNumber: number;
  slot: { startsAt: string; endsAt: string };
  items: {
    productName: string;
    variantLabel: string;
    flavorName: string | null;
    quantity: number;
    unitPriceFcfa: number;
    lineTotalFcfa: number;
  }[];
  history: { status: OrderStatus; createdAt: string }[];
  lastPaymentProvider: ProviderId | null;
  /** Conseils de conservation des produits commandés (règles confirmées uniquement). */
  storage: { productName: string; advice: string }[];
}

interface OrderRow {
  id: string;
  reference: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  fulfillment: Fulfillment;
  customer_name: string;
  customer_phone: string;
  address_line: string | null;
  district: string | null;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  pickup_code: string | null;
  subtotal_fcfa: number;
  delivery_fee_fcfa: number | null;
  total_fcfa: number;
  reservation_expires_at: string | null;
  paid_at: string | null;
  created_at: string;
  production_cycles: { number: number };
  delivery_slots: { starts_at: string; ends_at: string };
  order_items: {
    product_name: string;
    variant_label: string;
    flavor_name: string | null;
    quantity: number;
    unit_price_fcfa: number;
    line_total_fcfa: number;
    products: { name: string; storage_rule: StorageRule | null; storage_note: string | null; storage_confirmed: boolean } | null;
  }[];
  order_status_history: { status: OrderStatus; created_at: string }[];
  payments: { provider: ProviderId; created_at: string }[];
}

/**
 * Lecture par lien personnel. Le jeton est vérifié par son hachage ; l'accès
 * passe par le serveur (service_role) car un invité n'a pas de session.
 */
export async function getOrderByToken(token: string): Promise<OrderView | null> {
  if (!isWellFormedToken(token)) return null;
  const db = supabaseAdmin();
  // Les commandes provisoires échues sont libérées avant affichage.
  await db.rpc("expire_stale_orders");

  const { data, error } = await db
    .from("orders")
    .select(
      `id, reference, status, payment_status, fulfillment, customer_name, customer_phone,
       address_line, district, landmark, latitude, longitude, pickup_code,
       subtotal_fcfa, delivery_fee_fcfa, total_fcfa, reservation_expires_at, paid_at, created_at,
       production_cycles(number), delivery_slots(starts_at, ends_at),
       order_items(product_name, variant_label, flavor_name, quantity, unit_price_fcfa, line_total_fcfa,
         products(name, storage_rule, storage_note, storage_confirmed)),
       order_status_history(status, created_at),
       payments(provider, created_at)`,
    )
    .eq("tracking_token_hash", hashTrackingToken(token))
    .maybeSingle<OrderRow>();
  if (error) throw error;
  if (!data) return null;

  const lastPayment = [...data.payments].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return {
    id: data.id,
    reference: data.reference,
    status: data.status,
    paymentStatus: data.payment_status,
    fulfillment: data.fulfillment,
    customerName: data.customer_name,
    customerPhone: data.customer_phone,
    addressLine: data.address_line,
    district: data.district,
    landmark: data.landmark,
    latitude: data.latitude === null ? null : Number(data.latitude),
    longitude: data.longitude === null ? null : Number(data.longitude),
    // Le code de retrait n'est révélé qu'une fois la commande payée.
    pickupCode: data.payment_status === "paid" ? data.pickup_code : null,
    subtotalFcfa: data.subtotal_fcfa,
    deliveryFeeFcfa: data.delivery_fee_fcfa,
    totalFcfa: data.total_fcfa,
    reservationExpiresAt: data.reservation_expires_at,
    paidAt: data.paid_at,
    createdAt: data.created_at,
    cycleNumber: data.production_cycles.number,
    slot: { startsAt: data.delivery_slots.starts_at, endsAt: data.delivery_slots.ends_at },
    items: data.order_items.map((i) => ({
      productName: i.product_name,
      variantLabel: i.variant_label,
      flavorName: i.flavor_name,
      quantity: i.quantity,
      unitPriceFcfa: i.unit_price_fcfa,
      lineTotalFcfa: i.line_total_fcfa,
    })),
    history: [...data.order_status_history]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((h) => ({ status: h.status, createdAt: h.created_at })),
    lastPaymentProvider: lastPayment?.provider ?? null,
    storage: Array.from(
      new Map(
        data.order_items.flatMap((i) =>
          i.products?.storage_confirmed && i.products.storage_rule
            ? [[i.products.name, storageAdvice(i.products.storage_rule, i.products.storage_note)] as const]
            : [],
        ),
      ),
      ([productName, advice]) => ({ productName, advice }),
    ),
  };
}

/** Version minimale pour l'interrogation périodique du statut. */
export async function getOrderStatusByToken(token: string) {
  const order = await getOrderByToken(token);
  return order && { status: order.status, paymentStatus: order.paymentStatus, pickupCode: order.pickupCode };
}
