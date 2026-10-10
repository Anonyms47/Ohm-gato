import { Annotation } from "@/components/brand/BrandHeading";
import type { CycleSummary } from "@/lib/catalog-types";
import { cn } from "@/lib/cn";
import { friseSteps, type CyclePhase, type StepState } from "@/lib/cycle-status";

const mark: Record<StepState, string> = {
  done: "bg-chocolat text-creme border-chocolat",
  current: "bg-rose text-cacao border-chocolat shadow-[0_3px_0_var(--ohm-chocolat)]",
  upcoming: "bg-blanc-casse text-encre-douce border-chocolat/40",
  cancelled: "bg-blanc-casse text-encre-douce border-chocolat/30 line-through",
};
const card: Record<StepState, string> = {
  done: "border-chocolat/25 bg-blanc-casse",
  current: "border-chocolat bg-blanc-casse shadow-[0_4px_0_var(--ohm-chocolat)]",
  upcoming: "border-dashed border-chocolat/35 bg-creme",
  cancelled: "border-dashed border-chocolat/25 bg-creme opacity-80",
};
const word: Record<StepState, string> = { done: "étape passée", current: "étape en cours", upcoming: "étape à venir", cancelled: "étape annulée" };

/**
 * La fournée en quatre moments. Horizontale sur grand écran, verticale sur téléphone ;
 * entrée douce de chaque carte (désactivée si l'utilisateur limite les animations).
 */
export function FourneeFrise({ cycle, phase }: { cycle: CycleSummary; phase: CyclePhase }) {
  const steps = friseSteps(cycle, phase);
  return (
    <ol id="frise" aria-label="Les quatre moments de la fournée" className="relative mt-8 grid gap-5 md:grid-cols-4 md:gap-4">
      {/* Fil de la frise : vertical sur téléphone, horizontal ensuite. */}
      <span aria-hidden className="absolute bottom-6 left-5 top-6 border-l-2 border-dashed border-chocolat/35 md:hidden" />
      <span aria-hidden className="absolute left-8 right-8 top-5 hidden border-t-2 border-dashed border-chocolat/35 md:block" />
      {steps.map((step, index) => (
        <li
          key={step.key}
          className="relative flex gap-4 motion-safe:animate-[ohm-entree_520ms_var(--ohm-courbe)_both] md:flex-col md:gap-3"
          style={{ animationDelay: `${index * 90}ms` }}
          aria-current={step.state === "current" ? "step" : undefined}
        >
          <span
            aria-hidden
            className={cn("relative z-[1] grid size-10 shrink-0 place-items-center rounded-full border-2 font-display text-[1.15rem]", mark[step.state])}
          >
            {index + 1}
          </span>
          <div className={cn("min-w-0 flex-1 rounded-[14px] border-2 p-4", card[step.state])}>
            <p className="font-display text-[1.3rem] leading-tight">
              {step.title}
              <span className="sr-only"> ({word[step.state]})</span>
            </p>
            <p className="mt-1.5 text-encre-douce">{step.detail}</p>
            {step.state === "current" && <Annotation className="mt-1 block text-[1.15rem]">nous en sommes là</Annotation>}
          </div>
        </li>
      ))}
    </ol>
  );
}
