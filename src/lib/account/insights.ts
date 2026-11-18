import type { MemberOrder } from "@/lib/account/data";

/**
 * Repères de « Mon carnet », calculés uniquement à partir des commandes réelles de la cliente.
 * Rien n'est inventé : pas de points, pas de niveau, pas de récompense.
 */

const NOT_COUNTED = new Set(["cancelled", "expired", "refunded", "pending_payment", "awaiting_validation"]);

/** Une commande compte dans le carnet dès qu'elle a été confirmée et tant qu'elle n'a pas été annulée ou remboursée. */
export function isCountedOrder(order: Pick<MemberOrder, "status">): boolean {
  return !NOT_COUNTED.has(order.status);
}

export interface FavoriteHabit {
  productId: string | null;
  productName: string;
  quantity: number;
}

export interface CarnetInsights {
  orderCount: number;
  /** Numéros de fournée distincts, du plus ancien au plus récent (un tampon chacun). */
  cycleNumbers: number[];
  habits: FavoriteHabit[];
  /** Dernière boîte composée (hors sur-mesure) : sert à la recomposer en un geste. */
  lastBox: MemberOrder | null;
}

export function computeInsights(orders: MemberOrder[], habitCount = 3): CarnetInsights {
  const counted = orders.filter(isCountedOrder);
  const cycleNumbers = [...new Set(counted.flatMap((o) => (o.cycleNumber !== null && !o.isCustom ? [o.cycleNumber] : [])))].sort((a, b) => a - b);

  const byProduct = new Map<string, FavoriteHabit>();
  for (const order of counted) {
    if (order.isCustom) continue;
    for (const item of order.items) {
      const key = item.productId ?? item.productName;
      const current = byProduct.get(key);
      if (current) current.quantity += item.quantity;
      else byProduct.set(key, { productId: item.productId, productName: item.productName, quantity: item.quantity });
    }
  }
  const habits = [...byProduct.values()].sort((a, b) => b.quantity - a.quantity || a.productName.localeCompare(b.productName, "fr")).slice(0, habitCount);

  const lastBox = [...counted].filter((o) => !o.isCustom && o.items.length > 0).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  return { orderCount: counted.length, cycleNumbers, habits, lastBox };
}

/** Salutation selon l'heure de Dakar. */
export function greetingFor(now = new Date()): string {
  const hour = Number.parseInt(new Intl.DateTimeFormat("fr-SN", { hour: "numeric", hourCycle: "h23", timeZone: "Africa/Dakar" }).format(now), 10);
  if (hour >= 5 && hour < 18) return "Bonjour";
  return "Bonsoir";
}

/** « depuis mars 2026 » */
export function memberSince(createdAt: string): string {
  return new Intl.DateTimeFormat("fr-SN", { month: "long", year: "numeric", timeZone: "Africa/Dakar" }).format(new Date(createdAt));
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count > 1 ? many : one}`;
}
