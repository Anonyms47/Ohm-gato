/** Codes d'erreur renvoyés par public.place_order → messages humains. */
export const ORDER_ERROR_MESSAGES: Record<string, string> = {
  EMPTY_CART: "Votre boîte est vide.",
  TOO_MANY_LINES: "Votre boîte contient trop de lignes. Regroupez certains articles.",
  CYCLE_NOT_OPEN: "Les commandes de cette fournée sont fermées. Votre boîte est conservée pour la prochaine.",
  SLOT_INVALID: "Ce créneau n'est plus proposé. Choisissez-en un autre.",
  SLOT_FULL: "Ce créneau vient d'être complet. Choisissez-en un autre.",
  ADDRESS_REQUIRED: "L'adresse de livraison est incomplète.",
  ZONE_INVALID: "Cette zone de livraison n'est plus desservie. Choisissez votre quartier à nouveau.",
  QUANTITY_INVALID: "Une quantité n'est pas valide.",
  ITEM_UNAVAILABLE: "Un article de votre boîte n'est plus proposé.",
  NOT_IN_CYCLE: "Un article de votre boîte ne fait pas partie de cette fournée.",
  FLAVOR_REQUIRED: "Choisissez un parfum pour chaque article qui en propose.",
  FLAVOR_UNAVAILABLE: "Un parfum choisi n'est pas disponible dans cette fournée.",
  INSUFFICIENT_STOCK: "Il ne reste plus assez de pièces pour un article de votre boîte.",
  CYCLE_FULL: "La fournée a atteint sa capacité maximale.",
  ORDER_NOT_PAYABLE: "Cette commande ne peut plus être payée.",
  ORDER_NOT_FOUND: "Commande introuvable.",
};

export function orderErrorMessage(code: string, detail?: Record<string, unknown>): string {
  if (code === "INSUFFICIENT_STOCK" && detail && typeof detail.product_name === "string") {
    const left = typeof detail.available === "number" ? detail.available : 0;
    return left > 0
      ? `Il ne reste que ${left} unité${left > 1 ? "s" : ""} de « ${detail.product_name} ». Ajustez votre boîte.`
      : `« ${detail.product_name} » vient d'être épuisé.`;
  }
  return ORDER_ERROR_MESSAGES[code] ?? "La commande n'a pas pu être enregistrée. Réessayez dans un instant.";
}
