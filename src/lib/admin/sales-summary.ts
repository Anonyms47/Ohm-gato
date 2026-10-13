/**
 * Résumé des ventes de l'atelier (calcul pur, sans accès aux données).
 * Seuls les montants réellement payés comptent ; les remboursements enregistrés sont déduits.
 * Dakar vit à l'heure UTC toute l'année : les périodes sont découpées en UTC.
 */

export const PERIODS = [
  { key: "mois", label: "Ce mois-ci" },
  { key: "mois-precedent", label: "Mois précédent" },
  { key: "annee", label: "Cette année" },
  { key: "tout", label: "Depuis le début" },
] as const;

export type PeriodKey = (typeof PERIODS)[number]["key"];

export function parsePeriod(value: string | undefined): PeriodKey {
  return PERIODS.some((p) => p.key === value) ? (value as PeriodKey) : "mois";
}

/** Bornes [début, fin[ d'une période ; null pour « depuis le début ». */
export function periodBounds(key: PeriodKey, now: Date): { from: Date; to: Date } | null {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (key === "mois")
    return {
      from: new Date(Date.UTC(y, m, 1)),
      to: new Date(Date.UTC(y, m + 1, 1)),
    };
  if (key === "mois-precedent")
    return {
      from: new Date(Date.UTC(y, m - 1, 1)),
      to: new Date(Date.UTC(y, m, 1)),
    };
  if (key === "annee")
    return {
      from: new Date(Date.UTC(y, 0, 1)),
      to: new Date(Date.UTC(y + 1, 0, 1)),
    };
  return null;
}

export interface PaidOrder {
  id: string;
  paidAt: string;
  totalFcfa: number;
  fulfillment: "pickup" | "delivery";
  cycleNumber: number | null;
  provider: string | null;
}

export interface SoldItem {
  orderId: string;
  productName: string;
  units: number;
  lineTotalFcfa: number;
}

export interface Refund {
  amountFcfa: number;
}

export interface SalesSummary {
  paidFcfa: number;
  refundedFcfa: number;
  netFcfa: number;
  paidOrders: number;
  averageFcfa: number;
  byProvider: { label: string; orders: number; fcfa: number }[];
  byFulfillment: { label: string; orders: number; fcfa: number }[];
  byCycle: { number: number; orders: number; fcfa: number }[];
  byMonth: { month: string; orders: number; fcfa: number }[];
  products: { name: string; units: number; fcfa: number }[];
}

const PROVIDER_LABELS: Record<string, string> = {
  wave_link: "Wave",
  wave: "Wave",
  orange_money: "Orange Money",
  test: "Paiement de test",
};

function group<K extends string | number>(orders: PaidOrder[], key: (o: PaidOrder) => K) {
  const map = new Map<K, { orders: number; fcfa: number }>();
  for (const o of orders) {
    const k = key(o);
    const row = map.get(k) ?? { orders: 0, fcfa: 0 };
    row.orders += 1;
    row.fcfa += o.totalFcfa;
    map.set(k, row);
  }
  return map;
}

export function summarizeSales(orders: PaidOrder[], items: SoldItem[], refunds: Refund[]): SalesSummary {
  const paidFcfa = orders.reduce((s, o) => s + o.totalFcfa, 0);
  const refundedFcfa = refunds.reduce((s, r) => s + r.amountFcfa, 0);
  const paidIds = new Set(orders.map((o) => o.id));

  const products = new Map<string, { units: number; fcfa: number }>();
  for (const i of items) {
    if (!paidIds.has(i.orderId)) continue;
    const row = products.get(i.productName) ?? { units: 0, fcfa: 0 };
    row.units += i.units;
    row.fcfa += i.lineTotalFcfa;
    products.set(i.productName, row);
  }

  const byDesc = <T extends { fcfa: number }>(a: T, b: T) => b.fcfa - a.fcfa;
  return {
    paidFcfa,
    refundedFcfa,
    netFcfa: paidFcfa - refundedFcfa,
    paidOrders: orders.length,
    averageFcfa: orders.length ? Math.round(paidFcfa / orders.length) : 0,
    byProvider: [...group(orders, (o) => PROVIDER_LABELS[o.provider ?? ""] ?? "Autre")].map(([label, v]) => ({ label, ...v })).sort(byDesc),
    byFulfillment: [...group(orders, (o) => (o.fulfillment === "pickup" ? "Retrait" : "Livraison"))].map(([label, v]) => ({ label, ...v })).sort(byDesc),
    byCycle: [
      ...group(
        orders.filter((o) => o.cycleNumber !== null),
        (o) => o.cycleNumber as number,
      ),
    ]
      .map(([number, v]) => ({ number, ...v }))
      .sort((a, b) => b.number - a.number),
    byMonth: [...group(orders, (o) => o.paidAt.slice(0, 7))].map(([month, v]) => ({ month, ...v })).sort((a, b) => b.month.localeCompare(a.month)),
    products: [...products].map(([name, v]) => ({ name, ...v })).sort(byDesc),
  };
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « 2026-10 » → « octobre 2026 ». */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
}
