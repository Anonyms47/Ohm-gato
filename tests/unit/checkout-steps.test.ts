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
  it("les erreurs d'adresse apparaissent même sans créneau choisi", () => {
    const values = delivery({ addressLine: "" });
    expect(values.slotId).toBe("");
    expect(stepIssues("reception", values).map((i) => i.field)).toEqual(["delivery.addressLine"]);
  });

  it("livraison : position exacte et point de repère obligatoires", () => {
    const fields = stepIssues("reception", delivery({ latitude: null, longitude: null, landmark: "" })).map((i) => i.field);
    expect(fields).toEqual(expect.arrayContaining(["delivery.landmark", "delivery.latitude", "delivery.longitude"]));
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
