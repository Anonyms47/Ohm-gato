import { describe, expect, it } from "vitest";
import { formatFcfa, lineTotal } from "@/lib/money";
import { formatSenegalPhone, normalizeSenegalPhone } from "@/lib/phone";

describe("montants FCFA", () => {
  it("formate avec espaces insécables", () => {
    expect(formatFcfa(4500)).toBe("4 500 FCFA");
    expect(formatFcfa(800)).toBe("800 FCFA");
  });
  it("refuse les décimales et les négatifs", () => {
    expect(() => formatFcfa(12.5)).toThrow(RangeError);
    expect(() => formatFcfa(-1)).toThrow(RangeError);
    expect(() => lineTotal(800, 1.5)).toThrow(RangeError);
  });
  it("calcule une ligne en entiers", () => {
    expect(lineTotal(4500, 3)).toBe(13500);
  });
});

describe("téléphones sénégalais", () => {
  it.each([
    ["77 123 45 67", "+221771234567"],
    ["771234567", "+221771234567"],
    ["+221 78 010 30 50", "+221780103050"],
    ["00221 76 000 11 22", "+221760001122"],
    ["33 820 00 00", "+221338200000"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeSenegalPhone(input)).toBe(expected);
  });
  it.each(["12345", "79 123 45 67", "+33 6 12 34 56 78", "77 123 45 6a", ""])("refuse %s", (input) => {
    expect(normalizeSenegalPhone(input)).toBeNull();
  });
  it("affiche par groupes", () => {
    expect(formatSenegalPhone("+221780103050")).toBe("+221 78 010 30 50");
  });
});
