import { describe, expect, it } from "vitest";
import data from "@/components/brand/logo-morph/morph-data.json";
import { frameAt, ribbonPoints, type MorphData } from "@/components/brand/logo-morph/engine";

const morph = data as unknown as MorphData;

describe("morphing logotype → symbole", () => {
  it("dure 6 s : logotype officiel jusqu'à 1 s, symbole officiel dès la fin du morphing", () => {
    expect(morph.duration).toBe(6);
    expect(frameAt(morph, 0.5).mode).toBe("logo");
    expect(frameAt(morph, 2.5).mode).toBe("ribbons");
    expect(morph.morphEnd).toBeLessThanOrEqual(4.5);
    expect(frameAt(morph, 5.5)).toEqual({ mode: "symbol", diamond: 1 });
  });

  it("chaque lettre arrive exactement sur sa pièce", () => {
    expect(morph.ribbons.map((r) => r.id)).toEqual(["o1", "h", "m", "e", "g", "a", "t", "o2"]);
    for (const r of morph.ribbons) {
      const p = ribbonPoints(r, r.t1);
      for (let k = 0; k < r.n; k += 7) {
        const q = (2 * r.n - 1 - k) * 2;
        expect(Math.abs(p[k * 2]! - r.tgt[k * 4]!)).toBeLessThan(0.01);
        expect(Math.abs(p[q + 1]! - r.tgt[k * 4 + 3]!)).toBeLessThan(0.01);
      }
    }
  });

  it("aucune coordonnée invalide pendant le mouvement", () => {
    for (let t = 1; t <= morph.morphEnd; t += 0.1) {
      for (const r of morph.ribbons) expect(ribbonPoints(r, t).every(Number.isFinite)).toBe(true);
    }
  });
});
