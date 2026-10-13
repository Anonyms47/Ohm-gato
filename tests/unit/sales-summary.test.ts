import { describe, expect, it } from "vitest";
import { monthLabel, parsePeriod, periodBounds, summarizeSales, type PaidOrder } from "@/lib/admin/sales-summary";

const order = (id: string, totalFcfa: number, extra: Partial<PaidOrder> = {}): PaidOrder => ({
  id,
  paidAt: "2026-10-05T10:00:00Z",
  totalFcfa,
  fulfillment: "pickup",
  cycleNumber: 12,
  provider: "wave_link",
  ...extra,
});

describe("résumé des ventes", () => {
  it("additionne les paiements et déduit les remboursements", () => {
    const s = summarizeSales(
      [
        order("a", 4500),
        order("b", 6000, {
          fulfillment: "delivery",
          provider: "test",
          paidAt: "2026-09-30T23:00:00Z",
          cycleNumber: 11,
        }),
      ],
      [
        { orderId: "a", productName: "Cookies", units: 6, lineTotalFcfa: 4500 },
        { orderId: "b", productName: "Cookies", units: 3, lineTotalFcfa: 2500 },
        {
          orderId: "b",
          productName: "Brownies",
          units: 4,
          lineTotalFcfa: 3500,
        },
        {
          orderId: "x",
          productName: "Hors période",
          units: 1,
          lineTotalFcfa: 999,
        },
      ],
      [{ amountFcfa: 1000 }],
    );
    expect(s.paidFcfa).toBe(10500);
    expect(s.refundedFcfa).toBe(1000);
    expect(s.netFcfa).toBe(9500);
    expect(s.paidOrders).toBe(2);
    expect(s.averageFcfa).toBe(5250);
    expect(s.byProvider).toEqual([
      { label: "Paiement de test", orders: 1, fcfa: 6000 },
      { label: "Wave", orders: 1, fcfa: 4500 },
    ]);
    expect(s.byFulfillment.map((r) => r.label)).toEqual(["Livraison", "Retrait"]);
    expect(s.byCycle.map((c) => c.number)).toEqual([12, 11]);
    expect(s.byMonth.map((m) => m.month)).toEqual(["2026-10", "2026-09"]);
    expect(s.products).toEqual([
      { name: "Cookies", units: 9, fcfa: 7000 },
      { name: "Brownies", units: 4, fcfa: 3500 },
    ]);
  });

  it("reste à zéro sans commande payée", () => {
    const s = summarizeSales([], [], []);
    expect(s).toMatchObject({
      paidFcfa: 0,
      netFcfa: 0,
      paidOrders: 0,
      averageFcfa: 0,
      products: [],
    });
  });

  it("découpe les périodes à l'heure de Dakar (UTC)", () => {
    const now = new Date("2026-01-15T12:00:00Z");
    expect(periodBounds("mois", now)).toEqual({
      from: new Date("2026-01-01T00:00:00Z"),
      to: new Date("2026-02-01T00:00:00Z"),
    });
    expect(periodBounds("mois-precedent", now)).toEqual({
      from: new Date("2025-12-01T00:00:00Z"),
      to: new Date("2026-01-01T00:00:00Z"),
    });
    expect(periodBounds("annee", now)).toEqual({
      from: new Date("2026-01-01T00:00:00Z"),
      to: new Date("2027-01-01T00:00:00Z"),
    });
    expect(periodBounds("tout", now)).toBeNull();
    expect(parsePeriod("n'importe")).toBe("mois");
    expect(monthLabel("2026-10")).toBe("octobre 2026");
  });
});
