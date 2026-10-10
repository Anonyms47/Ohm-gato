import type { AdminAllergen, AdminProduct } from "@/lib/admin/data";
import { allergenStatusLabels, type AllergenVerification } from "@/lib/allergens";

/** Filtres de l'état de vérification des informations allergènes (administration seulement). */
export const REVIEW_FILTERS = ["confirmed_by_alima", "deduced_from_recipe", "packaging_check_needed", "not_filled"] as const;
export type ReviewFilter = (typeof REVIEW_FILTERS)[number];

export const reviewFilterLabels: Record<ReviewFilter, string> = {
  confirmed_by_alima: "Confirmé par Alima",
  deduced_from_recipe: "Déduit de la recette",
  packaging_check_needed: "À vérifier sur l’emballage",
  not_filled: "Non renseigné",
};

export interface ReviewItem {
  productId: string;
  productName: string;
  scope: string;
  kind: "allergen" | "recipe";
  label: string;
  status: string | null;
  verifiedAt: string | null;
  filter: ReviewFilter;
}

/**
 * Toutes les informations d'allergènes et de recette, classées par état de vérification.
 * « Non renseigné » : allergène actif sans aucun statut pour le produit.
 */
export function reviewItems(products: AdminProduct[], allergens: AdminAllergen[], flavors: { id: string; name: string }[]): ReviewItem[] {
  const scopeName = (flavorId: string | null) =>
    flavorId ? `Parfum ${(flavors.find((f) => f.id === flavorId)?.name ?? "retiré").toLocaleLowerCase("fr")}` : "Tout le produit";
  const allergenName = (id: string) => allergens.find((a) => a.id === id)?.name ?? "Allergène retiré";
  const items: ReviewItem[] = [];
  for (const p of products) {
    for (const s of p.allergenStatuses) {
      items.push({
        productId: p.id,
        productName: p.name,
        scope: scopeName(s.flavorId),
        kind: "allergen",
        label: allergenName(s.allergenId),
        status: allergenStatusLabels[s.status],
        verifiedAt: s.verifiedAt,
        filter: s.verification as AllergenVerification,
      });
    }
    for (const n of p.recipeNotes) {
      items.push({
        productId: p.id,
        productName: p.name,
        scope: scopeName(n.flavorId),
        kind: "recipe",
        label: `Contient ${n.label}`,
        status: null,
        verifiedAt: n.verifiedAt,
        filter: n.verification as AllergenVerification,
      });
    }
    for (const a of allergens) {
      if (p.allergenStatuses.some((s) => s.allergenId === a.id)) continue;
      items.push({ productId: p.id, productName: p.name, scope: "Tout le produit", kind: "allergen", label: a.name, status: null, verifiedAt: null, filter: "not_filled" });
    }
  }
  return items;
}

/** Statuts « à vérifier » : jamais affichés aux clients, recalculés à chaque chargement. */
export function toVerifyCount(products: AdminProduct[]): number {
  return products.reduce((sum, p) => sum + p.allergenStatuses.filter((s) => s.status === "not_confirmed").length, 0);
}
