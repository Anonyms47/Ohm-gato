/** Sur-mesure : statuts, libellés et types de demandes (partagés serveur / navigateur). */

export const CUSTOM_STATUSES = [
  "received",
  "studying",
  "info_requested",
  "proposal_sent",
  "accepted",
  "declined",
  "awaiting_payment",
  "paid",
  "preparing",
  "done",
] as const;
export type CustomStatus = (typeof CUSTOM_STATUSES)[number];

export const customStatusLabel: Record<CustomStatus, string> = {
  received: "Reçue",
  studying: "En cours d'étude",
  info_requested: "Informations demandées",
  proposal_sent: "Proposition envoyée",
  accepted: "Acceptée",
  declined: "Refusée",
  awaiting_payment: "En attente de paiement",
  paid: "Payée",
  preparing: "En préparation",
  done: "Terminée",
};

/** Le client peut encore modifier sa demande (tant qu'aucune proposition n'est en attente). */
export function customRequestEditable(status: CustomStatus): boolean {
  return status === "received" || status === "studying" || status === "info_requested";
}

/** Échanges possibles tant que la demande n'est ni refusée ni terminée. */
export function customRequestOpen(status: CustomStatus): boolean {
  return status !== "declined" && status !== "done";
}

export const CUSTOM_KINDS = [
  { value: "verrines", label: "Verrines", productSlug: "verrines-fruitees" },
  { value: "brownies-mms", label: "Brownies aux M&M's", productSlug: null },
  { value: "muffins-fruites", label: "Muffins fruités", productSlug: null },
  { value: "choux", label: "Choux", productSlug: "choux-creme" },
  { value: "gateau-entier", label: "Gâteaux entiers", productSlug: null },
  { value: "standard", label: "Produits de la carte", productSlug: null },
  { value: "creation", label: "Création à discuter", productSlug: null },
] as const;
export type CustomKind = (typeof CUSTOM_KINDS)[number]["value"];

export function customKindLabel(kind: string): string {
  return CUSTOM_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

export const OCCASIONS = [
  "Anniversaire",
  "Baptême",
  "Mariage",
  "Fiançailles",
  "Fête de famille",
  "Événement d'entreprise",
  "Événement étudiant",
  "Remerciements / cadeau",
  "Autre occasion",
] as const;

/** Pièces jointes acceptées : images et PDF, 5 Mo maximum. */
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;

/** Délai minimal entre l'envoi et l'événement (« Sur-mesure : 2 à 4 jours selon la quantité »). */
export const CUSTOM_MIN_DELAY_HOURS = 48;
