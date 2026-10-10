import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fillVariables, isSafeHref, parseInline, parseLegalMarkdown, tableOfContents } from "@/lib/legal/markdown";

describe("documents légaux : markdown restreint", () => {
  it("n'interprète jamais le HTML : une balise reste du texte", () => {
    const blocks = parseLegalMarkdown("<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>");
    expect(blocks).toEqual([
      { type: "p", inlines: [{ type: "text", text: "<script>alert(1)</script>" }] },
      { type: "p", inlines: [{ type: "text", text: "<img src=x onerror=alert(1)>" }] },
    ]);
  });

  it("n'accepte que les liens internes, https, mailto et tel", () => {
    expect(isSafeHref("/conditions-generales")).toBe(true);
    expect(isSafeHref("https://www.openstreetmap.org")).toBe(true);
    expect(isSafeHref("mailto:contact@ohmegato.com")).toBe(true);
    expect(isSafeHref("tel:+221780103050")).toBe(true);
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("//evil.example")).toBe(false);
    expect(isSafeHref("http://example.com")).toBe(false);
    expect(isSafeHref("data:text/html,x")).toBe(false);
    // Un lien refusé garde seulement son texte.
    expect(parseInline("[cliquer](javascript:alert(1))")).toEqual([{ type: "text", text: "cliquer" }, { type: "text", text: ")" }]);
  });

  it("remplace les variables et retire celles qui sont inconnues", () => {
    expect(fillVariables("Écrire à {{email}}{{inconnue}}.", { email: "contact@ohmegato.com" })).toBe("Écrire à contact@ohmegato.com.");
  });

  it("produit titres, listes, encarts, gras et sommaire avec des ancres uniques", () => {
    const blocks = parseLegalMarkdown("## Paiement\n\nTexte **important**.\n\n- un\n- deux\n\n> Encart\n\n## Paiement\n\n### Détail\n\n1. premier");
    expect(blocks.map((b) => b.type)).toEqual(["h2", "p", "ul", "quote", "h2", "h3", "ol"]);
    expect(tableOfContents(blocks)).toEqual([
      { id: "paiement", text: "Paiement" },
      { id: "paiement-2", text: "Paiement" },
    ]);
  });
});

describe("documents de lancement (content/legal)", () => {
  const dir = join(process.cwd(), "content/legal");
  const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  const all = files.map((f) => readFileSync(join(dir, f), "utf8")).join("\n");

  it("contient les sept documents", () => {
    expect(files.sort()).toEqual(
      [
        "allergenes-conservation.md",
        "annulation-remboursement.md",
        "conditions-generales.md",
        "confidentialite.md",
        "cookies.md",
        "livraison-retrait.md",
        "mentions-legales.md",
      ].sort(),
    );
  });

  it("présente OHMEGATO comme une activité en cours de formalisation, jamais comme une société", () => {
    expect(all).toContain("OHMEGATO est une activité de pâtisserie maison exploitée par Alima à Dakar, actuellement en cours de formalisation.");
    expect(all).not.toMatch(/\b(SARL|SUARL|SAS|SASU|SA au capital)\b/);
    expect(all).not.toMatch(/à compléter|\[à |XXX|TODO/i);
  });

  it("ne présente jamais Orange Money comme disponible ni de traceur publicitaire", () => {
    expect(all).not.toMatch(/Google Analytics|Meta Pixel|Facebook Pixel/);
    for (const line of all.split("\n").filter((l) => /Orange Money/.test(l))) {
      expect(line).toMatch(/pas|n'est|indisponible|aucun/i);
    }
  });

  it("rappelle que la livraison se règle au livreur", () => {
    const livraison = readFileSync(join(dir, "livraison-retrait.md"), "utf8");
    expect(livraison).toMatch(/livreur/);
  });
});
