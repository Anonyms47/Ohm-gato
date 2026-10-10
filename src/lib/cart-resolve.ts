/**
 * Rapproche « Ma boîte » du catalogue courant : prix actuels, disponibilité,
 * stock commun entre formats. Utilisé à l'affichage et avant la commande ;
 * le serveur refait la même vérification de manière atomique.
 */
import { lineKey, type Cart, type CartLine } from "@/lib/cart";
import type { CatalogFlavor, CatalogProduct, CatalogVariant, CycleSummary } from "@/lib/catalog-types";
import { orderableUnits } from "@/lib/availability";
import { lineTotal } from "@/lib/money";

export type LineIssue =
  | "unknown"            // format retiré de la carte
  | "closed"             // fournée fermée
  | "not_in_cycle"       // produit ou format absent de la fournée
  | "flavor_required"
  | "flavor_unavailable"
  | "insufficient_stock";

export interface ResolvedLine {
  key: string;
  line: CartLine;
  product: CatalogProduct | null;
  variant: CatalogVariant | null;
  flavor: CatalogFlavor | null;
  unitPrice: number;
  total: number;
  issue: LineIssue | null;
}

export interface ResolvedCart {
  lines: ResolvedLine[];
  subtotal: number;
  itemCount: number;
  hasIssues: boolean;
  /** La boîte a été composée pour une autre fournée. */
  fromOtherCycle: boolean;
}

export function indexVariants(products: CatalogProduct[]) {
  const index = new Map<string, { product: CatalogProduct; variant: CatalogVariant }>();
  for (const product of products) for (const variant of product.variants) index.set(variant.id, { product, variant });
  return index;
}

export function resolveCart(cart: Cart, products: CatalogProduct[], cycle: CycleSummary | null): ResolvedCart {
  const index = indexVariants(products);
  const unitsUsed = new Map<string, number>();

  const lines: ResolvedLine[] = cart.lines.map((line) => {
    const found = index.get(line.variantId);
    if (!found) {
      return { key: lineKey(line), line, product: null, variant: null, flavor: null, unitPrice: 0, total: 0, issue: "unknown" };
    }
    const { product, variant } = found;
    const flavor = line.flavorId ? (product.flavors.find((f) => f.id === line.flavorId) ?? null) : null;
    let issue: LineIssue | null = null;

    if (!cycle?.isOpen) issue = "closed";
    else if (!product.inCycle || !variant.enabledInCycle) issue = "not_in_cycle";
    else if (product.flavors.length > 0 && !line.flavorId) issue = "flavor_required";
    else if (line.flavorId && (!flavor || !flavor.availableInCycle)) issue = "flavor_unavailable";
    else {
      // Stock commun : les lignes d'un même produit se partagent les unités restantes.
      const used = (unitsUsed.get(product.id) ?? 0) + variant.unitsConsumed * line.quantity;
      unitsUsed.set(product.id, used);
      const left = orderableUnits(product);
      if (left === null || used > left) issue = "insufficient_stock";
    }

    return {
      key: lineKey(line),
      line,
      product,
      variant,
      flavor,
      unitPrice: variant.priceFcfa,
      total: lineTotal(variant.priceFcfa, line.quantity),
      issue,
    };
  });

  return {
    lines,
    subtotal: lines.reduce((sum, l) => sum + l.total, 0),
    itemCount: lines.reduce((sum, l) => sum + l.line.quantity, 0),
    hasIssues: lines.some((l) => l.issue !== null),
    fromOtherCycle: Boolean(cart.cycleId && cycle && cart.cycleId !== cycle.id),
  };
}

export const lineIssueMessage: Record<LineIssue, string> = {
  unknown: "Ce format n'est plus proposé.",
  closed: "Les commandes sont fermées pour le moment.",
  not_in_cycle: "Pas dans la fournée actuelle.",
  flavor_required: "Choisissez un parfum.",
  flavor_unavailable: "Ce parfum n'est pas proposé dans cette fournée.",
  insufficient_stock: "Il n'en reste plus assez pour cette quantité.",
};
