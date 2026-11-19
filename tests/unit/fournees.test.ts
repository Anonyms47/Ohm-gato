import { describe, expect, it } from "vitest";
import { productAvailability } from "@/lib/availability";
import type { CycleSummary } from "@/lib/catalog-types";
import {
  DONE_MESSAGE,
  BATCH_IN_PROGRESS_MESSAGE,
  NO_CALENDAR_MESSAGE,
  hasUpcomingFulfillment,
  SURPLUS_MESSAGE,
  cyclePhase,
  friseSteps,
  orderKindFor,
  phaseAction,
  phaseMessage,
  preorderMessage,
  productionLabel,
} from "@/lib/cycle-status";
import { theoreticalSurplus } from "@/lib/production";

/** Première fournée : semaine du 19 octobre 2026, livraison le vendredi 23 octobre (Dakar). */
const first: CycleSummary = {
  id: "c1",
  number: 1,
  title: "Fournée de la semaine du 19 octobre",
  message: null,
  opensAt: "2026-10-10T00:00:00Z",
  productionDate: "2026-10-19",
  productionDays: 3,
  productionDates: [],
  fulfillmentDate: "2026-10-23",
  status: "open",
  surplusEndsAt: null,
  surplusDeliveryAllowed: false,
  isOpen: true,
  composable: true,
  orderKind: "preorder",
  featuredProductSlug: null,
  palette: "caramel",
};
const at = (iso: string) => Date.parse(iso);

describe("fournée de la semaine du 19 octobre", () => {
  it("commandes permanentes : aucune heure limite ne ferme la fournée ouverte", () => {
    expect(cyclePhase(first, at("2026-10-18T23:59:00Z"))).toBe("open");
    expect(cyclePhase(first, at("2026-10-22T08:00:00Z"))).toBe("open");
    expect(orderKindFor(first, at("2026-10-22T08:00:00Z"))).toBe("preorder");
  });

  it("sans date de remise à venir : la commande se fait sans fournée, état exact (aucune fermeture inventée)", () => {
    expect(hasUpcomingFulfillment(first, at("2026-10-23T12:00:00Z"))).toBe(true);
    expect(hasUpcomingFulfillment(first, at("2026-10-24T00:00:00Z"))).toBe(false);
    expect(orderKindFor(first, at("2026-10-24T00:00:00Z"))).toBeNull();
    expect(cyclePhase(first, at("2026-10-24T00:00:00Z"))).toBe("open");
    expect(phaseMessage("open", { ...first, fulfillmentDate: "2020-01-01" })).toBe(NO_CALENDAR_MESSAGE);
    expect(NO_CALENDAR_MESSAGE).toMatch(/commander quand même.*OHMEGATO vous communique la date/);
  });

  it("messages officiels, sans date de production inventée", () => {
    expect(preorderMessage(first)).toBe(
      "Vous pouvez commander à tout moment. Votre commande sera préparée pendant la semaine et livrée ou retirée le vendredi 23 octobre.",
    );
    expect(preorderMessage({ ...first, productionDates: ["2026-10-19"] })).toBe(
      "Vous pouvez commander à tout moment. Votre commande sera préparée le lundi 19 octobre et livrée ou retirée le vendredi 23 octobre.",
    );
    expect(productionLabel(first)).toBe("Production organisée sur trois jours pendant la semaine du 19 octobre.");
    expect(productionLabel({ ...first, productionDates: ["2026-10-21", "2026-10-19"] })).toBe("Production le lundi 19 octobre et mercredi 21 octobre.");
    expect(phaseMessage("closed", first)).toBe(BATCH_IN_PROGRESS_MESSAGE);
    expect(phaseMessage("surplus", first)).toBe(SURPLUS_MESSAGE);
    expect(phaseMessage("done", first)).toBe(DONE_MESSAGE);
    expect(BATCH_IN_PROGRESS_MESSAGE).not.toMatch(/sera disponible|garanti|précommandes sont terminées|fermé/i);
    expect(BATCH_IN_PROGRESS_MESSAGE).toMatch(/commander quand même/);
  });

  it("boutons adaptés à chaque phase, aucune fausse alerte", () => {
    expect(phaseAction("open", 1)?.label).toBe("Composer ma boîte");
    expect(phaseAction("preparing", 1)?.label).toBe("Voir l’avancement");
    expect(phaseAction("surplus", 1)?.label).toBe("Voir les douceurs disponibles");
    expect(phaseAction("done", 1)?.label).toBe("Découvrir les prochaines fournées");
    expect(phaseAction("closed", 1)).toBeNull();
  });

  it("surplus : ouvert seulement s'il est publié, fermé à sa date de fin ou épuisé", () => {
    const surplus = { ...first, status: "surplus", surplusEndsAt: "2026-10-25T18:00:00Z" };
    expect(cyclePhase(surplus, at("2026-10-24T10:00:00Z"))).toBe("surplus");
    expect(orderKindFor(surplus, at("2026-10-24T10:00:00Z"))).toBe("surplus");
    expect(cyclePhase(surplus, at("2026-10-25T18:00:00Z"))).toBe("done");
    expect(cyclePhase(surplus, at("2026-10-24T10:00:00Z"), true)).toBe("done");
    expect(friseSteps(surplus, "surplus").map((s) => s.state)).toEqual(["done", "done", "done", "current"]);
  });

  it("surplus : jamais « presque épuisé », seule la quantité réelle compte", () => {
    const stock = { totalUnits: 40, reservedUnits: 0, soldUnits: 38 };
    const variants = [{ id: "u", unitsConsumed: 1 }];
    expect(productAvailability({ cycleIsOpen: true, inCycle: true, stock, variants })).toBe("low");
    expect(productAvailability({ cycleIsOpen: true, inCycle: true, stock, variants, surplus: true })).toBe("available");
    expect(productAvailability({ cycleIsOpen: true, inCycle: true, stock: { ...stock, soldUnits: 40 }, variants, surplus: true })).toBe("sold_out");
  });

  it("surplus théorique = production commercialisable - engagé, jamais négatif", () => {
    expect(theoreticalSurplus({ producedUnits: 30, lostUnits: 2, reservedUnits: 4, soldUnits: 20, totalUnits: 40 }, "preparing")).toBe(4);
    expect(theoreticalSurplus({ producedUnits: 10, lostUnits: 0, reservedUnits: 0, soldUnits: 12, totalUnits: 12 }, "preparing")).toBe(0);
    expect(theoreticalSurplus({ producedUnits: null, lostUnits: 0, reservedUnits: 0, soldUnits: 5, totalUnits: 10 }, "preparing")).toBeNull();
    // Pendant la vente du surplus, ce qui est déjà publié et encore disponible est déduit.
    expect(theoreticalSurplus({ producedUnits: 30, lostUnits: 2, reservedUnits: 0, soldUnits: 24, totalUnits: 26 }, "surplus")).toBe(2);
  });
});
