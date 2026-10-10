import "server-only";
import type { CycleSummary } from "@/lib/catalog-types";
import type { Fulfillment, OrderStatus, PaymentStatus } from "@/lib/order-status";
import type { ProviderId } from "@/lib/payments/types";
import type { AllergenDef, AllergenStatus, AllergenVerification, ConfirmationMethod, ConfirmationSource, Provenance, WorkshopTraces } from "@/lib/allergens";
import { orderKindFor } from "@/lib/cycle-status";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Lectures de l'administration (clé service, après contrôle du rôle par requireAdmin).
 * Aucune de ces fonctions n'est appelée hors des pages /admin.
 */
const db = () => supabaseAdmin();

/** Début du jour à Dakar (UTC+0). */
function startOfDakarDay(date = new Date()): string {
  return `${date.toISOString().slice(0, 10)}T00:00:00Z`;
}

export interface AdminCycle extends CycleSummary {
  capacityUnits: number | null;
  featuredProductId: string | null;
  /** Dates réelles des changements de phase (journal). */
  phaseDates: { closedAt: string | null; productionStartedAt: string | null; fulfillmentStartedAt: string | null; surplusOpenedAt: string | null; completedAt: string | null };
}

interface CycleRow {
  id: string;
  number: number;
  title: string;
  message: string | null;
  opens_at: string;
  closes_at: string;
  production_date: string;
  production_days: number | null;
  production_dates: string[] | null;
  fulfillment_date: string;
  status: string;
  surplus_ends_at: string | null;
  surplus_delivery_allowed: boolean;
  closed_at: string | null;
  production_started_at: string | null;
  fulfillment_started_at: string | null;
  surplus_opened_at: string | null;
  completed_at: string | null;
  palette: CycleSummary["palette"];
  capacity_units: number | null;
  featured_product_id: string | null;
  featured: { slug: string } | null;
}

function toCycle(r: CycleRow): AdminCycle {
  const orderKind = orderKindFor({ status: r.status, opensAt: r.opens_at, closesAt: r.closes_at, surplusEndsAt: r.surplus_ends_at });
  return {
    id: r.id,
    number: r.number,
    title: r.title,
    message: r.message,
    opensAt: r.opens_at,
    closesAt: r.closes_at,
    productionDate: r.production_date,
    productionDays: r.production_days,
    productionDates: r.production_dates ?? [],
    fulfillmentDate: r.fulfillment_date,
    status: r.status,
    surplusEndsAt: r.surplus_ends_at,
    surplusDeliveryAllowed: r.surplus_delivery_allowed,
    isOpen: orderKind !== null,
    orderKind,
    featuredProductSlug: r.featured?.slug ?? null,
    palette: r.palette,
    capacityUnits: r.capacity_units,
    featuredProductId: r.featured_product_id,
    phaseDates: {
      closedAt: r.closed_at,
      productionStartedAt: r.production_started_at,
      fulfillmentStartedAt: r.fulfillment_started_at,
      surplusOpenedAt: r.surplus_opened_at,
      completedAt: r.completed_at,
    },
  };
}

const CYCLE_SELECT =
  "id, number, title, message, opens_at, closes_at, production_date, production_days, production_dates, fulfillment_date, status, surplus_ends_at, surplus_delivery_allowed, closed_at, production_started_at, fulfillment_started_at, surplus_opened_at, completed_at, palette, capacity_units, featured_product_id, featured:products!production_cycles_featured_product_id_fkey(slug)";

export async function listCycles(): Promise<AdminCycle[]> {
  const { data, error } = await db().from("production_cycles").select(CYCLE_SELECT).order("number", { ascending: false }).returns<CycleRow[]>();
  if (error) throw error;
  return (data ?? []).map(toCycle);
}

export async function getCycle(id: string): Promise<AdminCycle | null> {
  const { data, error } = await db().from("production_cycles").select(CYCLE_SELECT).eq("id", id).maybeSingle<CycleRow>();
  if (error) throw error;
  return data ? toCycle(data) : null;
}

/** Fournée de travail : ouverte, sinon en cours de production, sinon la prochaine. */
export async function activeCycle(): Promise<AdminCycle | null> {
  const cycles = await listCycles();
  const order = ["open", "closed", "preparing", "delivering", "scheduled", "draft"];
  return [...cycles].filter((c) => order.includes(c.status)).sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || b.number - a.number)[0] ?? null;
}

export interface AdminAllergenStatus extends Provenance {
  id: string;
  flavorId: string | null;
  allergenId: string;
  status: AllergenStatus;
  note: string;
  verification: AllergenVerification;
  verifiedAt: string | null;
}

export interface AdminRecipeNote extends Provenance {
  id: string;
  flavorId: string | null;
  label: string;
  verification: AllergenVerification;
  verifiedAt: string | null;
}

export interface AdminProduct {
  id: string;
  slug: string;
  name: string;
  category: string;
  shortDescription: string;
  description: string;
  tips: string | null;
  unitLabel: string;
  unitLabelPlural: string;
  staging: string;
  accent: string;
  storageRule: string | null;
  storageNote: string | null;
  storageConfirmed: boolean;
  sortOrder: number;
  isActive: boolean;
  variants: { id: string; label: string; unitsConsumed: number; priceFcfa: number; sortOrder: number; isActive: boolean }[];
  flavorIds: string[];
  allergenStatuses: AdminAllergenStatus[];
  recipeNotes: AdminRecipeNote[];
  images: { id: string; path: string; alt: string; width: number; height: number; role: string; sortOrder: number }[];
}

type ProvenanceRow = { confirmation_source: ConfirmationSource | null; confirmed_by: string | null; confirmation_method: ConfirmationMethod | null };
const provenance = (r: ProvenanceRow): Provenance => ({
  confirmationSource: r.confirmation_source,
  confirmedBy: r.confirmed_by,
  confirmationMethod: r.confirmation_method,
});

export async function listProducts(): Promise<AdminProduct[]> {
  const { data, error } = await db()
    .from("products")
    .select(
      `id, slug, name, category, short_description, description, tips, unit_label, unit_label_plural, staging, accent,
       storage_rule, storage_note, storage_confirmed, sort_order, is_active,
       product_variants(id, label, units_consumed, price_fcfa, sort_order, is_active),
       product_flavors(flavor_id, sort_order),
       product_allergen_statuses(id, flavor_id, allergen_id, status, note, verification, verified_at, confirmation_source, confirmed_by, confirmation_method),
       product_recipe_notes(id, flavor_id, label, sort_order, verification, verified_at, confirmation_source, confirmed_by, confirmation_method),
       product_images(id, storage_path, alt, width, height, role, sort_order)`,
    )
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,
    shortDescription: p.short_description,
    description: p.description,
    tips: p.tips,
    unitLabel: p.unit_label,
    unitLabelPlural: p.unit_label_plural,
    staging: p.staging,
    accent: p.accent,
    storageRule: p.storage_rule,
    storageNote: p.storage_note,
    storageConfirmed: p.storage_confirmed,
    sortOrder: p.sort_order,
    isActive: p.is_active,
    variants: [...(p.product_variants as { id: string; label: string; units_consumed: number; price_fcfa: number; sort_order: number; is_active: boolean }[])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => ({ id: v.id, label: v.label, unitsConsumed: v.units_consumed, priceFcfa: v.price_fcfa, sortOrder: v.sort_order, isActive: v.is_active })),
    flavorIds: [...(p.product_flavors as { flavor_id: string; sort_order: number }[])].sort((a, b) => a.sort_order - b.sort_order).map((f) => f.flavor_id),
    allergenStatuses: (
      p.product_allergen_statuses as ({ id: string; flavor_id: string | null; allergen_id: string; status: AllergenStatus; note: string | null; verification: AllergenVerification; verified_at: string | null } & ProvenanceRow)[]
    ).map((a) => ({ id: a.id, flavorId: a.flavor_id, allergenId: a.allergen_id, status: a.status, note: a.note ?? "", verification: a.verification, verifiedAt: a.verified_at, ...provenance(a) })),
    recipeNotes: [
      ...(p.product_recipe_notes as ({ id: string; flavor_id: string | null; label: string; sort_order: number; verification: AllergenVerification; verified_at: string | null } & ProvenanceRow)[]),
    ]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((n) => ({ id: n.id, flavorId: n.flavor_id, label: n.label, verification: n.verification, verifiedAt: n.verified_at, ...provenance(n) })),
    images: [...(p.product_images as { id: string; storage_path: string; alt: string; width: number; height: number; role: string; sort_order: number }[])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({ id: i.id, path: i.storage_path, alt: i.alt, width: i.width, height: i.height, role: i.role, sortOrder: i.sort_order })),
  }));
}

export async function listFlavors() {
  const { data, error } = await db().from("flavors").select("id, slug, name").order("name");
  if (error) throw error;
  return data as { id: string; slug: string; name: string }[];
}

export interface AdminAllergen extends AllergenDef {
  name: string;
}

export async function listAllergens(): Promise<AdminAllergen[]> {
  const { data, error } = await db()
    .from("allergens")
    .select("id, slug, name, sentence_label, no_added_text, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return (data as { id: string; slug: string; name: string; sentence_label: string | null; no_added_text: string | null; sort_order: number }[]).map((a) => ({
    id: a.id,
    slug: a.slug,
    name: a.name,
    sentenceLabel: a.sentence_label ?? a.name.toLocaleLowerCase("fr"),
    noAddedText: a.no_added_text ?? "",
    sortOrder: a.sort_order,
  }));
}

export interface WorkshopTracesAdmin {
  traces: WorkshopTraces;
  review: { ingredients: boolean; packaging: boolean; utensils: boolean; confirmedAt: string | null };
}

export async function getWorkshopTraces(): Promise<WorkshopTracesAdmin> {
  const { data, error } = await db()
    .from("site_settings")
    .select("key, value")
    .in("key", ["allergens.workshop_traces", "allergens.workshop_traces_review"]);
  if (error) throw error;
  const byKey = Object.fromEntries((data as { key: string; value: Record<string, unknown> | null }[]).map((s) => [s.key, s.value ?? {}]));
  const t = byKey["allergens.workshop_traces"] ?? {};
  const r = byKey["allergens.workshop_traces_review"] ?? {};
  return {
    traces: {
      enabled: t.enabled === true,
      allergens: Array.isArray(t.allergens) ? (t.allergens as unknown[]).filter((a): a is string => typeof a === "string") : [],
    },
    review: {
      ingredients: r.ingredients === true,
      packaging: r.packaging === true,
      utensils: r.utensils === true,
      confirmedAt: typeof r.confirmed_at === "string" ? r.confirmed_at : null,
    },
  };
}

export interface CycleSetup {
  products: { productId: string; disabledVariantIds: string[]; availableFlavorIds: string[] | null; sortOrder: number }[];
  inventory: {
    productId: string;
    totalUnits: number;
    reservedUnits: number;
    soldUnits: number;
    extraUnits: number;
    producedUnits: number | null;
    lostUnits: number;
    surplusPublishedUnits: number;
    productionNote: string | null;
    productionRecordedAt: string | null;
  }[];
  slots: {
    id: string;
    kind: "delivery" | "pickup" | "both";
    phase: "preorder" | "surplus";
    startsAt: string;
    endsAt: string;
    capacityOrders: number | null;
    isActive: boolean;
    orders: number;
  }[];
}

export async function getCycleSetup(cycleId: string): Promise<CycleSetup> {
  const [cp, inv, slots, orders] = await Promise.all([
    db().from("cycle_products").select("product_id, disabled_variant_ids, available_flavor_ids, sort_order").eq("cycle_id", cycleId),
    db()
      .from("inventory_units")
      .select("product_id, total_units, reserved_units, sold_units, extra_units, produced_units, lost_units, surplus_published_units, production_note, production_recorded_at")
      .eq("cycle_id", cycleId),
    db().from("delivery_slots").select("id, kind, phase, starts_at, ends_at, capacity_orders, is_active").eq("cycle_id", cycleId).order("starts_at"),
    db().from("orders").select("slot_id").eq("cycle_id", cycleId).not("status", "in", "(cancelled,expired,refunded)"),
  ]);
  for (const r of [cp, inv, slots, orders]) if (r.error) throw r.error;
  const perSlot = new Map<string, number>();
  for (const o of (orders.data ?? []) as { slot_id: string }[]) perSlot.set(o.slot_id, (perSlot.get(o.slot_id) ?? 0) + 1);
  return {
    products: (cp.data ?? []).map((r) => ({
      productId: r.product_id as string,
      disabledVariantIds: r.disabled_variant_ids as string[],
      availableFlavorIds: r.available_flavor_ids as string[] | null,
      sortOrder: r.sort_order as number,
    })),
    inventory: (inv.data ?? []).map((r) => ({
      productId: r.product_id as string,
      totalUnits: r.total_units as number,
      reservedUnits: r.reserved_units as number,
      soldUnits: r.sold_units as number,
      extraUnits: r.extra_units as number,
      producedUnits: r.produced_units as number | null,
      lostUnits: r.lost_units as number,
      surplusPublishedUnits: r.surplus_published_units as number,
      productionNote: r.production_note as string | null,
      productionRecordedAt: r.production_recorded_at as string | null,
    })),
    slots: (slots.data ?? []).map((s) => ({
      id: s.id as string,
      kind: s.kind as "delivery" | "pickup" | "both",
      phase: s.phase as "preorder" | "surplus",
      startsAt: s.starts_at as string,
      endsAt: s.ends_at as string,
      capacityOrders: s.capacity_orders as number | null,
      isActive: s.is_active as boolean,
      orders: perSlot.get(s.id as string) ?? 0,
    })),
  };
}

/** Synthèse de la demande d'une fournée, par produit (unités réelles). */
export interface DemandRow {
  productId: string;
  name: string;
  unitLabelPlural: string;
  ordered: number;
  toVerify: number;
  paid: number;
  cancelled: number;
  toProduce: number;
  extra: number;
  produced: number | null;
  lost: number;
  reservedForOrders: number;
  handedOver: number;
  remaining: number | null;
  surplusPublished: number;
  surplusSold: number;
  available: number;
}

const OPEN_ORDER = ["pending_payment", "awaiting_validation", "confirmed", "preparing", "finishing", "ready", "out_for_delivery", "needs_attention"];
const HANDED = ["delivered", "picked_up"];
const CANCELLED = ["cancelled", "expired", "refunded"];

export async function getCycleDemand(cycleId: string, products: AdminProduct[]): Promise<DemandRow[]> {
  const [items, setup] = await Promise.all([
    db()
      .from("order_items")
      .select("product_id, units_per_item, quantity, orders!inner(cycle_id, status, payment_status, order_kind)")
      .eq("orders.cycle_id", cycleId),
    getCycleSetup(cycleId),
  ]);
  if (items.error) throw items.error;
  type Item = { product_id: string | null; units_per_item: number; quantity: number; orders: { status: string; payment_status: string; order_kind: string } };
  const rows = new Map<string, DemandRow>();
  for (const cp of setup.products) {
    const product = products.find((p) => p.id === cp.productId);
    const inv = setup.inventory.find((i) => i.productId === cp.productId);
    rows.set(cp.productId, {
      productId: cp.productId,
      name: product?.name ?? "Produit retiré",
      unitLabelPlural: product?.unitLabelPlural ?? "unités",
      ordered: 0,
      toVerify: 0,
      paid: 0,
      cancelled: 0,
      toProduce: 0,
      extra: inv?.extraUnits ?? 0,
      produced: inv?.producedUnits ?? null,
      lost: inv?.lostUnits ?? 0,
      reservedForOrders: 0,
      handedOver: 0,
      remaining: null,
      surplusPublished: inv?.surplusPublishedUnits ?? 0,
      surplusSold: 0,
      available: inv ? Math.max(0, inv.totalUnits - inv.reservedUnits - inv.soldUnits) : 0,
    });
  }
  for (const it of (items.data ?? []) as unknown as Item[]) {
    if (!it.product_id) continue;
    const row = rows.get(it.product_id);
    if (!row) continue;
    const units = it.units_per_item * it.quantity;
    const o = it.orders;
    if (o.order_kind === "surplus") {
      if (!CANCELLED.includes(o.status) && o.status !== "pending_payment") row.surplusSold += units;
      continue;
    }
    if (CANCELLED.includes(o.status)) {
      row.cancelled += units;
      continue;
    }
    row.ordered += units;
    // Commande provisoire (paiement pas encore choisi) : elle ne compte pas dans la production.
    if (o.status !== "pending_payment") row.toProduce += units;
    if (o.payment_status === "paid") row.paid += units;
    else row.toVerify += units;
    if (HANDED.includes(o.status)) row.handedOver += units;
    else if (OPEN_ORDER.includes(o.status)) row.reservedForOrders += units;
  }
  for (const row of rows.values()) {
    if (row.produced !== null) row.remaining = Math.max(0, row.produced - row.lost - row.reservedForOrders - row.handedOver - row.surplusSold);
  }
  return [...rows.values()];
}

export interface AdminOrderRow {
  id: string;
  reference: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillment: Fulfillment;
  customerName: string;
  customerPhone: string;
  totalFcfa: number;
  createdAt: string;
  cycleNumber: number | null;
  slotStartsAt: string | null;
  district: string | null;
  isCustom: boolean;
}

export interface OrderFilter {
  q?: string;
  status?: string;
  payment?: string;
  fulfillment?: string;
  cycle?: string;
  today?: boolean;
}

export async function listOrders(filter: OrderFilter): Promise<AdminOrderRow[]> {
  let query = db()
    .from("orders")
    .select(
      "id, reference, status, payment_status, fulfillment, customer_name, customer_phone, total_fcfa, created_at, district, custom_request_id, production_cycles(number), delivery_slots(starts_at)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.payment) query = query.eq("payment_status", filter.payment);
  if (filter.fulfillment) query = query.eq("fulfillment", filter.fulfillment);
  if (filter.cycle) query = query.eq("cycle_id", filter.cycle);
  if (filter.today) query = query.gte("created_at", startOfDakarDay());
  if (filter.q) {
    const q = filter.q.replace(/[%,()]/g, " ").trim();
    if (q) query = query.or(`reference.ilike.%${q}%,customer_name.ilike.%${q}%,customer_phone.ilike.%${q.replace(/\s/g, "")}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((o) => ({
    id: o.id as string,
    reference: o.reference as string,
    status: o.status as OrderStatus,
    paymentStatus: o.payment_status as PaymentStatus,
    fulfillment: o.fulfillment as Fulfillment,
    customerName: o.customer_name as string,
    customerPhone: o.customer_phone as string,
    totalFcfa: o.total_fcfa as number,
    createdAt: o.created_at as string,
    cycleNumber: (o.production_cycles as unknown as { number: number } | null)?.number ?? null,
    slotStartsAt: (o.delivery_slots as unknown as { starts_at: string } | null)?.starts_at ?? null,
    district: o.district as string | null,
    isCustom: o.custom_request_id !== null,
  }));
}

export interface AdminOrderDetail extends AdminOrderRow {
  idempotencyKey: string;
  customerEmail: string | null;
  addressLine: string | null;
  landmark: string | null;
  floorDoor: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  instructions: string | null;
  latitude: number | null;
  longitude: number | null;
  pickupCode: string | null;
  notes: string | null;
  paidAt: string | null;
  courierName: string | null;
  courierPhone: string | null;
  handedToCourierAt: string | null;
  deliveredAt: string | null;
  slot: { startsAt: string; endsAt: string } | null;
  customRequestId: string | null;
  items: { productName: string; variantLabel: string; flavorName: string | null; quantity: number; unitsPerItem: number; unitPriceFcfa: number; lineTotalFcfa: number }[];
  payments: { id: string; provider: ProviderId; status: PaymentStatus; amountFcfa: number; providerReference: string | null; createdAt: string; paidAt: string | null }[];
  history: { status: OrderStatus; note: string | null; actor: string | null; createdAt: string }[];
  audit: { action: string; details: unknown; actor: string | null; createdAt: string }[];
}

async function actorNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();
  const { data } = await db().from("profiles").select("id, full_name, phone, email").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id as string, (p.full_name as string | null) || (p.phone ? `+${p.phone}` : null) || (p.email as string | null) || "Équipe"]));
}

export async function getOrderDetail(id: string): Promise<AdminOrderDetail | null> {
  const { data: o, error } = await db()
    .from("orders")
    .select(
      `*, production_cycles(number), delivery_slots(starts_at, ends_at),
       order_items(product_name, variant_label, flavor_name, quantity, units_per_item, unit_price_fcfa, line_total_fcfa),
       payments(id, provider, status, amount_fcfa, provider_reference, created_at, paid_at),
       order_status_history(status, note, actor_id, created_at)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!o) return null;
  const { data: audit } = await db()
    .from("audit_logs")
    .select("action, details, actor_id, created_at")
    .eq("entity", "orders")
    .eq("entity_id", id)
    .order("created_at", { ascending: false });
  const history = o.order_status_history as { status: OrderStatus; note: string | null; actor_id: string | null; created_at: string }[];
  const names = await actorNames([...history.map((h) => h.actor_id), ...((audit ?? []) as { actor_id: string | null }[]).map((a) => a.actor_id)]);
  const slot = o.delivery_slots as { starts_at: string; ends_at: string } | null;
  return {
    id: o.id,
    reference: o.reference,
    idempotencyKey: o.idempotency_key,
    status: o.status,
    paymentStatus: o.payment_status,
    fulfillment: o.fulfillment,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    customerEmail: o.customer_email,
    totalFcfa: o.total_fcfa,
    createdAt: o.created_at,
    cycleNumber: (o.production_cycles as { number: number } | null)?.number ?? null,
    slotStartsAt: slot?.starts_at ?? null,
    slot: slot ? { startsAt: slot.starts_at, endsAt: slot.ends_at } : null,
    district: o.district,
    isCustom: o.custom_request_id !== null,
    customRequestId: o.custom_request_id,
    addressLine: o.address_line,
    landmark: o.landmark,
    floorDoor: o.floor_door,
    recipientName: o.recipient_name,
    recipientPhone: o.recipient_phone,
    instructions: o.delivery_instructions,
    latitude: o.latitude === null ? null : Number(o.latitude),
    longitude: o.longitude === null ? null : Number(o.longitude),
    pickupCode: o.pickup_code,
    notes: o.notes,
    paidAt: o.paid_at,
    courierName: o.courier_name,
    courierPhone: o.courier_phone,
    handedToCourierAt: o.handed_to_courier_at,
    deliveredAt: o.delivered_at,
    items: (o.order_items as { product_name: string; variant_label: string; flavor_name: string | null; quantity: number; units_per_item: number; unit_price_fcfa: number; line_total_fcfa: number }[]).map((i) => ({
      productName: i.product_name,
      variantLabel: i.variant_label,
      flavorName: i.flavor_name,
      quantity: i.quantity,
      unitsPerItem: i.units_per_item,
      unitPriceFcfa: i.unit_price_fcfa,
      lineTotalFcfa: i.line_total_fcfa,
    })),
    payments: (o.payments as { id: string; provider: ProviderId; status: PaymentStatus; amount_fcfa: number; provider_reference: string | null; created_at: string; paid_at: string | null }[])
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((p) => ({ id: p.id, provider: p.provider, status: p.status, amountFcfa: p.amount_fcfa, providerReference: p.provider_reference, createdAt: p.created_at, paidAt: p.paid_at })),
    history: [...history]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((h) => ({ status: h.status, note: h.note, actor: h.actor_id ? (names.get(h.actor_id) ?? "Équipe") : null, createdAt: h.created_at })),
    audit: ((audit ?? []) as { action: string; details: unknown; actor_id: string | null; created_at: string }[]).map((a) => ({
      action: a.action,
      details: a.details,
      actor: a.actor_id ? (names.get(a.actor_id) ?? "Équipe") : null,
      createdAt: a.created_at,
    })),
  };
}

export interface DeliveryStop {
  id: string;
  reference: string;
  status: OrderStatus;
  customerName: string;
  recipientName: string | null;
  recipientPhone: string | null;
  addressLine: string | null;
  district: string | null;
  landmark: string | null;
  floorDoor: string | null;
  instructions: string | null;
  latitude: number | null;
  longitude: number | null;
  slotStartsAt: string | null;
  slotEndsAt: string | null;
  courierName: string | null;
  courierPhone: string | null;
}

export async function listDeliveries(cycleId: string | null): Promise<DeliveryStop[]> {
  let query = db()
    .from("orders")
    .select(
      "id, reference, status, customer_name, recipient_name, recipient_phone, address_line, district, landmark, floor_door, delivery_instructions, latitude, longitude, courier_name, courier_phone, delivery_slots(starts_at, ends_at)",
    )
    .eq("fulfillment", "delivery")
    .in("status", ["confirmed", "preparing", "finishing", "ready", "out_for_delivery", "delivered"])
    .order("created_at");
  if (cycleId) query = query.or(`cycle_id.eq.${cycleId},custom_request_id.not.is.null`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((o) => {
    const slot = o.delivery_slots as unknown as { starts_at: string; ends_at: string } | null;
    return {
      id: o.id as string,
      reference: o.reference as string,
      status: o.status as OrderStatus,
      customerName: o.customer_name as string,
      recipientName: o.recipient_name as string | null,
      recipientPhone: o.recipient_phone as string | null,
      addressLine: o.address_line as string | null,
      district: o.district as string | null,
      landmark: o.landmark as string | null,
      floorDoor: o.floor_door as string | null,
      instructions: o.delivery_instructions as string | null,
      latitude: o.latitude === null ? null : Number(o.latitude),
      longitude: o.longitude === null ? null : Number(o.longitude),
      slotStartsAt: slot?.starts_at ?? null,
      slotEndsAt: slot?.ends_at ?? null,
      courierName: o.courier_name as string | null,
      courierPhone: o.courier_phone as string | null,
    };
  });
}

export async function listMovements(cycleId: string) {
  const { data, error } = await db()
    .from("inventory_movements")
    .select("id, kind, units, reason, created_at, actor_id, product_id, orders(reference)")
    .eq("cycle_id", cycleId)
    .order("created_at", { ascending: false })
    .limit(150);
  if (error) throw error;
  return data as unknown as { id: number; kind: string; units: number; reason: string | null; created_at: string; actor_id: string | null; product_id: string; orders: { reference: string } | null }[];
}

export async function listActiveReservations(cycleId: string) {
  const { data, error } = await db()
    .from("stock_reservations")
    .select("id, product_id, units, expires_at, orders(reference)")
    .eq("cycle_id", cycleId)
    .eq("status", "active")
    .order("expires_at");
  if (error) throw error;
  return data as unknown as { id: string; product_id: string; units: number; expires_at: string; orders: { reference: string } | null }[];
}

export async function dashboard() {
  const today = startOfDakarDay();
  const cycle = await activeCycle();
  const [todayOrders, toPrepare, attention, toVerify, pendingPayments, paidToday, requests, inventory] = await Promise.all([
    db().from("orders").select("id, payment_status", { count: "exact" }).gte("created_at", today),
    db().from("orders").select("id, reference, status, fulfillment, customer_name, delivery_slots(starts_at)").in("status", ["confirmed", "preparing", "finishing", "ready"]).order("created_at").limit(50),
    db().from("orders").select("id, reference, customer_name").eq("status", "needs_attention"),
    db()
      .from("orders")
      .select("id, reference, customer_name, total_fcfa")
      .eq("payment_status", "pending")
      .not("status", "in", "(pending_payment,cancelled,expired,refunded)")
      .order("created_at"),
    db().from("orders").select("id", { count: "exact", head: true }).eq("status", "pending_payment").eq("payment_status", "pending"),
    db().from("payments").select("amount_fcfa").eq("status", "paid").gte("paid_at", today),
    db().from("custom_requests").select("id, status"),
    cycle ? db().from("inventory_overview").select("*").eq("cycle_id", cycle.id) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [todayOrders, toPrepare, attention, toVerify, pendingPayments, paidToday, requests, inventory]) if (r.error) throw r.error;
  const prepare = (toPrepare.data ?? []) as unknown as { id: string; reference: string; status: OrderStatus; fulfillment: Fulfillment; customer_name: string; delivery_slots: { starts_at: string } | null }[];
  const inv = (inventory.data ?? []) as { product_id: string; product_name: string; unit_label_plural: string; total_units: number; reserved_units: number; sold_units: number; available_units: number }[];
  const reqs = (requests.data ?? []) as { status: string }[];
  return {
    cycle,
    todayCount: todayOrders.count ?? 0,
    todayPaid: ((todayOrders.data ?? []) as { payment_status: string }[]).filter((o) => o.payment_status === "paid").length,
    revenueTodayFcfa: ((paidToday.data ?? []) as { amount_fcfa: number }[]).reduce((s, p) => s + p.amount_fcfa, 0),
    pendingPayments: pendingPayments.count ?? 0,
    attention: (attention.data ?? []) as { id: string; reference: string; customer_name: string }[],
    /** Commandes confirmées par le lien Wave dont le paiement n'est pas encore constaté. */
    toVerify: (toVerify.data ?? []) as { id: string; reference: string; customer_name: string; total_fcfa: number }[],
    toPrepare: prepare,
    deliveries: prepare.filter((o) => o.fulfillment === "delivery").length,
    pickups: prepare.filter((o) => o.fulfillment === "pickup").length,
    lowStock: inv.filter((i) => i.total_units === 0 || i.available_units <= Math.ceil(i.total_units * 0.2)),
    inventory: inv,
    openRequests: reqs.filter((r) => ["received", "studying", "info_requested"].includes(r.status)).length,
    acceptedRequests: reqs.filter((r) => ["accepted", "awaiting_payment", "paid", "preparing"].includes(r.status)).length,
  };
}

export async function listCustomers(q: string | null) {
  const { data, error } = await db().rpc("admin_customers", { p_query: q });
  if (error) throw error;
  return (data ?? []) as {
    phone: string;
    name: string | null;
    email: string | null;
    user_id: string | null;
    orders_count: number;
    paid_total_fcfa: number;
    last_order_at: string | null;
    requests_count: number;
  }[];
}

export async function getCustomer(phone: string) {
  const [orders, requests, notes, profile] = await Promise.all([
    listOrders({ q: phone }),
    db().from("custom_requests").select("id, reference, status, occasion, event_at, created_at").eq("customer_phone", phone).order("created_at", { ascending: false }),
    db().from("customer_notes").select("id, body, author_id, created_at").eq("customer_phone", phone).order("created_at", { ascending: false }),
    db().from("profiles").select("id, full_name, email, marketing_consent, order_updates_consent, consents_updated_at, created_at").eq("phone", phone.replace(/^\+/, "")).maybeSingle(),
  ]);
  const userId = (profile.data?.id as string | undefined) ?? null;
  const addresses = userId
    ? ((await db().from("addresses").select("id, label, address_line, district, landmark, latitude, longitude").eq("user_id", userId)).data ?? [])
    : [];
  const names = await actorNames(((notes.data ?? []) as { author_id: string | null }[]).map((n) => n.author_id));
  return {
    orders: orders.filter((o) => o.customerPhone === phone),
    requests: (requests.data ?? []) as { id: string; reference: string; status: string; occasion: string; event_at: string; created_at: string }[],
    notes: ((notes.data ?? []) as { id: string; body: string; author_id: string | null; created_at: string }[]).map((n) => ({
      id: n.id,
      body: n.body,
      author: n.author_id ? (names.get(n.author_id) ?? "Équipe") : "Équipe",
      createdAt: n.created_at,
    })),
    profile: profile.data as {
      id: string;
      full_name: string | null;
      email: string | null;
      marketing_consent: boolean;
      order_updates_consent: boolean;
      consents_updated_at: string | null;
      created_at: string;
    } | null,
    addresses: addresses as { id: string; label: string | null; address_line: string; district: string | null; landmark: string | null; latitude: number | null; longitude: number | null }[],
  };
}

export async function listAudit(limit = 200) {
  const { data, error } = await db().from("audit_logs").select("id, action, entity, entity_id, details, actor_id, created_at").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  const rows = (data ?? []) as { id: number; action: string; entity: string; entity_id: string | null; details: unknown; actor_id: string | null; created_at: string }[];
  const names = await actorNames(rows.map((r) => r.actor_id));
  return rows.map((r) => ({ ...r, actor: r.actor_id ? (names.get(r.actor_id) ?? "Équipe") : "Système" }));
}

export async function listStaff() {
  const { data, error } = await db().from("staff_roles").select("user_id, role, created_at");
  if (error) throw error;
  const rows = (data ?? []) as { user_id: string; role: "admin" | "courier"; created_at: string }[];
  const names = await actorNames(rows.map((r) => r.user_id));
  return rows.map((r) => ({ userId: r.user_id, role: r.role, createdAt: r.created_at, name: names.get(r.user_id) ?? r.user_id }));
}

export async function getSettings(): Promise<Record<string, { value: unknown; isPublic: boolean }>> {
  const { data, error } = await db().from("site_settings").select("key, value, is_public");
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((s) => [s.key as string, { value: s.value, isPublic: s.is_public as boolean }]));
}
