import Link from "next/link";
import { AtelierIcon } from "@/components/admin/AtelierIcons";
import { Countdown } from "@/components/admin/Countdown";
import type { AdminCycle } from "@/lib/admin/data";
import type { AdminTask, NextStep, TaskPriority } from "@/lib/admin/tasks";
import type { TodaySummary } from "@/lib/admin/today";
import { cn } from "@/lib/cn";
import { cyclePhase } from "@/lib/cycle-status";
import { formatDay, formatTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";

const priorityStyle: Record<TaskPriority, { label: string; dot: string; border: string }> = {
  urgent: { label: "Urgent", dot: "bg-erreur", border: "border-l-erreur" },
  today: { label: "Aujourd'hui", dot: "bg-caramel", border: "border-l-caramel" },
  soon: { label: "Bientôt", dot: "bg-rose-vif", border: "border-l-rose-vif" },
  info: { label: "À l'occasion", dot: "bg-encre-douce/50", border: "border-l-encre-douce/40" },
};

/** Phrase d'accueil de la fournée active, à l'heure de Dakar. */
export function cycleSentence(cycle: AdminCycle | null, now: number): { text: string; target: string | null; targetLabel: string | null } {
  if (!cycle) return { text: "Aucune fournée n'est en préparation pour le moment.", target: null, targetLabel: null };
  const n = `la fournée n°${cycle.number}`;
  const phase = cyclePhase(cycle, now);
  const delivery = formatDay(cycle.fulfillmentDate);
  switch (phase) {
    case "scheduled":
      return cycle.status === "draft"
        ? { text: `${n.charAt(0).toUpperCase()}${n.slice(1)} est en brouillon : elle n'est pas encore visible des clientes.`, target: null, targetLabel: null }
        : { text: `Les précommandes de ${n} ouvriront le ${formatDay(cycle.opensAt)} à ${formatTime(cycle.opensAt)}.`, target: cycle.opensAt, targetLabel: "Ouverture" };
    case "open":
      return { text: `Les précommandes de ${n} sont ouvertes jusqu'au ${formatDay(cycle.closesAt)} à ${formatTime(cycle.closesAt)}.`, target: cycle.closesAt, targetLabel: "Clôture" };
    case "closed":
      return { text: `Les précommandes de ${n} sont terminées. Livraison et retrait le ${delivery}.`, target: `${cycle.fulfillmentDate}T00:00:00Z`, targetLabel: "Jour de livraison" };
    case "preparing":
      return { text: `${n.charAt(0).toUpperCase()}${n.slice(1)} est en production. Livraison et retrait le ${delivery}.`, target: `${cycle.fulfillmentDate}T00:00:00Z`, targetLabel: "Jour de livraison" };
    case "delivering":
      return { text: `Livraisons et retraits de ${n} en cours.`, target: null, targetLabel: null };
    case "surplus":
      return cycle.surplusEndsAt
        ? { text: `Le surplus de ${n} est en vente jusqu'au ${formatDay(cycle.surplusEndsAt)} à ${formatTime(cycle.surplusEndsAt)}.`, target: cycle.surplusEndsAt, targetLabel: "Fin du surplus" }
        : { text: `Le surplus de ${n} est en vente.`, target: null, targetLabel: null };
    default:
      return { text: `${n.charAt(0).toUpperCase()}${n.slice(1)} est terminée.`, target: null, targetLabel: null };
  }
}

export function TodayHeader({ firstName, cycle, now }: { firstName: string | null; cycle: AdminCycle | null; now: number }) {
  const sentence = cycleSentence(cycle, now);
  const today = new Intl.DateTimeFormat("fr-SN", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Dakar" }).format(now);
  return (
    <header className="atelier-carnet relative overflow-hidden rounded-[14px] border-2 border-chocolat/15 py-5 pl-10 pr-5 sm:pl-12">
      <p className="atelier-annotation text-[1.15rem]">{today}</p>
      <h1 className="font-display text-[clamp(1.9rem,5vw,2.8rem)] leading-tight">{firstName ? `Bonjour ${firstName}.` : "Bonjour."}</h1>
      <p className="mt-2 max-w-3xl text-[1.12rem]">{sentence.text}</p>
      {sentence.target && sentence.targetLabel && (
        <p className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-full bg-chocolat px-4 py-1.5 font-bold text-creme">
          {sentence.targetLabel} <Countdown target={sentence.target} serverNow={now} />
        </p>
      )}
    </header>
  );
}

export function TaskTicket({ task }: { task: AdminTask }) {
  const style = priorityStyle[task.priority];
  return (
    <li className={cn("atelier-ticket atelier-deploie flex flex-col gap-3 border-l-[6px] p-4 sm:flex-row sm:items-center", style.border)}>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[0.82rem] font-bold uppercase tracking-[0.1em] text-encre-douce">
          <span aria-hidden className={cn("size-2.5 rounded-full", style.dot)} />
          {style.label}
        </p>
        <p className="mt-1 text-[1.1rem] font-bold">{task.title}</p>
        {task.detail && <p className="text-encre-douce">{task.detail}</p>}
      </div>
      <Link
        href={task.href}
        className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-[10px] bg-chocolat px-5 font-bold text-creme shadow-[0_3px_0_var(--ohm-cacao)] hover:bg-cacao"
      >
        {task.action}
      </Link>
    </li>
  );
}

export function TaskList({ tasks, emptyText }: { tasks: AdminTask[]; emptyText: string }) {
  if (tasks.length === 0) {
    return (
      <p className="atelier-ticket flex items-center gap-3 p-5 text-[1.05rem]">
        <span className="ohm-tampon text-succes">Tout est à jour</span>
        <span>{emptyText}</span>
      </p>
    );
  }
  return <ol className="flex flex-col gap-4">{tasks.map((t) => <TaskTicket key={t.key} task={t} />)}</ol>;
}

/** Résumé du jour : seules les valeurs non nulles sont affichées. */
export function DaySummary({ summary }: { summary: TodaySummary }) {
  const items = [
    { value: summary.newOrders, label: summary.newOrders > 1 ? "nouvelles commandes" : "nouvelle commande", href: "/admin/commandes?jour=aujourdhui" },
    { value: summary.waveToVerify, label: summary.waveToVerify > 1 ? "paiements à vérifier" : "paiement à vérifier", href: "/admin/paiements" },
    { value: summary.confirmedFcfa, label: "confirmés aujourd'hui (produits)", href: "/admin/paiements?vue=verifies", money: true },
    { value: summary.toPrepare, label: summary.toPrepare > 1 ? "commandes à préparer" : "commande à préparer", href: "/admin/commandes?vue=simple#a-preparer" },
    { value: summary.pickupsToday, label: summary.pickupsToday > 1 ? "retraits aujourd'hui" : "retrait aujourd'hui", href: "/admin/commandes?vue=simple#prete" },
    { value: summary.deliveriesToday, label: summary.deliveriesToday > 1 ? "livraisons aujourd'hui" : "livraison aujourd'hui", href: "/admin/livraisons" },
  ].filter((i) => i.value > 0);
  if (items.length === 0) {
    return <p className="text-encre-douce">Rien de nouveau aujourd&apos;hui pour l&apos;instant. Les nouvelles commandes apparaîtront ici dès qu&apos;une cliente validera sa boîte.</p>;
  }
  return (
    <ul className="flex flex-wrap gap-3">
      {items.map((i) => (
        <li key={i.label}>
          <Link href={i.href} className="atelier-etiquette flex min-h-12 items-baseline gap-2 bg-rose/50 py-2 pl-4 pr-6 hover:bg-rose">
            <span className="font-display text-[1.6rem] leading-none tabular-nums">{i.money ? formatFcfa(i.value) : i.value}</span>
            <span className="font-bold">{i.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function NextStepCard({ step }: { step: NextStep }) {
  return (
    <section aria-labelledby="prochaine-etape" className="ohm-cacao relative overflow-hidden rounded-[16px] p-6 sm:p-8">
      <span aria-hidden className="ohm-cercle absolute -right-10 -top-10 size-40 opacity-30" />
      <p className="atelier-annotation text-[1.2rem] text-rose">Prochaine étape</p>
      <h2 id="prochaine-etape" className="relative mt-1 font-display text-[clamp(1.6rem,4vw,2.2rem)] leading-tight">
        {step.title}
      </h2>
      <p className="relative mt-2 max-w-2xl text-creme/85">{step.why}</p>
      <Link
        href={step.href}
        className="relative mt-5 inline-flex min-h-12 items-center gap-2 rounded-[10px] bg-rose px-6 font-bold text-cacao shadow-[0_3px_0_var(--ohm-rose-encre)] hover:brightness-95"
      >
        {step.action}
        <AtelierIcon name="liste" className="size-4" />
      </Link>
    </section>
  );
}
