/** Fournées : statut affiché et frise, calculés depuis la base (aucune urgence inventée). */
import type { CycleSummary } from "@/lib/catalog-types";
import { formatDay, formatTime, parseDate } from "@/lib/dates";

/**
 * Phases de la fournée (noms de la base) :
 * scheduled annoncée · open précommandes ouvertes · closed précommandes clôturées ·
 * preparing production en cours · delivering livraisons et retraits · surplus surplus disponible ·
 * done terminée · cancelled annulée.
 */
export type CyclePhase = "scheduled" | "open" | "closed" | "preparing" | "delivering" | "surplus" | "done" | "cancelled";

type PhaseInput = Pick<CycleSummary, "status" | "opensAt" | "closesAt"> & { surplusEndsAt?: string | null };

/**
 * Clôture automatique : une fournée « open » dont la date limite est passée est clôturée, un surplus
 * dont la date de fin est passée (ou épuisé) est terminé. Le serveur refuse les commandes de même.
 */
export function cyclePhase(cycle: PhaseInput, now = Date.now(), surplusExhausted = false): CyclePhase {
  switch (cycle.status) {
    case "open":
      if (now >= Date.parse(cycle.closesAt)) return "closed";
      if (now < Date.parse(cycle.opensAt)) return "scheduled";
      return "open";
    case "scheduled":
    case "draft":
      return "scheduled";
    case "surplus":
      if (surplusExhausted || (cycle.surplusEndsAt && now >= Date.parse(cycle.surplusEndsAt))) return "done";
      return "surplus";
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

/** Phase de la fournée maintenant (surplus épuisé compris). */
export function phaseNow(cycle: PhaseInput & { surplusExhausted?: boolean }): CyclePhase {
  return cyclePhase(cycle, Date.now(), cycle.surplusExhausted ?? false);
}

/** Un créneau dont la fin n'est pas encore passée. */
export function isUpcoming(iso: string): boolean {
  return Date.parse(iso) > Date.now();
}

export const cyclePhaseLabel: Record<CyclePhase, string> = {
  scheduled: "Annoncée",
  open: "Précommandes ouvertes",
  closed: "Précommandes clôturées",
  preparing: "Production en cours",
  delivering: "Livraison et retrait",
  surplus: "Surplus disponible",
  done: "Terminée",
  cancelled: "Annulée",
};

/** Type de commande accepté par une fournée à un instant donné (même règle que le serveur). */
export function orderKindFor(cycle: PhaseInput, now = Date.now()): "preorder" | "surplus" | null {
  const phase = cyclePhase(cycle, now);
  if (phase === "open") return "preorder";
  if (phase === "surplus") return "surplus";
  return null;
}

const NUMBER_WORDS = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept"];

const weekFormatter = new Intl.DateTimeFormat("fr-SN", { day: "numeric", month: "long", timeZone: "Africa/Dakar" });

/** « Production organisée sur trois jours pendant la semaine du 19 octobre. » — jamais de date inventée. */
export function productionLabel(cycle: Pick<CycleSummary, "productionDate" | "productionDays" | "productionDates">): string {
  if (cycle.productionDates.length > 0) {
    const days = [...cycle.productionDates].sort().map((d) => formatDay(d));
    const list = days.length === 1 ? days[0]! : `${days.slice(0, -1).join(", ")} et ${days.at(-1)}`;
    return `Production le ${list}.`;
  }
  const week = weekFormatter.format(parseDate(cycle.productionDate));
  if (cycle.productionDays && cycle.productionDays > 1) {
    return `Production organisée sur ${NUMBER_WORDS[cycle.productionDays] ?? cycle.productionDays} jours pendant la semaine du ${week}.`;
  }
  return `Production pendant la semaine du ${week}.`;
}

/** Message officiel de la phase de précommande. */
export function preorderMessage(cycle: Pick<CycleSummary, "closesAt" | "fulfillmentDate">): string {
  return `Commandez avant le ${formatDay(cycle.closesAt)} à ${formatTime(cycle.closesAt)}. Votre commande sera préparée pendant la semaine et livrée ou retirée le ${formatDay(cycle.fulfillmentDate)}.`;
}

export const PREORDER_CLOSED_MESSAGE =
  "Les précommandes sont terminées. Alima prépare maintenant la fournée. Des douceurs supplémentaires pourront être proposées après les livraisons, uniquement s’il en reste.";
export const SURPLUS_MESSAGE =
  "Vous avez raté la précommande ? Quelques douceurs de la fournée sont encore disponibles. Commande possible dans la limite du stock réellement restant.";
export const DONE_MESSAGE = "Cette fournée est terminée. Consultez Nos fournées pour découvrir la prochaine ouverture.";
/** Aucune alerte de surplus n'existe : on n'en simule pas. */
export const COME_BACK_MESSAGE = "Revenez après la fournée pour vérifier les disponibilités.";

/** Message public de la phase (null si la phase n'en appelle pas). */
export function phaseMessage(phase: CyclePhase, cycle: Pick<CycleSummary, "closesAt" | "fulfillmentDate">): string | null {
  switch (phase) {
    case "open":
      return preorderMessage(cycle);
    case "closed":
    case "preparing":
    case "delivering":
      return PREORDER_CLOSED_MESSAGE;
    case "surplus":
      return SURPLUS_MESSAGE;
    case "done":
      return DONE_MESSAGE;
    default:
      return null;
  }
}

/** Ligne courte pour la carte, Ma boîte et le bon de commande (la boîte est toujours conservée). */
export function cycleStatusLine(cycle: CycleSummary, now = Date.now()): string {
  const phase = cyclePhase(cycle, now, cycle.surplusExhausted);
  switch (phase) {
    case "open":
      return `Précommandes de la fournée n°${cycle.number} jusqu’au ${formatDay(cycle.closesAt)} à ${formatTime(cycle.closesAt)}.`;
    case "surplus":
      return `Surplus de la fournée n°${cycle.number} : commande possible dans la limite du stock réellement restant.`;
    case "scheduled":
      return `Fournée n°${cycle.number} annoncée : les précommandes ne sont pas encore ouvertes. Votre boîte est conservée.`;
    case "closed":
    case "preparing":
    case "delivering":
      return `${PREORDER_CLOSED_MESSAGE} Votre boîte est conservée.`;
    case "cancelled":
      return "Cette fournée a été annulée. Votre boîte est conservée pour la prochaine.";
    default:
      return DONE_MESSAGE;
  }
}

/** Bouton d'action adapté à la phase. */
export function phaseAction(phase: CyclePhase, cycleNumber: number): { label: string; href: string } | null {
  switch (phase) {
    case "open":
      return { label: "Composer ma boîte", href: "/carte" };
    case "preparing":
    case "delivering":
      return { label: "Voir l’avancement", href: `/fournees/${cycleNumber}#frise` };
    case "surplus":
      return { label: "Voir les douceurs disponibles", href: `/fournees/${cycleNumber}#au-programme` };
    case "done":
    case "cancelled":
      return { label: "Découvrir les prochaines fournées", href: "/fournees#prochaine" };
    default:
      return null;
  }
}

export type StepState = "done" | "current" | "upcoming" | "cancelled";

export interface FriseStep {
  key: "preorder" | "production" | "fulfillment" | "surplus";
  title: string;
  detail: string;
  state: StepState;
}

const RANK: Record<CyclePhase, number> = {
  scheduled: -1,
  open: 0,
  closed: 1,
  preparing: 1,
  delivering: 2,
  surplus: 3,
  done: 4,
  cancelled: -1,
};

/** La frise en quatre moments de la fournée, chacun marqué passé, en cours ou à venir. */
export function friseSteps(cycle: CycleSummary, phase: CyclePhase): FriseStep[] {
  const rank = RANK[phase];
  const state = (step: number): StepState => {
    if (phase === "cancelled") return "cancelled";
    if (rank > step) return "done";
    return rank === step ? "current" : "upcoming";
  };
  return [
    {
      key: "preorder",
      title: `Commandez avant ${formatDay(cycle.closesAt).split(" ")[0]}`,
      detail: `Jusqu’au ${formatDay(cycle.closesAt)}, ${formatTime(cycle.closesAt)}.`,
      state: state(0),
    },
    { key: "production", title: "Alima prépare votre fournée", detail: productionLabel(cycle), state: state(1) },
    {
      key: "fulfillment",
      title: `Livraison ou retrait ${formatDay(cycle.fulfillmentDate).split(" ")[0]}`,
      detail: `Le ${formatDay(cycle.fulfillmentDate)}, pour les commandes confirmées.`,
      state: state(2),
    },
    {
      key: "surplus",
      title: "Les douceurs restantes peuvent revenir en stock",
      detail:
        phase === "surplus"
          ? "Le surplus est en vente, dans la limite du stock réellement restant."
          : "Seulement s’il en reste après les commandes confirmées, publié par Alima.",
      state: state(3),
    },
  ];
}
