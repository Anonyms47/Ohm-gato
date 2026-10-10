import { describe, expect, it } from "vitest";
import { availableUnits, maxQuantityFor, productAvailability } from "@/lib/availability";
import { addLine, emptyCart, itemCount, lineKey, parseStoredCart, setQuantity, subtotal, unitsByProduct } from "@/lib/cart";
import { resolveCart } from "@/lib/cart-resolve";
import type { CatalogProduct, CycleSummary } from "@/lib/catalog-types";

const variants = [
  { id: "unite", unitsConsumed: 1 },
  { id: "box3", unitsConsumed: 3 },
  { id: "box6", unitsConsumed: 6 },
];

describe("stock en unités réelles", () => {
  it("disponible = total − réservé − vendu, jamais négatif", () => {
    expect(availableUnits({ totalUnits: 60, reservedUnits: 10, soldUnits: 20 })).toBe(30);
    expect(availableUnits({ totalUnits: 5, reservedUnits: 4, soldUnits: 3 })).toBe(0);
  });
  it("une box de 6 consomme 6 unités", () => {
    expect(maxQuantityFor(variants[2]!, 13)).toBe(2);
    expect(maxQuantityFor(variants[0]!, 13)).toBe(13);
  });
  it("états de disponibilité", () => {
    const base = { cycleIsOpen: true, inCycle: true, variants };
    expect(productAvailability({ ...base, stock: { totalUnits: 60, reservedUnits: 0, soldUnits: 0 } })).toBe("available");
    expect(productAvailability({ ...base, stock: { totalUnits: 60, reservedUnits: 0, soldUnits: 50 } })).toBe("low");
    expect(productAvailability({ ...base, stock: { totalUnits: 60, reservedUnits: 0, soldUnits: 60 } })).toBe("sold_out");
    expect(productAvailability({ ...base, inCycle: false, stock: null })).toBe("out_of_cycle");
    expect(productAvailability({ ...base, cycleIsOpen: false, stock: { totalUnits: 60, reservedUnits: 0, soldUnits: 0 } })).toBe("closed");
  });
});

describe("Ma boîte", () => {
  it("fusionne les lignes identiques et plafonne à 50", () => {
    let cart = addLine(emptyCart("c"), { variantId: "box6", flavorId: null, quantity: 2 });
    cart = addLine(cart, { variantId: "box6", flavorId: null, quantity: 49 });
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]!.quantity).toBe(50);
  });
  it("distingue les parfums", () => {
    let cart = addLine(emptyCart(), { variantId: "chou", flavorId: "vanille", quantity: 1 });
    cart = addLine(cart, { variantId: "chou", flavorId: "chocolat", quantity: 1 });
    expect(itemCount(cart)).toBe(2);
    expect(cart.lines).toHaveLength(2);
  });
  it("quantité 0 = suppression", () => {
    const cart = addLine(emptyCart(), { variantId: "box3", flavorId: null, quantity: 1 });
    expect(setQuantity(cart, lineKey(cart.lines[0]!), 0).lines).toHaveLength(0);
  });
  it("sous-total en entiers et unités par produit", () => {
    expect(subtotal([{ unitPrice: 4500, quantity: 2 }, { unitPrice: 800, quantity: 3 }])).toBe(11400);
    const units = unitsByProduct([
      { productId: "cookies", unitsConsumed: 6, quantity: 2 },
      { productId: "cookies", unitsConsumed: 1, quantity: 3 },
    ]);
    expect(units.get("cookies")).toBe(15);
  });
  it("ignore un stockage corrompu", () => {
    expect(parseStoredCart("x")).toBeNull();
    expect(parseStoredCart({ version: 2, lines: [] })).toBeNull();
    const cart = parseStoredCart({ version: 1, lines: [{ variantId: "a", flavorId: null, quantity: 999 }, { bad: true }] });
    expect(cart?.lines).toEqual([{ variantId: "a", flavorId: null, quantity: 50 }]);
  });
});

describe("revalidation de Ma boîte", () => {
  const cycle: CycleSummary = {
    id: "c12", number: 12, title: "", message: null, opensAt: "", closesAt: "", productionDate: "", fulfillmentDate: "",
    status: "open", isOpen: true, featuredProductSlug: null, palette: "caramel",
  };
  const cookies: CatalogProduct = {
    id: "cookies", slug: "cookies", name: "Cookies", shortDescription: "", description: "", tips: null, unitLabel: "cookie",
    unitLabelPlural: "cookies", staging: "", accent: "caramel", storage: null, allergenInfo: { entries: [], recipeNotes: [] }, pairingSlugs: [], images: [],
    variants: [
      { id: "unite", label: "Unité", unitsConsumed: 1, priceFcfa: 800, enabledInCycle: true },
      { id: "box6", label: "Box de 6", unitsConsumed: 6, priceFcfa: 4500, enabledInCycle: true },
    ],
    flavors: [], inCycle: true, unitsLeft: 10, availability: "available",
  };

  it("stock partagé entre formats : la seconde ligne dépasse", () => {
    const cart = { ...emptyCart("c12"), lines: [
      { variantId: "box6", flavorId: null, quantity: 1 },
      { variantId: "unite", flavorId: null, quantity: 5 },
    ] };
    const resolved = resolveCart(cart, [cookies], cycle);
    expect(resolved.lines[0]!.issue).toBeNull();
    expect(resolved.lines[1]!.issue).toBe("insufficient_stock");
    expect(resolved.subtotal).toBe(4500 + 5 * 800);
  });
  it("fournée fermée et format retiré", () => {
    const cart = { ...emptyCart("c11"), lines: [
      { variantId: "box6", flavorId: null, quantity: 1 },
      { variantId: "disparu", flavorId: null, quantity: 1 },
    ] };
    const closed = resolveCart(cart, [cookies], { ...cycle, isOpen: false });
    expect(closed.lines.map((l) => l.issue)).toEqual(["closed", "unknown"]);
    expect(closed.fromOtherCycle).toBe(true);
  });
});
