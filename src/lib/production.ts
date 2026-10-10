/**
 * Calculs de production d'une fournée (administration). Même règle que la base
 * (admin_publish_surplus) : rien n'est publié automatiquement, ce calcul n'est qu'indicatif.
 */
export interface ProductionStock {
  producedUnits: number | null;
  lostUnits: number;
  reservedUnits: number;
  soldUnits: number;
  totalUnits: number;
}

/**
 * Surplus théorique encore publiable = production commercialisable - unités engagées
 * (réservées ou vendues) - surplus déjà publié et encore disponible. null tant que la
 * production réelle n'est pas saisie.
 */
export function theoreticalSurplus(stock: ProductionStock, cycleStatus: string): number | null {
  if (stock.producedUnits === null) return null;
  const sellable = stock.producedUnits - stock.lostUnits;
  const committed = stock.reservedUnits + stock.soldUnits;
  const published = cycleStatus === "surplus" ? Math.max(0, stock.totalUnits - committed) : 0;
  return Math.max(0, sellable - committed - published);
}
