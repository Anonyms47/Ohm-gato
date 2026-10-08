/** Fournées : statut affiché et étapes du journal, calculés depuis la base (aucune urgence inventée). */
import type { CycleSummary } from "@/lib/catalog-types";

export type CyclePhase = "scheduled" | "open" | "closed" | "preparing" | "delivering" | "done" | "cancelled";

/** Une fournée « ouverte » dont l'heure de clôture est passée est affichée comme clôturée. */
export function cyclePhase(cycle: Pick<CycleSummary, "status" | "opensAt" | "closesAt">, now = Date.now()): CyclePhase {
  switch (cycle.status) {
    case "open":
      if (now >= Date.parse(cycle.closesAt)) return "closed";
      if (now < Date.parse(cycle.opensAt)) return "scheduled";
      return "open";
    case "scheduled":
    case "draft":
      return "scheduled";
    case "closed":
    case "preparing":
    case "delivering":
    case "done":
    case "cancelled":
      return cycle.status;
    default:
      return "closed";
  }
}

export const cyclePhaseLabel: Record<CyclePhase, string> = {
  scheduled: "Programmée",
  open: "Commandes ouvertes",
  closed: "Commandes clôturées",
  preparing: "En préparation",
  delivering: "Livraison et retrait",
  done: "Terminée",
  cancelled: "Annulée",
};

export type StepState = "done" | "current" | "upcoming" | "cancelled";

export interface JournalStep {
  key: "opening" | "closing" | "preparing" | "fulfillment";
  label: string;
  date: string;
  withTime: boolean;
  state: StepState;
}

const ORDER: CyclePhase[] = ["scheduled", "open", "closed", "preparing", "delivering", "done"];

/** Les quatre dates du journal, chacune marquée passée, en cours ou à venir. */
export function journalSteps(cycle: CycleSummary, now = Date.now()): JournalStep[] {
  const phase = cyclePhase(cycle, now);
  const rank = ORDER.indexOf(phase);
  const state = (step: number): StepState => {
    if (phase === "cancelled") return "cancelled";
    if (rank > step) return "done";
    return rank === step ? "current" : "upcoming";
  };
  return [
    { key: "opening", label: "Ouverture des commandes", date: cycle.opensAt, withTime: true, state: state(1) },
    { key: "closing", label: "Clôture des commandes", date: cycle.closesAt, withTime: true, state: state(2) },
    { key: "preparing", label: "Préparation", date: cycle.productionDate, withTime: false, state: state(3) },
    { key: "fulfillment", label: "Livraison et retrait", date: cycle.fulfillmentDate, withTime: false, state: state(4) },
  ];
}
