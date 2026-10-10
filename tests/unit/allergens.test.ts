import { describe, expect, it } from "vitest";
import { summarizeAllergens, summaryLines, type AllergenDef, type ProductAllergenInfo } from "@/lib/allergens";

const defs: AllergenDef[] = [
  { id: "gluten", slug: "gluten", sentenceLabel: "gluten", noAddedText: "", sortOrder: 1 },
  { id: "oeufs", slug: "oeufs", sentenceLabel: "œufs", noAddedText: "", sortOrder: 2 },
  { id: "lait", slug: "lait", sentenceLabel: "lait", noAddedText: "Préparé sans lait ajouté, mais non garanti sans lactose ni sans traces de lait.", sortOrder: 3 },
  { id: "soja", slug: "soja", sentenceLabel: "soja", noAddedText: "", sortOrder: 4 },
  { id: "sesame", slug: "sesame", sentenceLabel: "sésame", noAddedText: "", sortOrder: 7 },
];

const base = (lait: "contains" | "no_added"): ProductAllergenInfo["entries"] => [
  { allergenId: "gluten", flavorId: null, status: "contains" },
  { allergenId: "oeufs", flavorId: null, status: "contains" },
  { allergenId: "lait", flavorId: null, status: lait },
  { allergenId: "soja", flavorId: null, status: "not_confirmed" },
  { allergenId: "sesame", flavorId: null, status: "not_confirmed" },
];

describe("allergènes : affichage client", () => {
  it("cookies : allergènes puis information de recette, soja à vérifier jamais affiché", () => {
    const lines = summaryLines(
      summarizeAllergens(
        { entries: base("contains"), recipeNotes: [
          { flavorId: null, label: "du chocolat noir", sortOrder: 1 },
          { flavorId: null, label: "du chocolat au lait", sortOrder: 2 },
        ] },
        defs,
      ),
    );
    expect(lines).toEqual(["Allergènes : gluten, œufs et lait.", "Contient du chocolat noir et du chocolat au lait."]);
  });

  it("brownies : sans lait ajouté n'est jamais « sans lait » ni « sans lactose »", () => {
    const summary = summarizeAllergens({ entries: base("no_added"), recipeNotes: [{ flavorId: null, label: "du chocolat", sortOrder: 1 }] }, defs);
    expect(summaryLines(summary)).toEqual([
      "Allergènes : gluten et œufs.",
      "Contient du chocolat.",
      "Préparé sans lait ajouté, mais non garanti sans lactose ni sans traces de lait.",
    ]);
  });

  it("choux : vanille, chocolat, et union des deux pour une boîte mélangée", () => {
    const info: ProductAllergenInfo = {
      entries: [...base("contains"), { allergenId: "soja", flavorId: "chocolat", status: "not_confirmed" }],
      recipeNotes: [{ flavorId: "chocolat", label: "du chocolat", sortOrder: 1 }],
    };
    expect(summaryLines(summarizeAllergens(info, defs, ["vanille"]))).toEqual(["Allergènes : gluten, œufs et lait."]);
    expect(summaryLines(summarizeAllergens(info, defs, ["chocolat"]))).toEqual(["Allergènes : gluten, œufs et lait.", "Contient du chocolat."]);
    expect(summaryLines(summarizeAllergens(info, defs, ["vanille", "chocolat"]))).toEqual(["Allergènes : gluten, œufs et lait.", "Contient du chocolat."]);
  });

  it("verrines : tous les fruits choisis dans une boîte", () => {
    const info: ProductAllergenInfo = {
      entries: base("contains"),
      recipeNotes: [
        { flavorId: "fraise", label: "de la fraise", sortOrder: 1 },
        { flavorId: "mangue", label: "de la mangue", sortOrder: 1 },
        { flavorId: "orange", label: "de l’orange", sortOrder: 1 },
      ],
    };
    expect(summarizeAllergens(info, defs, ["fraise", "orange"]).recipe).toBe("Contient de la fraise et de l’orange.");
  });

  it("statut le plus prudent : un parfum qui contient du lait l'emporte sur « sans lait ajouté »", () => {
    const info: ProductAllergenInfo = { entries: [...base("no_added"), { allergenId: "lait", flavorId: "chocolat", status: "contains" }], recipeNotes: [] };
    const summary = summarizeAllergens(info, defs, ["chocolat"]);
    expect(summary.allergens).toBe("Allergènes : gluten, œufs et lait.");
    expect(summary.noAdded).toEqual([]);
  });

  it("traces : seulement « peut contenir » confirmé, ou l'atelier activé par Alima", () => {
    const info: ProductAllergenInfo = { entries: base("contains"), recipeNotes: [] };
    expect(summarizeAllergens(info, defs, [], { enabled: false, allergens: ["sesame"] }).traces).toBeNull();
    expect(summarizeAllergens(info, defs, [], { enabled: true, allergens: ["sesame", "lait"] }).traces).toBe("Peut contenir des traces : sésame.");
    const mayContain: ProductAllergenInfo = { entries: [...info.entries.filter((e) => e.allergenId !== "soja"), { allergenId: "soja", flavorId: null, status: "may_contain" }], recipeNotes: [] };
    expect(summarizeAllergens(mayContain, defs).traces).toBe("Peut contenir des traces : soja.");
  });
});
