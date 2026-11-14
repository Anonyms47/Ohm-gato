import { expect, test } from "@playwright/test";
import { acceptTermsAndContinue, addToBox, db, fillPickupCheckout, waitForHydration } from "./helpers";

const FORBIDDEN_FONTS = /Young Serif|Atkinson|Gochi/i;

test.describe("Charte graphique OHMEGATO", () => {
  test("logotype officiel en SVG dans l'en-tête, symbole dans le pied de page, aucune ancienne image", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    const logo = page.locator('header a[aria-label="OHMEGATO — accueil"] img');
    await expect(logo).toHaveAttribute("src", /logotype-ohmegato\.svg/);
    const box = await logo.boundingBox();
    // Proportions d'origine (1800 × 597) : jamais déformé.
    expect(Math.abs(box!.width / box!.height - 1800 / 597)).toBeLessThan(0.05);
    await expect(page.locator('footer img[src*="symbole-ohmegato.svg"]')).toBeAttached();
    await expect(page.locator('img[src*="logo-ohmegato"]')).toHaveCount(0);
    for (const path of ["/brand/symbole-ohmegato.svg", "/brand/logotype-ohmegato.svg", "/brand/symbole-ohmegato.png", "/brand/logotype-ohmegato.png", "/icon.png", "/apple-icon.png", "/opengraph-image"]) {
      const r = await page.request.get(path);
      expect(r.status(), path).toBe(200);
    }
    const svg = await (await page.request.get("/brand/symbole-ohmegato.svg")).text();
    expect(svg).toContain("#3A2418");
    expect(svg).toContain("#DCA7AE");
  });

  test("Jost seule : titres, textes et interface, aucune ancienne police", async ({ page }) => {
    await page.goto("/");
    await waitForHydration(page);
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      return {
        body: getComputedStyle(document.body).fontFamily,
        h1: getComputedStyle(document.querySelector("h1")!).fontFamily,
        faces: [...document.fonts].map((f) => f.family),
      };
    });
    expect(fonts.body).toMatch(/Jost/);
    expect(fonts.h1).toMatch(/Jost/);
    expect(fonts.faces.join(",")).not.toMatch(FORBIDDEN_FONTS);
    const css = await page.evaluate(() => [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules].map((r) => r.cssText); } catch { return []; } }).join("\n"));
    expect(css).not.toMatch(FORBIDDEN_FONTS);
  });

  test("couleurs de la charte centralisées : chocolat #3A2418, crème #F5E9D6, rose #DCA7AE", async ({ page }) => {
    await page.goto("/");
    const colors = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      return ["--ohm-chocolat", "--ohm-creme", "--ohm-rose"].map((n) => s.getPropertyValue(n).trim().toLowerCase());
    });
    expect(colors).toEqual(["#3a2418", "#f5e9d6", "#dca7ae"]);
  });
});

test.describe("Responsive et cibles tactiles", () => {
  for (const width of [320, 375, 390, 430, 768, 1366]) {
    test(`aucun débordement horizontal ni texte coupé à ${width} px`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height: 800 }, isMobile: width < 768, hasTouch: width < 768 });
      const page = await context.newPage();
      for (const path of ["/", "/carte", "/carte/cookies", "/fournees", "/ma-boite", "/commande", "/suivi", "/connexion", "/notre-histoire", "/mentions-legales"]) {
        await page.goto(path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${path} à ${width}px`).toBeLessThanOrEqual(0);
      }
      await context.close();
    });
  }

  test("zoom 200 % (écran de 640 px équivalent) : pas de défilement horizontal", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 640, height: 450 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    for (const path of ["/", "/carte/cookies", "/ma-boite", "/fournees"]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), path).toBeLessThanOrEqual(0);
    }
    await context.close();
  });

  test("boutons et champs d'un parcours de commande : cibles d'au moins 44 × 44 px sur téléphone", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 800 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.goto("/carte/cookies");
    await waitForHydration(page);
    const small = await page.evaluate(() => {
      const bad: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>("main button, main [role=button], main input:not([type=hidden]):not([type=checkbox]):not([type=radio]), header button")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === "hidden") continue;
        if (r.height < 43.5 || r.width < 43.5) bad.push(`${el.tagName} ${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)} ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
      return bad;
    });
    expect(small, small.join(" | ")).toEqual([]);
    await context.close();
  });

  test("double clic sur le paiement : une seule commande est créée", async ({ page }) => {
    await addToBox(page, "cookies", "Unité");
    await fillPickupCheckout(page);
    await page.getByRole("button", { name: "Imprimer mon récapitulatif" }).click();
    await acceptTermsAndContinue(page);
    const before = ((await db("orders?select=id")) as unknown[]).length;
    const pay = page.getByRole("button", { name: "Payer avec Paiement de test" });
    await pay.dblclick();
    await expect(page).toHaveURL(/\/paiement-test\//);
    const after = ((await db("orders?select=id")) as unknown[]).length;
    expect(after - before).toBe(1);
  });
});
