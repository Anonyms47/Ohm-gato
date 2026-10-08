import { availabilityLabel, type AvailabilityState } from "@/lib/availability";
import { cn } from "@/lib/cn";

const styles: Record<AvailabilityState, string> = {
  available: "border-succes text-succes",
  low: "border-orange-encre text-orange-encre",
  sold_out: "border-erreur text-erreur",
  out_of_cycle: "border-encre-douce text-encre-douce",
  closed: "border-encre-douce text-encre-douce",
};

/** État réel issu du stock — jamais de faux « bestseller » ni de faux compteur. */
export function AvailabilityBadge({ state, className }: { state: AvailabilityState; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full border-2 bg-blanc-casse/80 px-2.5 text-[0.85rem] font-bold uppercase tracking-wide",
        styles[state],
        className,
      )}
    >
      {availabilityLabel[state]}
    </span>
  );
}
