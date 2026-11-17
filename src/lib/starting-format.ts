/** Plus petit format d'un produit avec son prix : « Box de 3 : 2 200 FCFA », jamais un « dès… » ambigu. */
export function startingFormat<T extends { label: string; priceFcfa: number }>(variants: T[]): T | null {
  return variants.reduce<T | null>((best, v) => (best === null || v.priceFcfa < best.priceFcfa ? v : best), null);
}
