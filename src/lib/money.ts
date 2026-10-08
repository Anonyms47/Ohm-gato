/** Montants en FCFA : toujours des entiers. */
export type Fcfa = number;

const formatter = new Intl.NumberFormat("fr-SN", { maximumFractionDigits: 0 });

export function assertFcfa(value: number): Fcfa {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`Montant FCFA invalide : ${value}`);
  }
  return value;
}

/** « 4 500 FCFA » avec espaces insécables. */
export function formatFcfa(value: Fcfa): string {
  return `${formatter.format(assertFcfa(value)).replace(/\s/g, " ")} FCFA`;
}

export function lineTotal(unitPrice: Fcfa, quantity: number): Fcfa {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new RangeError(`Quantité invalide : ${quantity}`);
  }
  return assertFcfa(assertFcfa(unitPrice) * quantity);
}
