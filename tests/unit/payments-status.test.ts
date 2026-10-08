import { describe, expect, it } from "vitest";
import { isAwaitingPayment, reachedStepIndex, roadSteps } from "@/lib/order-status";
import { orderErrorMessage } from "@/lib/orders/errors";
import { signTimestamped, verifyTimestampedSignature } from "@/lib/payments/signature";
import { placeOrderSchema } from "@/lib/validation/checkout";

describe("signature des webhooks", () => {
  const secret = "s".repeat(40);
  const body = '{"id":"evt_1","status":"paid"}';
  const now = 1_800_000_000;

  it("accepte une signature valide", () => {
    expect(verifyTimestampedSignature(signTimestamped(body, secret, now), body, secret, 300, now)).toBe(true);
  });
  it("refuse un corps modifié, un mauvais secret ou une absence d'en-tête", () => {
    const header = signTimestamped(body, secret, now);
    expect(verifyTimestampedSignature(header, body.replace("paid", "PAID"), secret, 300, now)).toBe(false);
    expect(verifyTimestampedSignature(header, body, "autre".repeat(10), 300, now)).toBe(false);
    expect(verifyTimestampedSignature(null, body, secret, 300, now)).toBe(false);
    expect(verifyTimestampedSignature("t=abc,v1=zz", body, secret, 300, now)).toBe(false);
  });
  it("refuse un rejeu trop ancien", () => {
    expect(verifyTimestampedSignature(signTimestamped(body, secret, now - 3600), body, secret, 300, now)).toBe(false);
  });
});

describe("statuts", () => {
  it("carnet de route selon le mode de réception", () => {
    expect(roadSteps("pickup").map((s) => s.key)).toEqual(["confirmed", "preparing", "finishing", "ready", "picked_up"]);
    expect(roadSteps("delivery").at(-1)?.key).toBe("delivered");
    expect(reachedStepIndex("finishing", "delivery")).toBe(2);
    expect(reachedStepIndex("pending_payment", "delivery")).toBe(-1);
  });
  it("seule une commande provisoire en attente peut être payée", () => {
    expect(isAwaitingPayment("pending_payment", "pending")).toBe(true);
    expect(isAwaitingPayment("expired", "expired")).toBe(false);
    expect(isAwaitingPayment("confirmed", "paid")).toBe(false);
  });
  it("messages d'erreur humains", () => {
    expect(orderErrorMessage("INSUFFICIENT_STOCK", { product_name: "Verrines fruitées", available: 3 })).toContain("Il ne reste que 3 unités");
    expect(orderErrorMessage("INSUFFICIENT_STOCK", { product_name: "Cookies", available: 0 })).toContain("vient d'être épuisé");
    expect(orderErrorMessage("CODE_INCONNU")).toContain("Réessayez");
  });
});

describe("commande : le navigateur n'envoie jamais de prix", () => {
  const valid = {
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
    cycleId: "00000000-0000-4000-8000-000000000012",
    fulfillment: "pickup",
    slotId: "22222222-2222-4222-8222-222222222222",
    contact: { name: "Awa", phone: "77 123 45 67", email: "" },
    delivery: null,
    lines: [{ variantId: "33333333-3333-4333-8333-333333333333", flavorId: null, quantity: 2 }],
    paymentProvider: "wave",
  };
  it("normalise le téléphone et ignore tout champ de prix", () => {
    const parsed = placeOrderSchema.parse({ ...valid, total: 1, lines: [{ ...valid.lines[0], price: 1 }] });
    expect(parsed.contact.phone).toBe("+221771234567");
    expect(parsed).not.toHaveProperty("total");
    expect(parsed.lines[0]).not.toHaveProperty("price");
  });
  it("exige une adresse pour une livraison", () => {
    expect(placeOrderSchema.safeParse({ ...valid, fulfillment: "delivery" }).success).toBe(false);
  });
  it("refuse les quantités hors limites", () => {
    expect(placeOrderSchema.safeParse({ ...valid, lines: [{ ...valid.lines[0], quantity: 0 }] }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...valid, lines: [{ ...valid.lines[0], quantity: 51 }] }).success).toBe(false);
  });
});
