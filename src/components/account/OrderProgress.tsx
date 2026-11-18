import { cn } from "@/lib/cn";
import { reachedStepIndex, roadSteps, type Fulfillment, type OrderStatus } from "@/lib/order-status";

/**
 * Avancement réel d'une commande, du « Confirmée » jusqu'à la remise.
 * Téléphone : liste verticale ; à partir de la tablette : frise horizontale. Aucune étape n'est inventée.
 */
export function OrderProgress({ status, fulfillment }: { status: OrderStatus; fulfillment: Fulfillment }) {
  const steps = roadSteps(fulfillment);
  const reached = reachedStepIndex(status, fulfillment);
  if (reached < 0) return null;
  return (
    <ol aria-label="Avancement de la commande" className="grid gap-0 sm:grid-flow-col sm:auto-cols-fr">
      {steps.map((step, index) => {
        const state = index < reached ? "done" : index === reached ? "current" : "upcoming";
        return (
          <li
            key={step.key}
            aria-current={state === "current" ? "step" : undefined}
            className="relative flex items-center gap-3 pb-4 last:pb-0 sm:flex-col sm:items-start sm:gap-2 sm:pb-0 sm:pr-2"
          >
            {index < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[0.8rem] top-8 h-[calc(100%-1.5rem)] w-0.5 sm:left-8 sm:top-[0.8rem] sm:h-0.5 sm:w-[calc(100%-2rem)]",
                  index < reached ? "bg-chocolat" : "bg-chocolat/20",
                )}
              />
            )}
            <span
              aria-hidden
              className={cn(
                "relative z-10 grid size-[1.65rem] shrink-0 place-items-center rounded-full border-2 text-[0.8rem] font-bold",
                state === "done" && "border-chocolat bg-chocolat text-creme",
                state === "current" && "border-chocolat bg-caramel text-chocolat shadow-[0_0_0_4px_color-mix(in_srgb,var(--ohm-caramel)_35%,transparent)]",
                state === "upcoming" && "border-chocolat/25 bg-blanc-casse text-transparent",
              )}
            >
              {state === "done" ? "✓" : index + 1}
            </span>
            <span className={cn("text-[0.95rem] leading-tight", state === "current" ? "font-bold" : state === "upcoming" ? "text-encre-douce" : "")}>
              {step.label}
              <span className="sr-only">{state === "done" ? " (terminée)" : state === "current" ? " (en cours)" : " (à venir)"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
