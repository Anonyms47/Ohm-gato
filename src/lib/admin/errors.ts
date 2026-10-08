/** Messages des refus métier renvoyés par les fonctions SQL d'administration. */
const messages: Record<string, string> = {
  TRANSITION_INVALID: "Ce changement de statut n'est pas possible depuis le statut actuel.",
  ANOTHER_CYCLE_OPEN: "Une autre fournée est déjà ouverte. Clôturez-la avant d'en ouvrir une nouvelle.",
  CYCLE_EMPTY: "Ajoutez au moins un produit à la fournée avant de l'ouvrir.",
  CYCLE_DATES_PAST: "L'heure de clôture est déjà passée : modifiez les dates avant d'ouvrir.",
  CYCLE_NOT_FOUND: "Fournée introuvable.",
  STOCK_INVALID: "Le stock doit être un nombre entier positif.",
  STOCK_BELOW_COMMITTED: "Impossible : des unités sont déjà réservées ou vendues au-delà de ce total.",
  NOT_IN_CYCLE: "Ce produit ne fait pas partie de la fournée.",
  ORDER_NOT_FOUND: "Commande introuvable.",
  REQUEST_NOT_FOUND: "Demande introuvable.",
  REQUEST_LOCKED: "Cette demande ne peut plus recevoir de proposition (paiement ouvert ou terminé).",
  PRICE_REQUIRED: "Indiquez un prix total.",
  PAYMENT_NOT_FOUND: "Aucun paiement en attente pour cette commande.",
  ORDER_NOT_PAYABLE: "Cette commande est annulée ou expirée : le paiement ne peut plus être enregistré.",
};

export function adminErrorMessage(error: { message: string; details?: string | null }): string {
  if (error.message === "STOCK_BELOW_COMMITTED" && error.details) {
    try {
      const detail = JSON.parse(error.details) as { committed?: number };
      if (detail.committed !== undefined) return `Impossible : ${detail.committed} unités sont déjà réservées ou vendues.`;
    } catch {
      // message générique
    }
  }
  return messages[error.message] ?? "Action impossible pour le moment.";
}

export type AdminState = { ok: boolean; message: string } | null;
