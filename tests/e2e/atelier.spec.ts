import { expect, test } from "@playwright/test";
import { e164, grantAdmin, login, testPhone, waitForHydration } from "./helpers";

test.describe("Atelier — navigation et accueil", () => {
  test("« Aujourd'hui » répond à : que faire maintenant ? Recherche et navigation", async ({ page }) => {
    const admin = testPhone();
    await login(page, admin, "/admin");
    await grantAdmin(e164(admin));
    await page.goto("/admin");
    await waitForHydration(page);

    await expect(page.getByRole("heading", { level: 1, name: /^Bonjour/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "À faire maintenant" })).toBeVisible();
    await expect(page.getByText("Prochaine étape", { exact: true })).toBeVisible();
    await expect(page.getByText("Fournée active")).toBeVisible();
    // Aucun nom technique visible.
    await expect(page.getByText(/preorder_open|payment_pending|surplus_available|needs_attention/)).toHaveCount(0);

    // Recherche globale : le bouton de l'en-tête (téléphone) ou de la barre latérale (ordinateur).
    await page.getByRole("button", { name: "Rechercher" }).filter({ visible: true }).first().click();
    const dialog = page.getByRole("dialog", { name: "Rechercher dans l'atelier" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("combobox").fill("cookies");
    await expect(dialog.getByRole("option", { name: /Cookies/ }).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // Palette : accès rapide par mot-clé, jamais une action directe.
    await page.getByRole("button", { name: "Rechercher" }).filter({ visible: true }).first().click();
    await dialog.getByRole("combobox").fill("paiement");
    await dialog.getByRole("option", { name: /Vérifier les paiements Wave/ }).click();
    await expect(page).toHaveURL(/\/admin\/paiements$/);
    await expect(page.getByRole("heading", { level: 1, name: "Paiements Wave à vérifier" })).toBeVisible();

    // Raccourcis : la fournée de travail et sa fiche de production.
    await page.goto("/admin/fournee");
    await expect(page).toHaveURL(/\/admin\/fournees\//);
    await page.goto("/admin/production");
    await expect(page.getByTestId("fiche-production")).toBeVisible();

    await page.goto("/admin/actions");
    await expect(page.getByRole("heading", { level: 1, name: "Actions à traiter" })).toBeVisible();
    await page.goto("/admin/aide");
    await expect(page.getByRole("heading", { name: "Confirmer un paiement Wave" })).toBeVisible();
  });

  test("téléphone : barre du bas et panneau « Plus » accessible", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 1200) >= 1024, "barre du bas réservée aux petits écrans");
    const admin = testPhone();
    await login(page, admin, "/admin");
    await grantAdmin(e164(admin));
    await page.goto("/admin");
    await waitForHydration(page);
    const bar = page.getByRole("navigation", { name: "Accès rapides" });
    await expect(bar.getByRole("link", { name: "Aujourd'hui" })).toHaveAttribute("aria-current", "page");
    await bar.getByRole("link", { name: "Commandes" }).click();
    await expect(page).toHaveURL(/\/admin\/commandes/);
    await bar.getByRole("button", { name: "Plus" }).click();
    const sheet = page.getByRole("dialog", { name: "Toutes les rubriques" });
    await expect(sheet.getByRole("link", { name: "Journal d'activité" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });

  for (const viewport of [
    { width: 320, height: 640 },
    { width: 375, height: 740 },
    { width: 390, height: 844 },
    { width: 820, height: 1180 },
    { width: 1440, height: 900 },
  ]) {
    test(`aucun débordement de l'atelier à ${viewport.width} px`, async ({ browser }) => {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const admin = testPhone();
      await login(page, admin, "/admin");
      await grantAdmin(e164(admin));
      for (const path of ["/admin", "/admin/paiements", "/admin/actions", "/admin/aide", "/admin/commandes"]) {
        await page.goto(path);
        await waitForHydration(page);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, path).toBeLessThanOrEqual(0);
      }
      await context.close();
    });
  }
});
