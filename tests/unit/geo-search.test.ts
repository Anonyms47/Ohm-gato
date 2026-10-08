import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { insideDakar, parsePlaces, shortLabel } = await import("@/lib/geo/search");

describe("recherche d'adresse", () => {
  it("limite à la région de Dakar", () => {
    expect(insideDakar(14.6928, -17.4467)).toBe(true);
    expect(insideDakar(14.79, -16.93)).toBe(true);
    expect(insideDakar(16.02, -16.5)).toBe(false); // Saint-Louis
  });

  it("raccourcit les libellés", () => {
    expect(shortLabel("Sacré-Cœur 3, Dakar, Dakar, 12500, Sénégal")).toBe("Sacré-Cœur 3, Dakar");
  });

  it("filtre, dédoublonne et refuse les réponses invalides", () => {
    const places = parsePlaces([
      { display_name: "Mermoz, Dakar, Sénégal", lat: "14.7089", lon: "-17.4767" },
      { display_name: "Mermoz, Dakar, Sénégal", lat: "14.709", lon: "-17.477" },
      { display_name: "Saint-Louis, Sénégal", lat: "16.02", lon: "-16.5" },
    ]);
    expect(places).toEqual([{ label: "Mermoz, Dakar", lat: 14.7089, lng: -17.4767 }]);
    expect(parsePlaces({ error: "x" })).toEqual([]);
  });
});
