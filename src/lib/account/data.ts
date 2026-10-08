import "server-only";
import type { Fulfillment, OrderStatus, PaymentStatus } from "@/lib/order-status";
import { generateTrackingToken } from "@/lib/orders/tracking";
import type { ProviderId } from "@/lib/payments/types";
import { storageAdvice, type StorageRule } from "@/lib/storage";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Lectures de l'espace membre : toujours avec la session de l'utilisateur,
 * donc filtrées par la RLS (chacun ne voit que ses propres données).
 */

export interface MemberOrder {
  id: string;
  reference: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillment: Fulfillment;
  totalFcfa: number;
  createdAt: string;
  paidAt: string | null;
  cycleNumber: number | null;
  isCustom: boolean;
  slot: { startsAt: string; endsAt: string } | null;
  items: {
    productId: string | null;
    variantId: string | null;
    flavorId: string | null;
    productName: string;
    variantLabel: string;
    flavorName: string | null;
    quantity: number;
    unitPriceFcfa: number;
    lineTotalFcfa: number;
    storage: string | null;
  }[];
  payments: { provider: ProviderId; status: PaymentStatus; amountFcfa: number; createdAt: string; paidAt: string | null }[];
  history: { status: OrderStatus; note: string | null; createdAt: string }[];
  address: { line: string | null; district: string | null; landmark: string | null; latitude: number | null; longitude: number | null };
  pickupCode: string | null;
  /** Lien de suivi (et de reprise du paiement), recalculé côté serveur. */
  trackingPath: string;
}

interface OrderRow {
  id: string;
  reference: string;
  idempotency_key: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  fulfillment: Fulfillment;
  total_fcfa: number;
  created_at: string;
  paid_at: string | null;
  custom_request_id: string | null;
  address_line: string | null;
  district: string | null;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  pickup_code: string | null;
  production_cycles: { number: number } | null;
  delivery_slots: { starts_at: string; ends_at: string } | null;
  order_items: {
    product_id: string | null;
    variant_id: string | null;
    flavor_id: string | null;
    product_name: string;
    variant_label: string;
    flavor_name: string | null;
    quantity: number;
    unit_price_fcfa: number;
    line_total_fcfa: number;
    products: { storage_rule: StorageRule | null; storage_note: string | null; storage_confirmed: boolean } | null;
  }[];
  payments: { provider: ProviderId; status: PaymentStatus; amount_fcfa: number; created_at: string; paid_at: string | null }[];
  order_status_history: { status: OrderStatus; note: string | null; created_at: string }[];
}

const ORDER_SELECT = `id, reference, idempotency_key, status, payment_status, fulfillment, total_fcfa, created_at, paid_at,
  custom_request_id, address_line, district, landmark, latitude, longitude, pickup_code,
  production_cycles(number), delivery_slots(starts_at, ends_at),
  order_items(product_id, variant_id, flavor_id, product_name, variant_label, flavor_name, quantity, unit_price_fcfa, line_total_fcfa,
    products(storage_rule, storage_note, storage_confirmed)),
  payments(provider, status, amount_fcfa, created_at, paid_at),
  order_status_history(status, note, created_at)`;

function toOrder(row: OrderRow): MemberOrder {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    paymentStatus: row.payment_status,
    fulfillment: row.fulfillment,
    totalFcfa: row.total_fcfa,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    cycleNumber: row.production_cycles?.number ?? null,
    isCustom: row.custom_request_id !== null,
    slot: row.delivery_slots ? { startsAt: row.delivery_slots.starts_at, endsAt: row.delivery_slots.ends_at } : null,
    items: row.order_items.map((i) => ({
      productId: i.product_id,
      variantId: i.variant_id,
      flavorId: i.flavor_id,
      productName: i.product_name,
      variantLabel: i.variant_label,
      flavorName: i.flavor_name,
      quantity: i.quantity,
      unitPriceFcfa: i.unit_price_fcfa,
      lineTotalFcfa: i.line_total_fcfa,
      storage:
        i.products?.storage_confirmed && i.products.storage_rule ? storageAdvice(i.products.storage_rule, i.products.storage_note) : null,
    })),
    payments: [...row.payments]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((p) => ({ provider: p.provider, status: p.status, amountFcfa: p.amount_fcfa, createdAt: p.created_at, paidAt: p.paid_at })),
    history: [...row.order_status_history]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((h) => ({ status: h.status, note: h.note, createdAt: h.created_at })),
    address: {
      line: row.address_line,
      district: row.district,
      landmark: row.landmark,
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
    },
    pickupCode: row.payment_status === "paid" ? row.pickup_code : null,
    trackingPath: `/suivi/${generateTrackingToken(row.idempotency_key).token}`,
  };
}

export async function getMyOrders(userId: string): Promise<MemberOrder[]> {
  const db = await supabaseServer();
  const { data, error } = await db
    .from("orders")
    .select(ORDER_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<OrderRow[]>();
  if (error) throw error;
  return (data ?? []).map(toOrder);
}

export async function getMyOrder(userId: string, reference: string): Promise<MemberOrder | null> {
  const db = await supabaseServer();
  const { data, error } = await db
    .from("orders")
    .select(ORDER_SELECT)
    .eq("user_id", userId)
    .eq("reference", reference)
    .maybeSingle<OrderRow>();
  if (error) throw error;
  return data ? toOrder(data) : null;
}

const ACTIVE: OrderStatus[] = ["pending_payment", "confirmed", "preparing", "finishing", "ready", "out_for_delivery", "needs_attention"];
export function isActiveOrder(order: Pick<MemberOrder, "status">): boolean {
  return ACTIVE.includes(order.status);
}

export interface MemberAddress {
  id: string;
  label: string | null;
  recipientName: string;
  recipientPhone: string;
  addressLine: string;
  district: string | null;
  landmark: string | null;
  floorDoor: string | null;
  instructions: string | null;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
}

export async function getMyAddresses(userId: string): Promise<MemberAddress[]> {
  const db = await supabaseServer();
  const { data, error } = await db
    .from("addresses")
    .select("id, label, recipient_name, recipient_phone, address_line, district, landmark, floor_door, instructions, latitude, longitude, is_default")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((a) => ({
    id: a.id as string,
    label: a.label as string | null,
    recipientName: a.recipient_name as string,
    recipientPhone: a.recipient_phone as string,
    addressLine: a.address_line as string,
    district: a.district as string | null,
    landmark: a.landmark as string | null,
    floorDoor: a.floor_door as string | null,
    instructions: a.instructions as string | null,
    latitude: a.latitude === null ? null : Number(a.latitude),
    longitude: a.longitude === null ? null : Number(a.longitude),
    isDefault: a.is_default as boolean,
  }));
}

export interface MemberProfile {
  fullName: string | null;
  phone: string | null;
  email: string | null;
  marketingConsent: boolean;
  orderUpdatesConsent: boolean;
  consentsUpdatedAt: string | null;
  createdAt: string;
  preferences: { newCycle: boolean; orderUpdates: boolean; channel: "whatsapp" | "sms" | "email" };
}

export async function getMyProfile(userId: string): Promise<MemberProfile> {
  const db = await supabaseServer();
  const [{ data: profile, error }, { data: prefs }] = await Promise.all([
    db
      .from("profiles")
      .select("full_name, phone, email, marketing_consent, order_updates_consent, consents_updated_at, created_at")
      .eq("id", userId)
      .single(),
    db.from("notification_preferences").select("new_cycle, order_updates, channel").eq("user_id", userId).maybeSingle(),
  ]);
  if (error) throw error;
  return {
    fullName: profile.full_name as string | null,
    phone: profile.phone ? `+${String(profile.phone).replace(/^\+/, "")}` : null,
    email: profile.email as string | null,
    marketingConsent: profile.marketing_consent as boolean,
    orderUpdatesConsent: profile.order_updates_consent as boolean,
    consentsUpdatedAt: profile.consents_updated_at as string | null,
    createdAt: profile.created_at as string,
    preferences: {
      newCycle: (prefs?.new_cycle as boolean | undefined) ?? false,
      orderUpdates: (prefs?.order_updates as boolean | undefined) ?? true,
      channel: (prefs?.channel as "whatsapp" | "sms" | "email" | undefined) ?? "whatsapp",
    },
  };
}

export async function getMyFavorites(userId: string): Promise<string[]> {
  const db = await supabaseServer();
  const { data, error } = await db.from("favorites").select("product_id").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((f) => f.product_id as string);
}

export interface MemberSession {
  id: string;
  createdAt: string;
  updatedAt: string | null;
  userAgent: string | null;
  ip: string | null;
  current: boolean;
}

export async function getMySessions(): Promise<MemberSession[]> {
  const db = await supabaseServer();
  const [{ data, error }, { data: claims }] = await Promise.all([db.rpc("my_sessions"), db.auth.getClaims()]);
  if (error) throw error;
  const currentId = (claims?.claims as { session_id?: string } | undefined)?.session_id;
  return ((data ?? []) as { id: string; created_at: string; updated_at: string | null; user_agent: string | null; ip: string | null }[]).map(
    (s) => ({ id: s.id, createdAt: s.created_at, updatedAt: s.updated_at, userAgent: s.user_agent, ip: s.ip, current: s.id === currentId }),
  );
}
