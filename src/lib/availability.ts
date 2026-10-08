/**
 * Disponibilités calculées à partir du stock réel (aucune donnée inventée).
 * Le stock est commun à tous les formats d'un produit : une box de 6 consomme 6 unités.
 */

export type AvailabilityState =
  | "available"
  | "low"          // presque épuisé
  | "sold_out"
  | "out_of_cycle" // le produit ne fait pas partie de la fournée
  | "closed";      // fournée fermée ou non programmée

export interface StockSnapshot {
  totalUnits: number;
  reservedUnits: number;
  soldUnits: number;
}

export interface VariantLike {
  id: string;
  unitsConsumed: number;
}

/** Seuil « presque épuisé » : 20 % du stock initial ou moins. */
export const LOW_STOCK_RATIO = 0.2;

export function availableUnits(stock: StockSnapshot): number {
  return Math.max(0, stock.totalUnits - stock.reservedUnits - stock.soldUnits);
}

export function variantIsPurchasable(variant: VariantLike, unitsLeft: number): boolean {
  return variant.unitsConsumed <= unitsLeft;
}

/** Nombre maximal d'exemplaires d'un format encore commandables. */
export function maxQuantityFor(variant: VariantLike, unitsLeft: number, cap = 50): number {
  return Math.min(cap, Math.floor(unitsLeft / variant.unitsConsumed));
}

export function productAvailability(input: {
  cycleIsOpen: boolean;
  inCycle: boolean;
  stock: StockSnapshot | null;
  variants: VariantLike[];
}): AvailabilityState {
  if (!input.inCycle) return "out_of_cycle";
  if (!input.cycleIsOpen) return "closed";
  if (!input.stock || input.variants.length === 0) return "sold_out";
  const left = availableUnits(input.stock);
  const smallest = Math.min(...input.variants.map((v) => v.unitsConsumed));
  if (left < smallest) return "sold_out";
  if (left <= Math.ceil(input.stock.totalUnits * LOW_STOCK_RATIO)) return "low";
  return "available";
}

export const availabilityLabel: Record<AvailabilityState, string> = {
  available: "Disponible",
  low: "Presque épuisé",
  sold_out: "Épuisé",
  out_of_cycle: "Hors fournée",
  closed: "Commandes fermées",
};
