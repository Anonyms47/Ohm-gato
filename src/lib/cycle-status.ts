/** Fournées : statut affiché et frise, calculés depuis la base (aucune urgence inventée). */
import type { CycleSummary } from "@/lib/catalog-types";
import { formatDay, parseDate } from "@/lib/dates";

/**
 * Phases de la fournée (noms de la base) :
 * scheduled annoncée · open précommandes ouvertes · closed précommandes clôturées ·
 * preparing production en cours · delivering livraisons et retraits · surplus surplus disponible ·
 * done terminée · cancelled annulée.
 */
export type CyclePhase = "scheduled" | "open" | "closed" | "preparing" | "delivering" | "surplus" | "done" | "cancelled";

type PhaseInput = Pick<CycleSummary, "status"> & { surplusEndsAt?: string | null; fulfillmentDate?: string };

/**
 * Commandes permanentes : une fournée « open » (désignée par Alima) reste ouverte à toute heure, aucune date limite
 * ne la ferme. Un surplus dont la date de fin est passée (ou épuisé) est terminé. Le serveur applique la même règle.
 */
export function cyclePhase(cycle: PhaseInput, now = Date.now(), surplusExhausted = false): CyclePhase {
  switch (cycle.status) {
    case "open":
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

/** Jour courant à Dakar (AAAA-MM-JJ) : Dakar est en UTC, sans heure d'été. */
export function dakarToday(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** La fournée a une date de remise à venir (aujourd'hui compris) : condition pour finaliser et payer une commande. */
export function hasUpcomingFulfillment(cycle: { fulfillmentDate?: string }, now = Date.now()): boolean {
  return Boolean(cycle.fulfillmentDate) && cycle.fulfillmentDate! >= dakarToday(now);
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
  open: "Commandes ouvertes",
  closed: "Commandes passées à la fournée suivante",
  preparing: "Production en cours",
  delivering: "Livraison et retrait",
  surplus: "Surplus disponible",
  done: "Terminée",
  cancelled: "Annulée",
};

/** Libellé court de la phase : une fournée ouverte sans date de remise à venir affiche « Dates à annoncer ». */
export function phaseBadgeLabel(cycle: { fulfillmentDate?: string }, phase: CyclePhase, now = Date.now()): string {
  return phase === "open" && !hasUpcomingFulfillment(cycle, now) ? "Dates à annoncer" : cyclePhaseLabel[phase];
}

/** Type de commande accepté par une fournée à un instant donné (même règle que le serveur). */
export function orderKindFor(cycle: PhaseInput, now = Date.now()): "preorder" | "surplus" | null {
  const phase = cyclePhase(cycle, now);
  if (phase === "open") return hasUpcomingFulfillment(cycle, now) ? "preorder" : null;
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

type PreorderInput = Pick<CycleSummary, "fulfillmentDate"> & Partial<Pick<CycleSummary, "productionDates">>;

/** Message officiel de la phase de précommande (jour de préparation seulement s'il est saisi). */
export function preorderMessage(cycle: PreorderInput): string {
  const dates = [...(cycle.productionDates ?? [])].sort().map((d) => formatDay(d));
  const prepared = dates.length === 0 ? "pendant la semaine" : `le ${dates.length === 1 ? dates[0] : `${dates.slice(0, -1).join(", ")} et ${dates.at(-1)}`}`;
  return `Vous pouvez commander à tout moment. Votre commande sera préparée ${prepared} et livrée ou retirée le ${formatDay(cycle.fulfillmentDate)}.`;
}

/** Fournée plus désignée pour les nouvelles commandes : l'atelier la prépare, les nouvelles commandes iront à la suivante. */
export const BATCH_IN_PROGRESS_MESSAGE =
  "L’atelier prépare cette fournée. Vous pouvez commander quand même : OHMEGATO vous communique la date de livraison ou de retrait de votre commande. Des douceurs supplémentaires pourront être proposées après les livraisons, uniquement s’il en reste.";
/** Aucune date de remise à venir : on commande quand même, OHMEGATO communique la date ensuite. */
export const NO_CALENDAR_MESSAGE =
  "Aucune date de fournée à venir n’est annoncée. Vous pouvez commander quand même : OHMEGATO vous communique la date de livraison ou de retrait de votre commande.";
export const SURPLUS_MESSAGE =
  "Vous avez raté la précommande ? Quelques douceurs de la fournée sont encore disponibles. Commande possible dans la limite du stock réellement restant.";
export const DONE_MESSAGE = "Cette fournée est terminée. Vous pouvez commander quand même : OHMEGATO vous communique la date de livraison ou de retrait. Consultez Nos fournées pour découvrir la prochaine ouverture.";
/** Aucune alerte de surplus n'existe : on n'en simule pas. */
export const COME_BACK_MESSAGE = "Revenez après la fournée pour vérifier les disponibilités.";

/** Message public de la phase (null si la phase n'en appelle pas). */
export function phaseMessage(phase: CyclePhase, cycle: PreorderInput): string | null {
  switch (phase) {
    case "open":
      return hasUpcomingFulfillment(cycle) ? preorderMessage(cycle) : NO_CALENDAR_MESSAGE;
    case "closed":
    case "preparing":
    case "delivering":
      return BATCH_IN_PROGRESS_MESSAGE;
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
      return hasUpcomingFulfillment(cycle, now)
        ? `Fournée n°${cycle.number} : commande possible à tout moment, livraison ou retrait le ${formatDay(cycle.fulfillmentDate)}.`
        : `${NO_CALENDAR_MESSAGE}`;
    case "surplus":
      return `Surplus de la fournée n°${cycle.number} : commande possible dans la limite du stock réellement restant.`;
    case "scheduled":
      return `Fournée n°${cycle.number} annoncée : pas encore ouverte. Vous pouvez déjà commander : OHMEGATO vous communique la date de livraison ou de retrait.`;
    case "closed":
    case "preparing":
    case "delivering":
      return BATCH_IN_PROGRESS_MESSAGE;
    case "cancelled":
      return "Cette fournée a été annulée. Vous pouvez commander quand même : OHMEGATO vous communique la date de livraison ou de retrait.";
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
      title: "Vous commandez à tout moment",
      detail: "Vos commandes sont rattachées à la fournée désignée par l’atelier, avec ses dates réelles.",
      state: state(0),
    },
    { key: "production", title: "L’atelier prépare votre fournée", detail: productionLabel(cycle), state: state(1) },
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
          : "Seulement s’il en reste après les commandes confirmées, publié par l’atelier.",
      state: state(3),
    },
  ];
}
