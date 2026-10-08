import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderStatus, PaymentStatus } from "@/lib/order-status";
import { signAttachmentUrls } from "@/lib/custom/files";
import type { CustomStatus } from "@/lib/custom/status";
import { generateTrackingToken, hashTrackingToken, isWellFormedToken } from "@/lib/orders/tracking";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export interface CustomAttachment {
  id: string;
  name: string;
  mime: string;
  url: string | null;
  fromStaff: boolean;
  messageId: string | null;
  createdAt: string;
}

export interface CustomProposal {
  id: string;
  version: number;
  body: string;
  lines: { label: string; detail?: string; quantity: number; unit_price_fcfa: number }[];
  totalFcfa: number;
  validUntil: string | null;
  status: "sent" | "accepted" | "declined" | "superseded" | "withdrawn";
  createdAt: string;
}

export interface CustomRequestView {
  id: string;
  reference: string;
  status: CustomStatus;
  occasion: string;
  eventAt: string;
  guests: number | null;
  ambiance: string | null;
  personalization: string | null;
  budgetFcfa: number | null;
  notes: string | null;
  fulfillment: "delivery" | "pickup" | null;
  addressLine: string | null;
  district: string | null;
  landmark: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  latitude: number | null;
  longitude: number | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  internalNote: string | null;
  createdAt: string;
  items: { id: string; kind: string; description: string; format: string | null; flavors: string | null; quantity: number | null }[];
  messages: { id: string; body: string; fromStaff: boolean; createdAt: string }[];
  attachments: CustomAttachment[];
  proposals: CustomProposal[];
  events: { status: CustomStatus; note: string | null; createdAt: string }[];
  order: { reference: string; status: OrderStatus; paymentStatus: PaymentStatus; trackingPath: string } | null;
  userId: string | null;
}

const SELECT = `id, reference, status, occasion, event_at, guests, ambiance, personalization, budget_fcfa, notes, fulfillment,
  address_line, district, landmark, recipient_name, recipient_phone, latitude, longitude,
  customer_name, customer_phone, customer_email, created_at, user_id,
  custom_request_items(id, kind, description, format, flavors, quantity),
  custom_request_messages(id, body, from_staff, created_at),
  custom_request_attachments(id, original_name, mime_type, storage_path, from_staff, message_id, created_at),
  custom_proposals(id, version, body, lines, total_fcfa, valid_until, status, created_at),
  custom_request_events(status, note, created_at),
  orders!orders_custom_request_id_fkey(reference, status, payment_status, idempotency_key)`;

interface Row {
  id: string;
  reference: string;
  status: CustomStatus;
  occasion: string;
  event_at: string;
  guests: number | null;
  ambiance: string | null;
  personalization: string | null;
  budget_fcfa: number | null;
  notes: string | null;
  fulfillment: "delivery" | "pickup" | null;
  address_line: string | null;
  district: string | null;
  landmark: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  latitude: number | null;
  longitude: number | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  created_at: string;
  user_id: string | null;
  custom_request_items: { id: string; kind: string; description: string; format: string | null; flavors: string | null; quantity: number | null }[];
  custom_request_messages: { id: string; body: string; from_staff: boolean; created_at: string }[];
  custom_request_attachments: { id: string; original_name: string; mime_type: string; storage_path: string; from_staff: boolean; message_id: string | null; created_at: string }[];
  custom_proposals: { id: string; version: number; body: string; lines: CustomProposal["lines"]; total_fcfa: number; valid_until: string | null; status: CustomProposal["status"]; created_at: string }[];
  custom_request_events: { status: CustomStatus; note: string | null; created_at: string }[];
  orders: { reference: string; status: OrderStatus; payment_status: PaymentStatus; idempotency_key: string }[] | { reference: string; status: OrderStatus; payment_status: PaymentStatus; idempotency_key: string } | null;
}

async function toView(row: Row, internalNote: string | null): Promise<CustomRequestView> {
  const urls = await signAttachmentUrls(row.custom_request_attachments.map((a) => a.storage_path));
  const order = Array.isArray(row.orders) ? (row.orders[0] ?? null) : row.orders;
  const byDate = <T extends { created_at: string }>(list: T[]) => [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    occasion: row.occasion,
    eventAt: row.event_at,
    guests: row.guests,
    ambiance: row.ambiance,
    personalization: row.personalization,
    budgetFcfa: row.budget_fcfa,
    notes: row.notes,
    fulfillment: row.fulfillment,
    addressLine: row.address_line,
    district: row.district,
    landmark: row.landmark,
    recipientName: row.recipient_name,
    recipientPhone: row.recipient_phone,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    internalNote,
    createdAt: row.created_at,
    userId: row.user_id,
    items: row.custom_request_items,
    messages: byDate(row.custom_request_messages).map((m) => ({ id: m.id, body: m.body, fromStaff: m.from_staff, createdAt: m.created_at })),
    attachments: byDate(row.custom_request_attachments).map((a) => ({
      id: a.id,
      name: a.original_name,
      mime: a.mime_type,
      url: urls.get(a.storage_path) ?? null,
      fromStaff: a.from_staff,
      messageId: a.message_id,
      createdAt: a.created_at,
    })),
    proposals: [...row.custom_proposals]
      .sort((a, b) => b.version - a.version)
      .map((p) => ({
        id: p.id,
        version: p.version,
        body: p.body,
        lines: p.lines ?? [],
        totalFcfa: p.total_fcfa,
        validUntil: p.valid_until,
        status: p.status,
        createdAt: p.created_at,
      })),
    events: byDate(row.custom_request_events).map((e) => ({ status: e.status, note: e.note, createdAt: e.created_at })),
    order: order
      ? {
          reference: order.reference,
          status: order.status,
          paymentStatus: order.payment_status,
          trackingPath: `/suivi/${generateTrackingToken(order.idempotency_key).token}`,
        }
      : null,
  };
}

async function readOne(db: SupabaseClient, column: "id" | "reference" | "tracking_token_hash", value: string, includeInternal: boolean) {
  const { data, error } = await db.from("custom_requests").select(SELECT).eq(column, value).maybeSingle<Row>();
  if (error) throw error;
  if (!data) return null;
  let note: string | null = null;
  if (includeInternal) {
    const { data: internal } = await supabaseAdmin()
      .from("custom_request_internal_notes")
      .select("body")
      .eq("request_id", data.id)
      .maybeSingle<{ body: string }>();
    note = internal?.body ?? "";
  }
  return toView(data, note);
}

/** Lien personnel d'une demande invitée (jeton opaque, seul le hachage est stocké). */
export async function getCustomRequestByToken(token: string) {
  if (!isWellFormedToken(token)) return null;
  return readOne(supabaseAdmin(), "tracking_token_hash", hashTrackingToken(token), false);
}

/** Espace membre : lecture avec la session (RLS). */
export async function getMyCustomRequest(reference: string) {
  return readOne(await supabaseServer(), "reference", reference, false);
}

export async function getCustomRequestForAdmin(id: string) {
  return readOne(supabaseAdmin(), "id", id, true);
}

export interface CustomRequestSummary {
  id: string;
  reference: string;
  status: CustomStatus;
  occasion: string;
  eventAt: string;
  guests: number | null;
  customerName: string;
  customerPhone: string;
  createdAt: string;
  hasOpenProposal: boolean;
}

const SUMMARY_SELECT = "id, reference, status, occasion, event_at, guests, customer_name, customer_phone, created_at, custom_proposals(status)";

function toSummary(r: Record<string, unknown>): CustomRequestSummary {
  return {
    id: r.id as string,
    reference: r.reference as string,
    status: r.status as CustomStatus,
    occasion: r.occasion as string,
    eventAt: r.event_at as string,
    guests: r.guests as number | null,
    customerName: r.customer_name as string,
    customerPhone: r.customer_phone as string,
    createdAt: r.created_at as string,
    hasOpenProposal: ((r.custom_proposals as { status: string }[]) ?? []).some((p) => p.status === "sent"),
  };
}

export async function getMyCustomRequests(userId: string): Promise<CustomRequestSummary[]> {
  const db = await supabaseServer();
  const { data, error } = await db
    .from("custom_requests")
    .select(SUMMARY_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toSummary);
}

export async function listCustomRequestsForAdmin(filter: { status?: string; q?: string }): Promise<CustomRequestSummary[]> {
  let query = supabaseAdmin().from("custom_requests").select(SUMMARY_SELECT).order("event_at", { ascending: true }).limit(200);
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.q) {
    const q = filter.q.replace(/[%,()]/g, " ").trim();
    query = query.or(`reference.ilike.%${q}%,customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(toSummary);
}
