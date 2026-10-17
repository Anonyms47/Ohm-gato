import { describe, expect, it } from "vitest";
import { fitWithin, needsShrink } from "@/lib/upload/shrink-image";

describe("photos allégées avant l'envoi", () => {
  it("allège seulement les images lourdes, jamais un PDF ni une petite photo", () => {
    expect(needsShrink({ type: "image/jpeg", size: 6 * 1024 * 1024 })).toBe(true);
    expect(needsShrink({ type: "image/png", size: 2 * 1024 * 1024 })).toBe(true);
    expect(needsShrink({ type: "image/jpeg", size: 800 * 1024 })).toBe(false);
    expect(needsShrink({ type: "application/pdf", size: 6 * 1024 * 1024 })).toBe(false);
    expect(needsShrink({ type: "audio/mpeg", size: 6 * 1024 * 1024 })).toBe(false);
  });

  it("garde les proportions et ne grandit jamais une image", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 2400, height: 1800 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1800, height: 2400 });
    expect(fitWithin(1200, 800)).toEqual({ width: 1200, height: 800 });
  });
});
