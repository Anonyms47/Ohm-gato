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

export function currentCycleStep(cycle: { status: string; surplusEndsAt?: string | null; fulfillmentDate?: string }, now: number): CycleStepKey {
  const phase = cyclePhase(cycle, now);
  switch (cycle.status) {
    case "draft":
      return "preparer";
    case "scheduled":
      return "ouvrir";
    case "open":
      return "suivre";
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
export function openingChecks(input: { products: number; preorderSlots: number; productionDate: string; fulfillmentDate: string; now: number }): Check[] {
  return [
    { label: "Au moins un produit proposé", ok: input.products > 0 },
    { label: "Au moins un créneau de retrait ou de livraison", ok: input.preorderSlots > 0 },
    { label: "Date de livraison et de retrait à venir", ok: input.fulfillmentDate >= new Date(input.now).toISOString().slice(0, 10) },
    { label: "Livraison pas avant la production", ok: input.fulfillmentDate >= input.productionDate },
  ];
}
