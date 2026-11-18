import { cn } from "@/lib/cn";

const MAX_STAMPS = 12;

/** Une fournée goûtée = un tampon. Uniquement les fournées réellement commandées. */
export function StampBook({ cycleNumbers }: { cycleNumbers: number[] }) {
  const shown = cycleNumbers.slice(-MAX_STAMPS);
  const hidden = cycleNumbers.length - shown.length;
  if (cycleNumbers.length === 0) {
    return <p className="text-encre-douce">Votre premier tampon arrivera avec votre première fournée.</p>;
  }
  return (
    <div>
      <ul aria-label="Fournées goûtées" className="flex flex-wrap gap-2.5">
        {hidden > 0 && (
          <li className="grid size-12 place-items-center rounded-full border-2 border-dashed border-chocolat/35 text-[0.9rem] font-bold text-encre-douce">+{hidden}</li>
        )}
        {shown.map((n, i) => (
          <li
            key={n}
            className={cn(
              "grid size-12 place-items-center rounded-full border-[3px] border-chocolat bg-caramel font-display text-[0.95rem] text-chocolat",
              i % 2 === 0 ? "-rotate-3" : "rotate-2",
            )}
          >
            <span className="sr-only">Fournée </span>
            {n}
          </li>
        ))}
      </ul>
    </div>
  );
}
