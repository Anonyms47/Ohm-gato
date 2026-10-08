/** Statuts de commande et de paiement : libellés et carnet de route. */

export const ORDER_STATUSES = [
  "pending_payment",
  "awaiting_validation",
  "confirmed",
  "preparing",
  "finishing",
  "ready",
  "out_for_delivery",
  "delivered",
  "picked_up",
  "cancelled",
  "expired",
  "refunded",
  "needs_attention",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "cancelled", "expired", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type Fulfillment = "delivery" | "pickup";

export interface RoadStep {
  key: OrderStatus;
  label: string;
}

/** Étapes du carnet de route, dans l'ordre réel de production. */
export function roadSteps(fulfillment: Fulfillment): RoadStep[] {
  return [
    { key: "confirmed", label: "Confirmée" },
    { key: "preparing", label: "En préparation" },
    { key: "finishing", label: "Cuisson et finitions" },
    { key: "ready", label: fulfillment === "pickup" ? "Prête au retrait" : "Prête" },
    ...(fulfillment === "delivery"
      ? [
          { key: "out_for_delivery" as const, label: "En livraison" },
          { key: "delivered" as const, label: "Livrée" },
        ]
      : [{ key: "picked_up" as const, label: "Récupérée" }]),
  ];
}

/** Index de la dernière étape atteinte (-1 si la commande n'est pas encore confirmée). */
export function reachedStepIndex(status: OrderStatus, fulfillment: Fulfillment): number {
  return roadSteps(fulfillment).findIndex((s) => s.key === status);
}

export function isPaid(paymentStatus: PaymentStatus): boolean {
  return paymentStatus === "paid";
}

/** Une commande provisoire peut-elle encore être payée ? */
export function isAwaitingPayment(status: OrderStatus, paymentStatus: PaymentStatus): boolean {
  return status === "pending_payment" && paymentStatus === "pending";
}

export function isTerminalFailure(status: OrderStatus): boolean {
  return status === "cancelled" || status === "expired" || status === "refunded";
}

export const statusHeadline: Record<OrderStatus, string> = {
  pending_payment: "Paiement en attente",
  awaiting_validation: "Adresse à valider par l'équipe",
  confirmed: "Commande confirmée",
  preparing: "En préparation",
  finishing: "Cuisson et finitions",
  ready: "Prête",
  out_for_delivery: "En livraison",
  delivered: "Livrée",
  picked_up: "Récupérée",
  cancelled: "Commande annulée",
  expired: "Délai de paiement dépassé",
  refunded: "Commande remboursée",
  needs_attention: "Paiement reçu — l'équipe vérifie votre commande",
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  pending: "En attente",
  paid: "Payée",
  failed: "Échoué",
  cancelled: "Annulé",
  expired: "Expiré",
  refunded: "Remboursé",
};
