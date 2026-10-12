/**
 * Étapes de travail d'une commande, vues depuis l'atelier : des besoins, pas des statuts techniques.
 * Module pur, partagé par les listes, la fiche commande et les actions groupées.
 */
import type { Fulfillment, OrderStatus, PaymentStatus } from "@/lib/order-status";

export type StageKey = "a-verifier" | "payees" | "a-preparer" | "prete" | "a-remettre" | "terminees" | "annulees";

export const STAGES: { key: StageKey; label: string; hint: string }[] = [
  { key: "a-verifier", label: "À vérifier", hint: "Paiement à constater ou commande à arbitrer." },
  { key: "payees", label: "Payées", hint: "Payées et prêtes à lancer en préparation." },
  { key: "a-preparer", label: "À préparer", hint: "En préparation ou en finitions." },
  { key: "prete", label: "Prêtes", hint: "À remettre à la cliente ou à confier au livreur." },
  { key: "a-remettre", label: "À remettre", hint: "En route avec le livreur : livraison à confirmer." },
  { key: "terminees", label: "Terminées", hint: "Livrées ou récupérées." },
  { key: "annulees", label: "Annulées", hint: "Annulées, expirées ou remboursées." },
];

export function orderStage(status: OrderStatus, payment: PaymentStatus): StageKey {
  switch (status) {
    case "pending_payment":
    case "awaiting_validation":
    case "needs_attention":
      return "a-verifier";
    case "confirmed":
      return payment === "paid" ? "payees" : "a-verifier";
    case "preparing":
    case "finishing":
      return "a-preparer";
    case "ready":
      return "prete";
    case "out_for_delivery":
      return "a-remettre";
    case "delivered":
    case "picked_up":
      return "terminees";
    default:
      return "annulees";
  }
}

/** Étape lisible pour Alima (jamais le nom technique). */
export function stageLabel(status: OrderStatus, payment: PaymentStatus, fulfillment: Fulfillment): string {
  switch (status) {
    case "pending_payment":
      return "Paiement en cours chez la cliente";
    case "awaiting_validation":
      return "Adresse à valider";
    case "needs_attention":
      return "Payée — à arbitrer";
    case "confirmed":
      return payment === "paid" ? "Payée — à lancer" : "Paiement à vérifier";
    case "preparing":
      return "En préparation";
    case "finishing":
      return "Cuisson et finitions";
    case "ready":
      return fulfillment === "pickup" ? "Prête — retrait à venir" : "Prête — à confier au livreur";
    case "out_for_delivery":
      return "En livraison";
    case "delivered":
      return "Livrée";
    case "picked_up":
      return "Remise au client";
    case "cancelled":
      return "Annulée";
    case "expired":
      return "Délai de paiement dépassé";
    case "refunded":
      return "Remboursée";
  }
}

/** Prochaine action, formulée comme un geste. null quand il n'y a plus rien à faire. */
export function nextActionLabel(status: OrderStatus, payment: PaymentStatus, fulfillment: Fulfillment): string | null {
  switch (status) {
    case "pending_payment":
      return "Attendre le paiement de la cliente";
    case "needs_attention":
      return "Arbitrer la commande";
    case "confirmed":
      return payment === "paid" ? "Passer en préparation" : "Vérifier le paiement Wave";
    case "preparing":
    case "finishing":
      return "Marquer prête";
    case "ready":
      return fulfillment === "pickup" ? "Remettre à la cliente" : "Confier au livreur";
    case "out_for_delivery":
      return "Confirmer la livraison";
    default:
      return null;
  }
}

export interface LifeStep {
  key: string;
  label: string;
  state: "done" | "current" | "todo" | "skipped";
}

/** Ligne de vie : reçue → paiement → préparation → prête → livraison/retrait → remise. */
export function lifeline(status: OrderStatus, payment: PaymentStatus, fulfillment: Fulfillment): LifeStep[] {
  const steps = [
    { key: "recue", label: "Commande reçue" },
    { key: "verif", label: "Paiement à vérifier" },
    { key: "payee", label: "Paiement confirmé" },
    { key: "preparation", label: "Préparation" },
    { key: "prete", label: "Commande prête" },
    { key: "route", label: fulfillment === "delivery" ? "En livraison" : "Retrait" },
    { key: "remise", label: "Commande remise" },
  ];
  const paid = payment === "paid" || payment === "refunded";
  const reached: Record<OrderStatus, number> = {
    pending_payment: 1,
    awaiting_validation: 1,
    needs_attention: 2,
    confirmed: paid ? 2 : 1,
    preparing: 3,
    finishing: 3,
    ready: 4,
    out_for_delivery: 5,
    delivered: 6,
    picked_up: 6,
    cancelled: -1,
    expired: -1,
    refunded: -1,
  };
  const index = reached[status];
  if (index < 0) return steps.map((s, i) => ({ ...s, state: i === 0 ? "done" : "skipped" }));
  return steps.map((s, i) => ({
    ...s,
    state: i < index || (i === index && index === steps.length - 1) ? "done" : i === index ? "current" : "todo",
  }));
}

/** Actions groupées possibles (jamais l'annulation ni le remboursement). */
export const BULK_ACTIONS = {
  preparing: { label: "Passer en préparation", from: ["confirmed"] as OrderStatus[], requiresPaid: true, fulfillment: null as Fulfillment | null },
  ready: { label: "Marquer prêtes", from: ["preparing", "finishing"] as OrderStatus[], requiresPaid: false, fulfillment: null as Fulfillment | null },
  picked_up: { label: "Retrait effectué", from: ["ready"] as OrderStatus[], requiresPaid: false, fulfillment: "pickup" as Fulfillment | null },
} as const;

export type BulkTarget = keyof typeof BULK_ACTIONS;

export function bulkEligible(target: BulkTarget, o: { status: OrderStatus; paymentStatus: PaymentStatus; fulfillment: Fulfillment }): boolean {
  const rule = BULK_ACTIONS[target];
  if (!rule.from.includes(o.status)) return false;
  if (rule.requiresPaid && o.paymentStatus !== "paid") return false;
  if (rule.fulfillment && o.fulfillment !== rule.fulfillment) return false;
  return true;
}
