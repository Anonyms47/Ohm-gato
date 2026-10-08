/**
 * Commandes récentes mémorisées sur cet appareil, pour la reprise après une
 * fermeture de fenêtre pendant le paiement. Ce n'est qu'un raccourci : la
 * commande reste accessible par son lien personnel et côté serveur.
 */
const KEY = "ohmegato.commandes.v1";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

export interface PendingOrder {
  reference: string;
  token: string;
  createdAt: number;
}

export function readPendingOrders(): PendingOrder[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as PendingOrder[]) : [];
    return list.filter((o) => typeof o.token === "string" && Date.now() - o.createdAt < MAX_AGE_MS);
  } catch {
    return [];
  }
}

export function rememberPendingOrder(order: PendingOrder) {
  try {
    const others = readPendingOrders().filter((o) => o.reference !== order.reference);
    window.localStorage.setItem(KEY, JSON.stringify([order, ...others].slice(0, 5)));
  } catch {
    // le lien de suivi reste la référence
  }
}

export function forgetPendingOrder(reference: string) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(readPendingOrders().filter((o) => o.reference !== reference)));
  } catch {
    // ignoré
  }
}
