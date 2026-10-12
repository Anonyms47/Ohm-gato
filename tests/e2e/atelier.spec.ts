import { expect, test } from "@playwright/test";
import { acceptTermsAndContinue, addToBox, e164, fillPickupCheckout, grantAdmin, login, testPhone, waitForHydration } from "./helpers";

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

/** Le récapitulatif n'est imprimé qu'une fois par session : on ne clique que s'il est proposé. */
async function confirmCheckout(page: import("@playwright/test").Page) {
  await expect(page.getByRole("heading", { name: /5\. Vérification/ })).toBeVisible();
  const print = page.getByRole("button", { name: "Imprimer mon récapitulatif" });
  if (await print.isVisible()) await print.click();
  await acceptTermsAndContinue(page);
}

/** Commande au retrait payée par le prestataire de test ; renvoie sa référence. */
async function paidPickupOrder(page: import("@playwright/test").Page): Promise<string> {
  await addToBox(page, "cookies", "Box de 3");
  await fillPickupCheckout(page);
  await confirmCheckout(page);
  await page.getByRole("button", { name: "Payer avec Paiement de test" }).click();
  await expect(page).toHaveURL(/\/paiement-test\//);
  await page.getByRole("button", { name: "Simuler un paiement réussi" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("C'est noté.");
  return (await page.getByText(/^Commande OHM12-/).first().textContent())!.replace("Commande ", "").trim();
}

/** Commande au retrait « payer avec Wave » (paiement à vérifier) ; renvoie sa référence. */
async function waveOrder(page: import("@playwright/test").Page): Promise<string> {
  await addToBox(page, "cake-orange", "4 tranches");
  await fillPickupCheckout(page);
  await confirmCheckout(page);
  await page.getByRole("button", { name: "Payer avec Wave" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Commande confirmée");
  return (await page.getByText(/^Commande OHM12-/).first().textContent())!.replace("Commande ", "").trim();
}

test.describe("Atelier — commandes et paiements", () => {
  test("actions groupées confirmées : préparation, prêtes, retrait effectué", async ({ page }) => {
    test.slow();
    const first = await paidPickupOrder(page);
    const second = await paidPickupOrder(page);
    const admin = testPhone();
    await login(page, admin, "/admin/commandes");
    await grantAdmin(e164(admin));

    for (const [action, confirm] of [
      ["Passer en préparation", "Passer en préparation"],
      ["Marquer prêtes", "Marquer prêtes"],
      ["Retrait effectué", "Retrait effectué"],
    ] as const) {
      await page.goto("/admin/commandes?vue=besoin");
      await waitForHydration(page);
      for (const ref of [first, second]) await page.getByRole("checkbox", { name: `Sélectionner ${ref}` }).first().check();
      const bar = page.getByRole("region", { name: "Actions sur la sélection" });
      await bar.getByRole("button", { name: new RegExp(`^${action} \\(2\\)`) }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText(first);
      await expect(dialog).toContainText(second);
      await dialog.getByRole("button", { name: confirm, exact: true }).click();
      await expect(page.getByText(/^2 commandes :/)).toBeVisible();
    }
    await page.goto(`/admin/commandes?q=${first}`);
    await page.getByRole("link", { name: first }).first().click();
    await expect(page.getByText("Remise au client").first()).toBeVisible();
    await expect(page.getByText(/Action groupée/).first()).toBeVisible();
  });

  test("paiement Wave : introuvable, puis vérifié avec résumé et tampon ; annulation motivée ; note interne", async ({ page }) => {
    test.slow();
    const toVerify = await waveOrder(page);
    const toCancel = await waveOrder(page);
    const admin = testPhone();
    await login(page, admin, "/admin/paiements");
    await grantAdmin(e164(admin));
    await page.goto("/admin/paiements");
    await waitForHydration(page);

    const ticket = page.locator("li", { has: page.getByRole("link", { name: toVerify, exact: true }) });
    await ticket.getByRole("button", { name: "Introuvable pour le moment" }).click();
    await expect(page.getByText(/Déjà cherché sans succès/).first()).toBeVisible();
    await expect(ticket.getByRole("link", { name: /Contacter la cliente/ })).toHaveAttribute("href", /^https:\/\/wa\.me\/221\d+\?text=/);

    await ticket.getByLabel(/Référence de la transaction Wave/).fill("TX-9");
    await ticket.getByRole("button", { name: "Paiement Wave reçu" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(toVerify);
    await expect(dialog).toContainText("TX-9");
    await dialog.getByRole("button", { name: "Oui, paiement reçu" }).click();
    await expect(page.getByText("Paiement enregistré : la commande est payée.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Vérifiés aujourd'hui" })).toBeVisible();
    await expect(page.locator("#verifies").getByRole("link", { name: toVerify })).toBeVisible();

    // Annulation : le motif est obligatoire et reste dans l'historique.
    await page.goto(`/admin/commandes?q=${toCancel}`);
    await page.getByRole("link", { name: toCancel }).first().click();
    await waitForHydration(page);
    await page.getByRole("button", { name: "Annuler la commande" }).click();
    const cancel = page.getByRole("dialog");
    await cancel.getByRole("button", { name: "Annuler la commande" }).click();
    await expect(cancel.getByText("Indiquez le motif de l'annulation.")).toBeVisible();
    await cancel.getByLabel("Motif de l'annulation").fill("Paiement jamais reçu");
    await cancel.getByRole("button", { name: "Annuler la commande" }).click();
    await expect(page.getByText(/Motif : Paiement jamais reçu/).first()).toBeVisible();

    await page.getByLabel("Nouvelle note interne").fill("Cliente prévenue par téléphone.");
    await page.getByRole("button", { name: "Ajouter la note" }).click();
    await expect(page.getByText("Cliente prévenue par téléphone.").first()).toBeVisible();
  });
});

test.describe("Atelier — cockpit de fournée", () => {
  test("parcours en étapes, création depuis la fournée précédente, impression tracée", async ({ page }) => {
    test.slow();
    const admin = testPhone();
    await login(page, admin, "/admin");
    await grantAdmin(e164(admin));

    await page.goto("/admin/fournees/00000000-0000-4000-8000-000000000012");
    await waitForHydration(page);
    const steps = page.getByRole("navigation", { name: "Parcours de la fournée" });
    await expect(steps.locator('[aria-current="step"]')).toHaveCount(1);
    await expect(page.getByText("Étape 3 · Suivre les commandes")).toBeVisible();
    await expect(page.getByText("← vous êtes ici")).toBeVisible();
    await expect(page.getByText(/se fermeront automatiquement/)).toBeVisible();
    await expect(page.getByText("Étape 7 · Terminer")).toBeVisible();

    // Fiche de production : l'impression est tracée.
    await page.goto("/admin/fournees/00000000-0000-4000-8000-000000000012/production");
    await waitForHydration(page);
    await page.evaluate(() => {
      window.print = () => {};
    });
    await page.getByRole("button", { name: "Imprimer la fiche" }).click();
    await expect(page.getByText(/Dernière impression :/)).toBeVisible();

    // Nouvelle fournée depuis la n°12 : produits et créneaux repris, brouillon.
    await page.goto("/admin/fournees/nouvelle");
    await expect(page.getByRole("link", { name: /Reprendre la fournée n°12/ })).toBeVisible();
    await page.goto("/admin/fournees/nouvelle?depuis=00000000-0000-4000-8000-000000000012");
    await expect(page.getByRole("heading", { level: 1, name: "Nouvelle fournée depuis la n°12" })).toBeVisible();
    const number = String(1000 + Math.floor(Math.random() * 8000));
    await page.getByLabel("Numéro").fill(number);
    await page.getByRole("button", { name: "Créer la fournée (brouillon)" }).click();
    await expect(page.getByRole("heading", { level: 1, name: `Fournée n°${number} · Brouillon` })).toBeVisible();
    await expect(page.getByText("Au moins un produit proposé")).toBeVisible();
    await expect(page.locator("li", { hasText: "Au moins un produit proposé" })).toContainText("✓");
    await expect(page.locator("li", { hasText: "Au moins un créneau de retrait ou de livraison" })).toContainText("✓");
    await page.goto("/admin/journal");
    await expect(page.getByText("Fournée créée depuis la précédente").first()).toBeVisible();
  });
});
