/**
 * « Ma boîte » — logique pure du panier (aucune dépendance au navigateur).
 * Le navigateur ne conserve que des identifiants et des quantités : les prix
 * affichés viennent du catalogue et sont recalculés par le serveur à la commande.
 */
import { lineTotal, type Fcfa } from "@/lib/money";

export const MAX_LINE_QUANTITY = 50;
export const MAX_LINES = 30;

export interface CartLine {
  variantId: string;
  flavorId: string | null;
  quantity: number;
}

export interface Cart {
  version: 1;
  cycleId: string | null;
  lines: CartLine[];
  updatedAt: number;
}

export function emptyCart(cycleId: string | null = null): Cart {
  return { version: 1, cycleId, lines: [], updatedAt: Date.now() };
}

export function lineKey(line: Pick<CartLine, "variantId" | "flavorId">): string {
  return `${line.variantId}:${line.flavorId ?? "-"}`;
}

function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.max(1, Math.min(MAX_LINE_QUANTITY, Math.trunc(quantity)));
}

export function addLine(cart: Cart, line: CartLine): Cart {
  const key = lineKey(line);
  const existing = cart.lines.find((l) => lineKey(l) === key);
  const lines = existing
    ? cart.lines.map((l) =>
        lineKey(l) === key ? { ...l, quantity: clampQuantity(l.quantity + line.quantity) } : l,
      )
    : cart.lines.length >= MAX_LINES
      ? cart.lines
      : [...cart.lines, { ...line, quantity: clampQuantity(line.quantity) }];
  return { ...cart, lines, updatedAt: Date.now() };
}

export function setQuantity(cart: Cart, key: string, quantity: number): Cart {
  const lines =
    quantity <= 0
      ? cart.lines.filter((l) => lineKey(l) !== key)
      : cart.lines.map((l) => (lineKey(l) === key ? { ...l, quantity: clampQuantity(quantity) } : l));
  return { ...cart, lines, updatedAt: Date.now() };
}

export function removeLine(cart: Cart, key: string): Cart {
  return setQuantity(cart, key, 0);
}

export function itemCount(cart: Cart): number {
  return cart.lines.reduce((sum, l) => sum + l.quantity, 0);
}

export interface PricedLine {
  quantity: number;
  unitPrice: Fcfa;
}

export function subtotal(lines: PricedLine[]): Fcfa {
  return lines.reduce((sum, l) => sum + lineTotal(l.unitPrice, l.quantity), 0);
}

/** Unités de stock consommées par produit (stock commun à tous les formats). */
export function unitsByProduct(
  lines: { productId: string; unitsConsumed: number; quantity: number }[],
): Map<string, number> {
  const result = new Map<string, number>();
  for (const l of lines) {
    result.set(l.productId, (result.get(l.productId) ?? 0) + l.unitsConsumed * l.quantity);
  }
  return result;
}

/** Lecture tolérante d'un panier sauvegardé (données potentiellement corrompues ou anciennes). */
export function parseStoredCart(raw: unknown): Cart | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<Cart>;
  if (candidate.version !== 1 || !Array.isArray(candidate.lines)) return null;
  const lines: CartLine[] = [];
  for (const l of candidate.lines.slice(0, MAX_LINES)) {
    if (!l || typeof l !== "object") continue;
    const { variantId, flavorId, quantity } = l as Partial<CartLine>;
    if (typeof variantId !== "string" || typeof quantity !== "number") continue;
    if (flavorId !== null && typeof flavorId !== "string") continue;
    lines.push({ variantId, flavorId: flavorId ?? null, quantity: clampQuantity(quantity) });
  }
  return {
    version: 1,
    cycleId: typeof candidate.cycleId === "string" ? candidate.cycleId : null,
    lines,
    updatedAt: typeof candidate.updatedAt === "number" ? candidate.updatedAt : Date.now(),
  };
}
