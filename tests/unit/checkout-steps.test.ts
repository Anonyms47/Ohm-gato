import { describe, expect, it } from "vitest";
import { emptyCheckoutForm, fieldIssue, stepIssues, type CheckoutFormValues } from "@/lib/validation/checkout-form";

const delivery = (overrides: Partial<CheckoutFormValues["delivery"]> = {}): CheckoutFormValues => ({
  ...emptyCheckoutForm,
  fulfillment: "delivery",
  delivery: {
    ...emptyCheckoutForm.delivery,
    district: "Mermoz",
    addressLine: "Villa 24, rue MZ-12",
    landmark: "En face de la pharmacie",
    recipientName: "Awa",
    recipientPhone: "77 123 45 67",
    latitude: 14.71,
    longitude: -17.47,
    ...overrides,
  },
});

describe("bon de fournée : validation par étape", () => {
  it("les erreurs de livraison apparaissent même sans créneau choisi", () => {
    const values = delivery({ latitude: null, longitude: null });
    expect(values.slotId).toBe("");
    expect(stepIssues("reception", values).map((i) => i.field)).toEqual(["delivery.latitude", "delivery.longitude"]);
  });

  it("livraison : position exacte obligatoire ; adresse, quartier et repère facultatifs", () => {
    expect(stepIssues("reception", delivery({ addressLine: "", district: "", landmark: "" }))).toEqual([]);
    expect(fieldIssue("delivery.latitude", delivery({ latitude: null }))).toBe("Placez le repère de livraison sur la carte.");
  });

  it("livraison complète acceptée ; retrait sans adresse accepté", () => {
    expect(stepIssues("reception", delivery())).toEqual([]);
    expect(stepIssues("reception", { ...emptyCheckoutForm, fulfillment: "pickup" })).toEqual([]);
  });

  it("mode de réception et créneau obligatoires", () => {
    expect(stepIssues("reception", emptyCheckoutForm)[0]?.field).toBe("fulfillment");
    expect(stepIssues("creneau", emptyCheckoutForm)[0]?.field).toBe("slotId");
  });
});
