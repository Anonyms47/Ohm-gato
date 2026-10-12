/**
 * « Aujourd'hui chez OHMEGATO » : tâches et prochaine étape, calculées à partir des données réelles.
 * Module pur (aucun accès base) : testable et partagé entre la page et les automatisations.
 */
import { cyclePhase, type CyclePhase } from "@/lib/cycle-status";

export type TaskPriority = "urgent" | "today" | "soon" | "info";

export interface AdminTask {
  /** Clé stable : sert d'identifiant de notification et de clé React. */
  key: string;
  priority: TaskPriority;
  /** Phrase humaine, déjà accordée. */
  title: string;
  detail?: string;
  count: number;
  href: string;
  action: string;
}

export interface TaskInput {
  now: number;
  cycle: {
    id: string;
    number: number;
    status: string;
    opensAt: string;
    closesAt: string;
    fulfillmentDate: string;
    surplusEndsAt: string | null;
    productionRecorded: boolean;
  } | null;
  needsAttention: number;
  waveToVerify: { count: number; oldestAt: string | null };
  /** Délai au-delà duquel un paiement Wave en attente est signalé (heures, réglable). */
  paymentAlertHours: number;
  toPrepare: number;
  ready: { pickup: number; delivery: number };
  incompleteAddresses: number;
  customToAnswer: number;
  allergensToVerify: number;
  identityMissing: boolean;
}

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

const ORDER: Record<TaskPriority, number> = { urgent: 0, today: 1, soon: 2, info: 3 };

export function hoursSince(iso: string | null, now: number): number {
  return iso ? Math.max(0, (now - Date.parse(iso)) / 3_600_000) : 0;
}

/** Tâches réellement nécessaires, de la plus urgente à la moins urgente. Aucune tâche vide. */
export function buildTasks(input: TaskInput): AdminTask[] {
  const tasks: AdminTask[] = [];
  const { cycle } = input;
  const phase: CyclePhase | null = cycle ? cyclePhase(cycle, input.now) : null;

  if (input.needsAttention > 0) {
    const n = input.needsAttention;
    tasks.push({
      key: "needs-attention",
      priority: "urgent",
      title: `${n} ${plural(n, "commande payée demande", "commandes payées demandent")} une décision`,
      detail: "Paiement reçu mais montant ou quantités à arbitrer.",
      count: n,
      href: "/admin/commandes?statut=needs_attention",
      action: "Arbitrer",
    });
  }

  if (input.waveToVerify.count > 0) {
    const n = input.waveToVerify.count;
    const waited = hoursSince(input.waveToVerify.oldestAt, input.now);
    const late = waited >= input.paymentAlertHours;
    tasks.push({
      key: "wave-to-verify",
      priority: late ? "urgent" : "today",
      title: `${n} ${plural(n, "paiement Wave attend", "paiements Wave attendent")} votre vérification`,
      detail: late ? `Le plus ancien attend depuis ${Math.floor(waited)} h.` : "Vérifiez la réception dans l'application Wave.",
      count: n,
      href: "/admin/paiements",
      action: "Vérifier",
    });
  }

  if (cycle && cycle.status === "open" && phase === "closed") {
    tasks.push({
      key: `cycle-${cycle.id}-close`,
      priority: "today",
      title: `Les précommandes de la fournée n°${cycle.number} sont terminées`,
      detail: "Les nouvelles commandes sont déjà refusées. Clôturez puis imprimez la fiche de production.",
      count: 1,
      href: `/admin/fournees/${cycle.id}`,
      action: "Clôturer et imprimer",
    });
  }

  if (cycle && ["preparing", "delivering"].includes(cycle.status) && !cycle.productionRecorded) {
    tasks.push({
      key: `cycle-${cycle.id}-production`,
      priority: "soon",
      title: "La production réelle n'a pas encore été renseignée",
      detail: "Elle permet de calculer le surplus et le bilan.",
      count: 1,
      href: `/admin/fournees/${cycle.id}#production`,
      action: "Saisir",
    });
  }

  if (input.toPrepare > 0) {
    const n = input.toPrepare;
    tasks.push({
      key: "to-prepare",
      priority: "today",
      title: `${n} ${plural(n, "commande payée doit", "commandes payées doivent")} être ${plural(n, "préparée", "préparées")}`,
      count: n,
      href: "/admin/commandes?vue=simple#a-preparer",
      action: "Préparer",
    });
  }

  const readyTotal = input.ready.pickup + input.ready.delivery;
  if (readyTotal > 0) {
    const parts = [
      input.ready.pickup ? `${input.ready.pickup} ${plural(input.ready.pickup, "retrait", "retraits")}` : null,
      input.ready.delivery ? `${input.ready.delivery} ${plural(input.ready.delivery, "livraison", "livraisons")}` : null,
    ].filter(Boolean);
    tasks.push({
      key: "ready",
      priority: "today",
      title: `${readyTotal} ${plural(readyTotal, "commande prête attend", "commandes prêtes attendent")} d'être ${plural(readyTotal, "remise", "remises")}`,
      detail: parts.join(" · "),
      count: readyTotal,
      href: input.ready.delivery ? "/admin/livraisons" : "/admin/commandes?vue=simple#prete",
      action: input.ready.delivery ? "Organiser" : "Remettre",
    });
  }

  if (input.incompleteAddresses > 0) {
    const n = input.incompleteAddresses;
    tasks.push({
      key: "incomplete-addresses",
      priority: "soon",
      title: n > 1 ? `${n} livraisons n'ont pas de point de repère ni de position` : "Une cliente n'a pas précisé son point de repère",
      detail: "Appelez ou écrivez avant le départ du livreur.",
      count: n,
      href: "/admin/livraisons",
      action: "Compléter",
    });
  }

  if (input.customToAnswer > 0) {
    const n = input.customToAnswer;
    tasks.push({
      key: "custom-to-answer",
      priority: "soon",
      title: `${n} ${plural(n, "demande sur mesure attend", "demandes sur mesure attendent")} votre réponse`,
      count: n,
      href: "/admin/sur-mesure",
      action: "Répondre",
    });
  }

  if (input.allergensToVerify > 0) {
    const n = input.allergensToVerify;
    tasks.push({
      key: "allergens",
      priority: "info",
      title: `${n} ${plural(n, "information allergène reste", "informations allergènes restent")} à vérifier`,
      detail: "Ces mentions ne sont jamais affichées aux clients tant qu'elles ne sont pas confirmées.",
      count: n,
      href: "/admin/produits?verification=packaging_check_needed",
      action: "Vérifier",
    });
  }

  if (input.identityMissing) {
    tasks.push({
      key: "identity",
      priority: "info",
      title: "L'identité légale d'OHMEGATO est incomplète",
      count: 1,
      href: "/admin/documents",
      action: "Compléter",
    });
  }

  return tasks.sort((a, b) => ORDER[a.priority] - ORDER[b.priority]);
}

export interface NextStep {
  title: string;
  why: string;
  href: string;
  action: string;
}

/** Prochaine action logique de la fournée : une seule à la fois. */
export function nextCycleStep(cycle: TaskInput["cycle"], waveToVerify: number, now: number): NextStep {
  if (!cycle) {
    return { title: "Créer la prochaine fournée", why: "Aucune fournée n'est en préparation ni ouverte.", href: "/admin/fournees/nouvelle", action: "Créer une fournée" };
  }
  const base = `/admin/fournees/${cycle.id}`;
  const phase = cyclePhase(cycle, now);
  switch (cycle.status) {
    case "draft":
    case "scheduled":
      return { title: "Ouvrir les précommandes", why: "Vérifiez les produits, les créneaux et les dates, puis ouvrez.", href: base, action: "Préparer l'ouverture" };
    case "open":
      if (phase === "scheduled") return { title: "Ouverture programmée", why: "Les clientes pourront commander à l'heure d'ouverture.", href: base, action: "Voir la fournée" };
      if (phase === "closed") return { title: "Clôturer administrativement", why: "La date limite est passée : figez les quantités et imprimez la production.", href: base, action: "Clôturer" };
      if (waveToVerify > 0) return { title: "Vérifier les paiements", why: "Une commande compte dans la production seulement une fois payée.", href: "/admin/paiements", action: "Vérifier les paiements" };
      return { title: "Suivre les précommandes", why: "Les commandes arrivent : rien à faire tant qu'aucun paiement n'attend.", href: base, action: "Voir la fournée" };
    case "closed":
      return { title: "Imprimer la fiche de production", why: "Les quantités payées sont figées : lancez la préparation.", href: `${base}/production`, action: "Imprimer la fiche" };
    case "preparing":
      return cycle.productionRecorded
        ? { title: "Organiser les livraisons", why: "Marquez les commandes prêtes et préparez les tournées.", href: "/admin/livraisons", action: "Voir les livraisons" }
        : { title: "Commencer la préparation", why: "Suivez la fiche de production, puis saisissez la production réelle.", href: `${base}#production`, action: "Ouvrir la production" };
    case "delivering":
      return cycle.productionRecorded
        ? { title: "Publier le surplus ou terminer", why: "Une fois les commandes remises, proposez ce qui reste ou terminez la fournée.", href: `${base}#surplus`, action: "Voir le surplus" }
        : { title: "Saisir la production réelle", why: "Elle sert au calcul du surplus et au bilan.", href: `${base}#production`, action: "Saisir la production" };
    case "surplus":
      return phase === "done"
        ? { title: "Terminer la fournée", why: "La vente du surplus est finie : terminez pour obtenir le bilan.", href: base, action: "Terminer" }
        : { title: "Surplus en vente", why: "Les clientes peuvent commander ce qui reste jusqu'à la fin annoncée.", href: base, action: "Voir la fournée" };
    default:
      return { title: "Créer la prochaine fournée", why: "La fournée précédente est terminée.", href: "/admin/fournees/nouvelle", action: "Créer une fournée" };
  }
}

/** Durée humaine : « 2 j 5 h », « 3 h 12 min », « 8 min ». */
export function humanDuration(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days} j ${hours} h`;
  if (hours > 0) return `${hours} h ${String(mins).padStart(2, "0")} min`;
  return `${mins} min`;
}
