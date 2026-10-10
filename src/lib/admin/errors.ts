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
  CYCLE_STOCK_MISSING: "Indiquez la capacité de précommande de chaque produit proposé avant d'ouvrir les commandes.",
  CYCLE_SLOTS_MISSING: "Ajoutez au moins un créneau de retrait ou de livraison (précommande) avant d'ouvrir les commandes.",
  SURPLUS_SLOTS_MISSING: "Ajoutez au moins un créneau à venir pour les commandes tardives (surplus) avant de publier.",
  PRODUCTION_NOT_ALLOWED: "La production se saisit après la clôture des précommandes.",
  PRODUCTION_INVALID: "Quantités invalides : les pertes ne peuvent pas dépasser la production.",
  PRODUCTION_BELOW_COMMITTED: "La production commercialisable ne peut pas être inférieure à ce qui est déjà vendu, réservé ou publié.",
  PRODUCTION_MISSING: "Saisissez la production réelle de ce produit avant de publier son surplus.",
  SURPLUS_EXCEEDS: "Quantité supérieure au surplus réellement disponible.",
  SURPLUS_EMPTY: "Indiquez au moins une quantité de surplus à publier.",
  SURPLUS_END_INVALID: "La dernière date de vente du surplus doit être dans le futur.",
  SURPLUS_INVALID: "Quantités de surplus invalides.",
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
  if (error.message === "SURPLUS_EXCEEDS" && error.details) {
    try {
      const detail = JSON.parse(error.details) as { max?: number };
      if (detail.max !== undefined) return `Quantité supérieure au surplus réellement disponible (au plus ${detail.max}).`;
    } catch {
      // message générique
    }
  }
  return messages[error.message] ?? "Action impossible pour le moment.";
}

export type AdminState = { ok: boolean; message: string } | null;
