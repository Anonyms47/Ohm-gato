import type { Metadata } from "next";
import Link from "next/link";
import { OnboardingGuide } from "@/components/admin/OnboardingGuide";
import { DaySummary, NextStepCard, TaskList, TodayHeader } from "@/components/admin/TodayParts";
import { humanDuration } from "@/lib/admin/tasks";
import { loadToday, methodsLabel } from "@/lib/admin/today";
import { requireAdmin } from "@/lib/auth/session";
import { cyclePhase, cyclePhaseLabel } from "@/lib/cycle-status";
import { formatDay } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";

export const metadata: Metadata = { title: "Aujourd'hui" };

const VISIBLE_TASKS = 6;

/** « Aujourd'hui chez OHMEGATO » : ce qu'il faut faire maintenant, avant tout chiffre. */
export default async function AdminToday() {
  const user = await requireAdmin();
  const d = await loadToday();
  // Nom affiché seulement s'il s'agit d'un vrai prénom (jamais un numéro ou une adresse e-mail).
  const candidate = user.displayName.split(/\s+/)[0] ?? "";
  const firstName = /\p{L}/u.test(candidate) && !candidate.includes("@") ? candidate : null;
  const phase = d.cycle ? cyclePhase(d.cycle, d.now) : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <TodayHeader firstName={firstName} cycle={d.cycle} now={d.now} />
      <OnboardingGuide />

      {/* Une seule colonne, dans l'ordre du travail : la prochaine étape, ce qui attend, puis le reste. */}
      <NextStepCard step={d.next} />

      <section aria-labelledby="a-faire" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="a-faire" className="font-display text-[1.7rem]">
            À faire maintenant
          </h2>
          {d.tasks.length > VISIBLE_TASKS && (
            <Link href="/admin/actions" className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
              Voir les {d.tasks.length} actions
            </Link>
          )}
        </div>
        <TaskList tasks={d.tasks.slice(0, VISIBLE_TASKS)} emptyText="Aucune action n'attend : profitez-en pour préparer la prochaine fournée." />
      </section>

      {d.wave.length > 0 && (
        <section aria-labelledby="wave" className="flex flex-col gap-3">
          <h2 id="wave" className="font-display text-[1.5rem]">
            Paiements {methodsLabel(d.wave)} à vérifier ({d.wave.length})
          </h2>
          <ul className="flex flex-col divide-y-2 divide-dashed divide-chocolat/15 rounded-[12px] border-2 border-chocolat/15 bg-blanc-casse">
            {d.wave.slice(0, 5).map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <Link href={`/admin/commandes/${o.id}`} className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
                  {o.reference}
                </Link>
                <span>{o.customerName}</span>
                <span className="font-bold tabular-nums">{formatFcfa(o.totalFcfa)}</span>
                <span className="text-encre-douce">en attente depuis {humanDuration(d.now - Date.parse(o.createdAt))}</span>
              </li>
            ))}
          </ul>
          <Link href="/admin/paiements" className="self-start font-bold underline decoration-caramel decoration-2 underline-offset-4">
            Ouvrir la file des paiements
          </Link>
        </section>
      )}

      <section aria-labelledby="fournee" className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[12px] border-2 border-chocolat/15 bg-blanc-casse p-4">
        <h2 id="fournee" className="font-bold">
          Fournée active
        </h2>
        {d.cycle && phase ? (
          <>
            <Link href={`/admin/fournees/${d.cycle.id}`} className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
              n°{d.cycle.number} — {d.cycle.title}
            </Link>
            <span className="rounded-full bg-rose/60 px-3 py-0.5 font-bold">{cyclePhaseLabel[phase]}</span>
            <span className="text-encre-douce">Livraison et retrait : {formatDay(d.cycle.fulfillmentDate)}</span>
          </>
        ) : (
          <p>
            Aucune fournée en cours.{" "}
            <Link href="/admin/fournees/nouvelle" className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
              Créer une fournée
            </Link>
          </p>
        )}
      </section>

      <details className="group rounded-[12px] border-2 border-chocolat/15 bg-blanc-casse p-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-display text-[1.3rem] after:content-['+'] group-open:after:content-['−']">
          Résumé du jour
        </summary>
        <div className="mt-3">
          <DaySummary summary={d.summary} />
        </div>
      </details>
    </div>
  );
}
