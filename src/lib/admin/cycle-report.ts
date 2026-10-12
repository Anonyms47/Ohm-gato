import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface CycleFollow {
  /** Commandes non annulées. */
  orders: number;
  paid: number;
  waveToVerify: number;
  /** Total des commandes payées (produits uniquement). */
  confirmedFcfa: number;
  ready: number;
  served: number;
  pickups: number;
  deliveries: number;
}

export interface CycleReport extends CycleFollow {
  cancelled: number;
  refundedFcfa: number;
  /** Ventes payées, nettes des remboursements enregistrés. */
  netFcfa: number;
  topProducts: { name: string; units: number }[];
}

interface OrderRow {
  id: string;
  status: string;
  payment_status: string;
  fulfillment: string;
  total_fcfa: number;
}

/** Suivi et bilan d'une fournée : uniquement des montants réellement payés, jamais de commande non payée comptée. */
export async function getCycleReport(cycleId: string): Promise<CycleReport> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("orders").select("id, status, payment_status, fulfillment, total_fcfa").eq("cycle_id", cycleId);
  if (error) throw error;
  const orders = (data ?? []) as OrderRow[];
  const live = orders.filter((o) => !["cancelled", "expired", "refunded"].includes(o.status));
  const paid = orders.filter((o) => o.payment_status === "paid");
  const paidIds = paid.map((o) => o.id);

  const [items, refunds] = await Promise.all([
    paidIds.length ? db.from("order_items").select("product_name, quantity, units_per_item").in("order_id", paidIds) : Promise.resolve({ data: [], error: null }),
    orders.length ? db.from("order_refunds").select("amount_fcfa").in("order_id", orders.map((o) => o.id)) : Promise.resolve({ data: [], error: null }),
  ]);
  if (items.error) throw items.error;
  if (refunds.error) throw refunds.error;

  const byProduct = new Map<string, number>();
  for (const i of (items.data ?? []) as { product_name: string; quantity: number; units_per_item: number }[]) {
    byProduct.set(i.product_name, (byProduct.get(i.product_name) ?? 0) + i.quantity * i.units_per_item);
  }
  const confirmedFcfa = paid.reduce((s, o) => s + o.total_fcfa, 0);
  const refundedFcfa = ((refunds.data ?? []) as { amount_fcfa: number }[]).reduce((s, r) => s + r.amount_fcfa, 0);

  return {
    orders: live.length,
    paid: paid.length,
    waveToVerify: live.filter((o) => o.payment_status === "pending" && o.status !== "pending_payment").length,
    confirmedFcfa,
    ready: live.filter((o) => o.status === "ready").length,
    served: orders.filter((o) => o.status === "delivered" || o.status === "picked_up").length,
    pickups: live.filter((o) => o.fulfillment === "pickup").length,
    deliveries: live.filter((o) => o.fulfillment === "delivery").length,
    cancelled: orders.filter((o) => o.status === "cancelled" || o.status === "expired").length,
    refundedFcfa,
    netFcfa: confirmedFcfa - refundedFcfa,
    topProducts: [...byProduct.entries()].map(([name, units]) => ({ name, units })).sort((a, b) => b.units - a.units).slice(0, 5),
  };
}

export interface PrintTrace {
  printedAt: string;
  printedBy: string | null;
}

export async function lastProductionPrint(cycleId: string): Promise<PrintTrace | null> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("production_sheet_prints").select("printed_at, printed_by").eq("cycle_id", cycleId).order("printed_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  let name: string | null = null;
  if (data.printed_by) {
    const { data: p } = await db.from("profiles").select("full_name, phone").eq("id", data.printed_by).maybeSingle();
    name = (p?.full_name as string | null) || (p?.phone ? `+${p.phone}` : "Équipe");
  }
  return { printedAt: data.printed_at as string, printedBy: name };
}
