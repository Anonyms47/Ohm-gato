import "server-only";
import { periodBounds, summarizeSales, type PaidOrder, type PeriodKey, type SalesSummary, type SoldItem } from "@/lib/admin/sales-summary";
import { supabaseAdmin } from "@/lib/supabase/admin";

const PAGE = 1000;

/** Lit toutes les lignes d'une requête, page par page (PostgREST plafonne chaque réponse). */
async function all<T>(query: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return rows;
  }
}

function chunks<T>(list: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export interface SalesOverview extends SalesSummary {
  /** Paiements Wave déclarés mais pas encore vérifiés (état actuel, hors période). */
  waveToVerify: { orders: number; fcfa: number };
}

/** Résumé des ventes payées sur la période (date du paiement), remboursements datés sur la même période. */
export async function getSalesOverview(period: PeriodKey, now: Date): Promise<SalesOverview> {
  const db = supabaseAdmin();
  const bounds = periodBounds(period, now);

  const orders = await all<{
    id: string;
    paid_at: string | null;
    created_at: string;
    total_fcfa: number;
    fulfillment: "pickup" | "delivery";
    production_cycles: { number: number } | null;
  }>((from, to) => {
    let q = db.from("orders").select("id, paid_at, created_at, total_fcfa, fulfillment, production_cycles(number)").eq("payment_status", "paid");
    if (bounds) q = q.gte("paid_at", bounds.from.toISOString()).lt("paid_at", bounds.to.toISOString());
    return q.order("paid_at", { ascending: false }).range(from, to);
  });
  const ids = orders.map((o) => o.id);

  const payments: { order_id: string; provider: string }[] = [];
  const items: {
    order_id: string;
    product_name: string;
    quantity: number;
    units_per_item: number;
    line_total_fcfa: number;
  }[] = [];
  for (const part of chunks(ids)) {
    const [p, i] = await Promise.all([
      db.from("payments").select("order_id, provider").eq("status", "paid").in("order_id", part),
      db.from("order_items").select("order_id, product_name, quantity, units_per_item, line_total_fcfa").in("order_id", part),
    ]);
    if (p.error) throw p.error;
    if (i.error) throw i.error;
    payments.push(...((p.data ?? []) as typeof payments));
    items.push(...((i.data ?? []) as typeof items));
  }
  const providerOf = new Map(payments.map((p) => [p.order_id, p.provider]));

  const refunds = await all<{ amount_fcfa: number }>((from, to) => {
    let q = db.from("order_refunds").select("amount_fcfa");
    if (bounds) q = q.gte("refunded_at", bounds.from.toISOString().slice(0, 10)).lt("refunded_at", bounds.to.toISOString().slice(0, 10));
    return q.range(from, to);
  });

  const { data: pending, error: pendingError } = await db
    .from("orders")
    .select("total_fcfa")
    .eq("payment_status", "pending")
    .not("status", "in", "(pending_payment,cancelled,expired,refunded)");
  if (pendingError) throw pendingError;

  const paidOrders: PaidOrder[] = orders.map((o) => ({
    id: o.id,
    paidAt: o.paid_at ?? o.created_at,
    totalFcfa: o.total_fcfa,
    fulfillment: o.fulfillment,
    cycleNumber: o.production_cycles?.number ?? null,
    provider: providerOf.get(o.id) ?? null,
  }));
  const soldItems: SoldItem[] = items.map((i) => ({
    orderId: i.order_id,
    productName: i.product_name,
    units: i.quantity * i.units_per_item,
    lineTotalFcfa: i.line_total_fcfa,
  }));

  const pendingRows = (pending ?? []) as { total_fcfa: number }[];
  return {
    ...summarizeSales(
      paidOrders,
      soldItems,
      refunds.map((r) => ({ amountFcfa: r.amount_fcfa })),
    ),
    waveToVerify: {
      orders: pendingRows.length,
      fcfa: pendingRows.reduce((s, o) => s + o.total_fcfa, 0),
    },
  };
}
