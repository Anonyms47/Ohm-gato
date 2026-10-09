/**
 * Allergènes : trois informations distinctes, jamais mélangées.
 * 1. Allergènes déclarés (statut par produit ou par parfum).
 * 2. Informations de recette (« Contient du chocolat… »), qui ne sont pas des allergènes.
 * 3. Traces : uniquement « peut contenir » confirmé, et traces d'atelier activées par Alima.
 * « not_confirmed » et « not_applicable » ne sont jamais affichés ; « no_added » n'est jamais
 * transformé en « sans allergène ».
 */

export type AllergenStatus = "contains" | "may_contain" | "no_added" | "not_confirmed" | "not_applicable";
export type AllergenVerification = "confirmed_by_alima" | "deduced_from_recipe" | "packaging_check_needed";

export const allergenStatusLabels: Record<AllergenStatus, string> = {
  contains: "Contient",
  may_contain: "Peut contenir des traces",
  no_added: "Sans ajout direct",
  not_confirmed: "À vérifier",
  not_applicable: "Non concerné",
};

export const allergenVerificationLabels: Record<AllergenVerification, string> = {
  confirmed_by_alima: "Confirmé par Alima",
  deduced_from_recipe: "Déduit de la recette, à valider",
  packaging_check_needed: "Vérification d’emballage nécessaire",
};

export const ALLERGY_NOTICE =
  "Vous avez une allergie ou une intolérance ? Contactez OHMEGATO avant de commander afin de vérifier la composition du produit et les risques éventuels liés à sa préparation.";

export interface AllergenDef {
  id: string;
  slug: string;
  /** Libellé dans la phrase client : « gluten », « œufs », « lait »… */
  sentenceLabel: string;
  /** Mention complète pour « sans ajout direct ». */
  noAddedText: string;
  sortOrder: number;
}

export interface AllergenEntry {
  allergenId: string;
  /** null : tout le produit ; sinon le parfum concerné. */
  flavorId: string | null;
  status: AllergenStatus;
}

export interface RecipeNote {
  flavorId: string | null;
  /** Rédigé pour suivre « Contient » : « du chocolat », « de la cannelle ». */
  label: string;
  sortOrder: number;
}

export interface WorkshopTraces {
  enabled: boolean;
  /** slugs des allergènes concernés. */
  allergens: string[];
}

export interface ProductAllergenInfo {
  entries: AllergenEntry[];
  recipeNotes: RecipeNote[];
}

export interface AllergenSummary {
  /** « Allergènes : gluten, œufs et lait. » */
  allergens: string | null;
  /** « Contient du chocolat et de la cannelle. » */
  recipe: string | null;
  /** Mentions « Préparé sans … ajouté, mais non garanti … ». */
  noAdded: string[];
  /** « Peut contenir des traces : soja. » */
  traces: string | null;
}

const severity: Record<AllergenStatus, number> = {
  contains: 4,
  may_contain: 3,
  no_added: 2,
  not_confirmed: 1,
  not_applicable: 0,
};

/** « a », « a et b », « a, b et c ». */
export function frenchList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} et ${items.at(-1)}`;
}

/**
 * Résumé client pour un produit et un ensemble de parfums (union des parfums d'une boîte).
 * flavorIds vide : produit sans parfum, ou informations communes à tous les parfums.
 * Pour chaque allergène, le statut retenu est le plus prudent parmi le produit et les parfums.
 */
export function summarizeAllergens(
  info: ProductAllergenInfo,
  defs: AllergenDef[],
  flavorIds: string[] = [],
  workshop: WorkshopTraces | null = null,
): AllergenSummary {
  const applies = (flavorId: string | null) => flavorId === null || flavorIds.includes(flavorId);

  const statusOf = new Map<string, AllergenStatus>();
  for (const entry of info.entries) {
    if (!applies(entry.flavorId)) continue;
    const current = statusOf.get(entry.allergenId);
    if (!current || severity[entry.status] > severity[current]) statusOf.set(entry.allergenId, entry.status);
  }

  const ordered = [...defs].sort((a, b) => a.sortOrder - b.sortOrder);
  const withStatus = (status: AllergenStatus) => ordered.filter((d) => statusOf.get(d.id) === status);

  const contains = withStatus("contains");
  const mayContain = withStatus("may_contain");
  const workshopTraces = workshop?.enabled
    ? ordered.filter((d) => workshop.allergens.includes(d.slug) && statusOf.get(d.id) !== "contains" && !mayContain.includes(d))
    : [];
  const traces = [...mayContain, ...workshopTraces].sort((a, b) => a.sortOrder - b.sortOrder);

  const notes: string[] = [];
  for (const note of [...info.recipeNotes].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (!applies(note.flavorId)) continue;
    const label = note.label.trim();
    if (label && !notes.includes(label)) notes.push(label);
  }

  return {
    allergens: contains.length ? `Allergènes : ${frenchList(contains.map((d) => d.sentenceLabel))}.` : null,
    recipe: notes.length ? `Contient ${frenchList(notes)}.` : null,
    noAdded: withStatus("no_added").map((d) => d.noAddedText),
    traces: traces.length ? `Peut contenir des traces : ${frenchList(traces.map((d) => d.sentenceLabel))}.` : null,
  };
}

export function summaryLines(summary: AllergenSummary): string[] {
  return [summary.allergens, summary.recipe, ...summary.noAdded, summary.traces].filter((l): l is string => Boolean(l));
}

/** Parfums dont les informations diffèrent de celles du produit seul (affichage parfum par parfum). */
export function flavorsWithOwnInfo(info: ProductAllergenInfo): Set<string> {
  const ids = new Set<string>();
  for (const e of info.entries) if (e.flavorId) ids.add(e.flavorId);
  for (const n of info.recipeNotes) if (n.flavorId) ids.add(n.flavorId);
  return ids;
}
