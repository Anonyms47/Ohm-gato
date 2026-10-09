import { summaryLines, type AllergenSummary } from "@/lib/allergens";

/** Lignes d'information allergènes telles que vues par le client (aussi utilisé pour l'aperçu admin). */
export function AllergenSummaryText({ summary, empty }: { summary: AllergenSummary; empty?: string }) {
  const lines = summaryLines(summary);
  if (lines.length === 0) return empty ? <p className="text-encre-douce">{empty}</p> : null;
  return (
    <div className="flex flex-col gap-1">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}
