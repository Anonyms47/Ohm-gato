/** Parcours d'une fournée dans l'atelier : sept étapes, une seule en cours. Module pur. */
import { cyclePhase } from "@/lib/cycle-status";

export const CYCLE_STEPS = [
  { key: "preparer", label: "Préparer" },
  { key: "ouvrir", label: "Ouvrir" },
  { key: "suivre", label: "Suivre les commandes" },
  { key: "produire", label: "Produire" },
  { key: "livrer", label: "Livrer" },
  { key: "surplus", label: "Gérer le surplus" },
  { key: "terminer", label: "Terminer" },
] as const;

export type CycleStepKey = (typeof CYCLE_STEPS)[number]["key"];

export function currentCycleStep(cycle: { status: string; opensAt: string; closesAt: string; surplusEndsAt?: string | null }, now: number): CycleStepKey {
  const phase = cyclePhase(cycle, now);
  switch (cycle.status) {
    case "draft":
      return "preparer";
    case "scheduled":
      return "ouvrir";
    case "open":
      return phase === "scheduled" ? "ouvrir" : phase === "closed" ? "produire" : "suivre";
    case "closed":
    case "preparing":
      return "produire";
    case "delivering":
      return "livrer";
    case "surplus":
      return phase === "done" ? "terminer" : "surplus";
    default:
      return "terminer";
  }
}

export interface Check {
  label: string;
  ok: boolean;
}

/** Vérifications obligatoires avant l'ouverture (les mêmes que celles du serveur, en clair). */
export function openingChecks(input: { products: number; preorderSlots: number; opensAt: string; closesAt: string; fulfillmentDate: string; now: number }): Check[] {
  const closes = Date.parse(input.closesAt);
  return [
    { label: "Au moins un produit proposé", ok: input.products > 0 },
    { label: "Au moins un créneau de retrait ou de livraison", ok: input.preorderSlots > 0 },
    { label: "Date limite dans le futur", ok: closes > input.now },
    { label: "Date limite après l'ouverture", ok: closes > Date.parse(input.opensAt) },
    { label: "Livraison après la date limite", ok: Date.parse(`${input.fulfillmentDate}T23:59:59Z`) >= closes },
  ];
}
