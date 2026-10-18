import { cn } from "@/lib/cn";
import { formatShortDay, formatTime } from "@/lib/dates";

export interface HistoryEntry {
  label: string;
  at: string;
  detail?: string | null;
  by?: string | null;
}

/**
 * Historique en frise verticale : une étape par ligne, la plus récente en premier et mise en avant.
 * Les étapes répétées à la suite (même libellé, sans détail) ne s'affichent qu'une fois.
 */
export function HistoryTimeline({ entries, className }: { entries: HistoryEntry[]; className?: string }) {
  const unique = entries.filter((e, i) => i === 0 || e.label !== entries[i - 1]!.label || Boolean(e.detail));
  const ordered = [...unique].reverse();
  if (ordered.length === 0) return <p className="text-encre-douce">Aucune étape pour l&apos;instant.</p>;
  return (
    <ol className={cn("relative ml-2 flex flex-col gap-4 border-l-2 border-chocolat/15 pl-6", className)}>
      {ordered.map((e, index) => (
        <li key={`${e.at}-${index}`} className="relative">
          <span
            aria-hidden
            className={cn(
              "absolute -left-[33px] top-1 size-4 rounded-full border-2",
              index === 0 ? "border-chocolat bg-caramel" : "border-chocolat/30 bg-blanc-casse",
            )}
          />
          <p className={cn(index === 0 ? "font-bold" : "text-chocolat")}>{e.label}</p>
          <p className="text-[0.9rem] text-encre-douce tabular-nums">
            {formatShortDay(e.at)} à {formatTime(e.at)}
            {e.by ? ` · ${e.by}` : ""}
          </p>
          {e.detail && <p className="mt-0.5 text-[0.95rem]">{e.detail}</p>}
        </li>
      ))}
    </ol>
  );
}
