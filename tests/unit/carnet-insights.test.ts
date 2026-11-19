import { describe, expect, it } from "vitest";
import type { MemberOrder } from "@/lib/account/data";
import { computeInsights, greetingFor, isCountedOrder } from "@/lib/account/insights";

type Line = { productId: string | null; productName: string; quantity: number };

function order(over: Partial<Omit<MemberOrder, "items">> & { items?: Line[] }): MemberOrder {
  const { items = [], ...rest } = over;
  return {
    id: Math.random().toString(),
    reference: "OHM-1",
    status: "delivered",
    paymentStatus: "paid",
    fulfillment: "pickup",
    totalFcfa: 1000,
    deliveryFeeFcfa: null,
    deliveryZoneName: null,
    createdAt: "2026-05-01T10:00:00Z",
    paidAt: null,
    cycleNumber: 1,
    isCustom: false,
    onDemand: false,
    fulfillmentDate: null,
    slot: null,
    items: items.map((i) => ({ ...i, variantId: "v", flavorId: null, variantLabel: "Box", flavorName: null, unitPriceFcfa: 100, lineTotalFcfa: 100 * i.quantity, storage: null })),
    payments: [],
    history: [],
    address: { line: null, district: null, landmark: null, latitude: null, longitude: null },
    pickupCode: null,
    trackingPath: "/suivi/x",
    ...rest,
  };
}

describe("carnet : repères", () => {
  it("ne compte ni les commandes annulées, ni expirées, ni en attente de paiement", () => {
    expect(isCountedOrder({ status: "cancelled" })).toBe(false);
    expect(isCountedOrder({ status: "expired" })).toBe(false);
    expect(isCountedOrder({ status: "pending_payment" })).toBe(false);
    expect(isCountedOrder({ status: "confirmed" })).toBe(true);
  });

  it("ne produit rien d'inventé pour un carnet vide", () => {
    expect(computeInsights([])).toEqual({ orderCount: 0, cycleNumbers: [], habits: [], lastBox: null });
  });

  it("classe les habitudes par quantité réellement commandée et ignore le sur-mesure", () => {
    const orders = [
      order({ cycleNumber: 2, createdAt: "2026-06-01T10:00:00Z", items: [{ productId: "a", productName: "Cookies", quantity: 4 }, { productId: "b", productName: "Brownies", quantity: 2 }] }),
      order({ cycleNumber: 1, items: [{ productId: "b", productName: "Brownies", quantity: 4 }] }),
      order({ cycleNumber: 3, isCustom: true, items: [{ productId: "c", productName: "Gâteau", quantity: 99 }] }),
      order({ cycleNumber: 4, status: "cancelled", items: [{ productId: "a", productName: "Cookies", quantity: 50 }] }),
    ];
    const r = computeInsights(orders);
    expect(r.orderCount).toBe(3);
    expect(r.cycleNumbers).toEqual([1, 2]);
    expect(r.habits.map((h) => [h.productName, h.quantity])).toEqual([["Brownies", 6], ["Cookies", 4]]);
    expect(r.lastBox?.createdAt).toBe("2026-06-01T10:00:00Z");
  });

  it("salue selon l'heure de Dakar", () => {
    expect(greetingFor(new Date("2026-05-01T09:00:00Z"))).toBe("Bonjour");
    expect(greetingFor(new Date("2026-05-01T20:00:00Z"))).toBe("Bonsoir");
  });
});
