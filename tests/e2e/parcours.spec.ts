import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { addToBox, chooseFirstSlot, fillPickupCheckout, isMobile, localEnv, payWithTestProvider, testPhone } from "./helpers";

test.describe("Parcours complet : fournée → produit → Ma boîte → commande → paiement → suivi", () => {
  test("retrait payé : confirmation serveur, tampon PAYÉE et code de retrait", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("La fournée");
    await page.getByRole("link", { name: "Composer ma boîte" }).click();
    await expect(page).toHaveURL(/\/carte$/);

    await addToBox(page, "cookies", "Box de 6");
    await addToBox(page, "choux-creme", "Box de 5", { flavor: "Vanille" });

    await fillPickupCheckout(page);
    await payWithTestProvider(page);

    await page.getByRole("button", { name: "Simuler un paiement réussi" }).click();
    await expect(page).toHaveURL(/\/suivi\/[A-Za-z0-9_-]{43}\?retour=paiement/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("C'est noté.");
    await expect(page.getByText("Maintenant, à nous de cuisiner.")).toBeVisible();
    await expect(page.getByText("Payée", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Code de retrait")).toBeVisible();
    await expect(page.getByText(/4 500 FCFA/).first()).toBeVisible();

    // Ma boîte est vidée sur cet appareil après la confirmation.
    await page.goto("/ma-boite");
    await expect(page.getByText("Votre boîte est vide.")).toBeVisible();
  });

  test("paiement échoué : la commande est annulée et la boîte conservée", async ({ page }) => {
    await addToBox(page, "brownies", "Box de 10");
    await fillPickupCheckout(page);
    await payWithTestProvider(page);
    await page.getByRole("button", { name: "Simuler un échec" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Commande annulée");
    await page.goto("/ma-boite");
    await expect(page.getByRole("link", { name: "Brownies" })).toBeVisible();
  });

  test("retour sans payer puis reprise du paiement depuis le suivi", async ({ page }) => {
    await addToBox(page, "brownies", "Box de 4");
    await fillPickupCheckout(page);
    await payWithTestProvider(page);
    await page.getByRole("button", { name: /Revenir sans payer/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Paiement en attente");
    await page.getByRole("button", { name: "Reprendre avec Paiement de test" }).click();
    await expect(page).toHaveURL(/\/paiement-test\//);
    await page.getByRole("button", { name: "Simuler un paiement réussi" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("C'est noté.");
  });

  test("livraison : quartier, repère manuel et frais de zone", async ({ page }) => {
    await addToBox(page, "muffins-pepites", "Box de 6");
    await page.goto("/commande");
    await page.getByLabel("Nom").fill("Moussa Ndiaye");
    await page.getByLabel(/Téléphone/).fill(testPhone());
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByRole("radio", { name: /^Livraison dans Dakar/ }).check();

    await page.locator('[id="delivery.district"]').click();
    await page.getByPlaceholder("Rechercher un quartier…").fill("Mermoz");
    await page.getByRole("option", { name: /Mermoz/ }).click();
    await page.getByLabel("Adresse").fill("Villa 24, rue MZ-12");
    await page.getByRole("button", { name: "Continuer" }).click();

    await chooseFirstSlot(page, "Créneau de livraison");
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByRole("button", { name: "Imprimer mon récapitulatif" }).click();
    // Frais de la zone TEST B (1 500 FCFA) ajoutés au total.
    await expect(page.getByText(/4 000 FCFA/).first()).toBeVisible();
  });

  test("validation : messages précis, valeurs conservées, résumé des erreurs", async ({ page }) => {
    await addToBox(page, "cookies", "Unité");
    await page.goto("/commande");
    await page.getByLabel("Nom").fill("Awa");
    await page.getByLabel(/Téléphone/).fill("12345");
    await page.getByRole("button", { name: "Continuer" }).click();
    const summary = page.getByRole("alert").filter({ hasText: "Quelques informations sont à corriger" });
    await expect(summary).toBeVisible();
    await expect(summary).toContainText("numéro sénégalais");
    await expect(page.getByLabel("Nom")).toHaveValue("Awa");
    await page.getByLabel(/Téléphone/).fill("77 123 45 67");
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page.getByText("Comment récupérez-vous votre boîte ?")).toBeVisible();
  });
});

test.describe("Stock, fournée et disponibilités", () => {
  test("stock commun : la box de 4 verrines est indisponible avec 3 unités", async ({ page }) => {
    await page.goto("/carte/verrines-fruitees");
    const box = page.getByRole("radio", { name: /Box de 4/ });
    await expect(box).toBeDisabled();
    await expect(page.getByText("Plus assez de pièces").first()).toBeVisible();
  });

  test("parfum absent de la fournée : désactivé avec sa raison", async ({ page }) => {
    await page.goto("/carte/verrines-fruitees");
    await page.getByLabel("Parfum").click();
    const orange = page.getByRole("option", { name: /Orange/ });
    await expect(orange).toHaveAttribute("aria-disabled", "true");
    await expect(orange).toContainText("Pas dans cette fournée");
  });

  test("produit hors fournée : aucun ajout possible", async ({ page }) => {
    await page.goto("/carte/moelleux-pommes");
    await expect(page.getByText("Pas dans la fournée actuelle.").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^Ajouter ·/ })).toHaveCount(0);
  });

  test("informations non confirmées jamais affichées (conservation du cake)", async ({ page }) => {
    await page.goto("/carte/cake-orange");
    await expect(page.getByRole("heading", { name: "Conservation" })).toHaveCount(0);
    await page.goto("/carte/cookies");
    await expect(page.getByRole("heading", { name: "Conservation" })).toBeVisible();
  });
});

test.describe("Brouillons et reprise", () => {
  test("« Une boîte vous attendait » lors d'une nouvelle visite", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await addToBox(page, "cookies", "Box de 3");
    const state = await context.storageState();
    await context.close();

    // Nouvelle session : le localStorage est conservé, la session non.
    const next = await browser.newContext({ storageState: state });
    const page2 = await next.newPage();
    await page2.goto("/");
    await expect(page2.getByText("Une boîte vous attendait.")).toBeVisible();
    await page2.getByRole("button", { name: "Reprendre ma boîte" }).click();
    await expect(page2.getByText("Une boîte vous attendait.")).toHaveCount(0);
    await next.close();
  });
});

test.describe("Webhooks", () => {
  test("signature invalide refusée, webhook répété sans double effet", async ({ request }) => {
    const bad = await request.post("/api/payments/webhook/test", {
      headers: { "Content-Type": "application/json", "x-ohmegato-test-signature": "t=1,v1=00" },
      data: { id: "evt_faux", type: "checkout.paid", payment_id: "00000000-0000-4000-8000-000000000000", status: "paid", amount: 1 },
    });
    expect(bad.status()).toBe(401);

    const secret = localEnv("PAYMENT_TEST_WEBHOOK_SECRET");
    const body = JSON.stringify({
      id: `evt_inconnu_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type: "checkout.paid",
      payment_id: "00000000-0000-4000-8000-000000000000",
      status: "paid",
      amount: 100,
    });
    const t = Math.floor(Date.now() / 1000);
    const signature = `t=${t},v1=${createHmac("sha256", secret).update(`${t}${body}`).digest("hex")}`;
    const headers = { "Content-Type": "application/json", "x-ohmegato-test-signature": signature };
    const first = await request.post("/api/payments/webhook/test", { headers, data: body });
    expect((await first.json()).outcome).toBe("unknown_payment");
    const second = await request.post("/api/payments/webhook/test", { headers, data: body });
    expect((await second.json()).outcome).toBe("duplicate");
  });

  test("création de commande refusée sans origine (CSRF)", async ({ request }) => {
    const response = await request.post("/api/orders", { headers: { "Content-Type": "application/json" }, data: {} });
    expect(response.status()).toBe(403);
  });
});

test.describe("Mise en page et accessibilité", () => {
  for (const path of ["/", "/carte", "/carte/verrines-fruitees", "/ma-boite", "/commande"]) {
    test(`aucun défilement horizontal : ${path}`, async ({ page }) => {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test("petit téléphone (320 px) et zoom 200 % : aucun débordement", async ({ browser }) => {
    for (const viewport of [{ width: 320, height: 640 }, { width: 640, height: 400 }]) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
      const page = await context.newPage();
      for (const path of ["/", "/carte", "/commande"]) {
        await page.goto(path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${path} à ${viewport.width}px`).toBeLessThanOrEqual(0);
      }
      await context.close();
    }
  });

  test("liste déroulante : ouverture, flèches, sélection et Échap au clavier", async ({ page }) => {
    test.skip(isMobile(page), "Sur téléphone, la liste s'ouvre en feuille depuis le bas.");
    await page.goto("/carte/choux-creme");
    const trigger = page.getByLabel("Parfum");
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(trigger).toContainText(/Vanille|Chocolat/);
  });

  test("feuille mobile : sélection puis fermeture", async ({ page }) => {
    test.skip(!isMobile(page), "Feuille réservée aux téléphones.");
    await page.goto("/carte/choux-creme");
    // Après hydratation, le déclencheur ouvre une feuille (aria-haspopup="dialog").
    const trigger = page.getByLabel("Parfum").first();
    await expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    await trigger.click();
    await expect(page.getByRole("dialog", { name: "Parfum" })).toBeVisible();
    await page.getByRole("option", { name: /Chocolat/ }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByLabel("Parfum").first()).toContainText("Chocolat");
  });

  test("animations réduites : le récapitulatif s'imprime sans animation", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await addToBox(page, "cookies", "Unité");
    await fillPickupCheckout(page);
    await page.getByRole("button", { name: "Imprimer mon récapitulatif" }).click();
    await expect(page.getByText("Ceci n'est pas encore une confirmation.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Passer l'animation" })).toHaveCount(0);
    await context.close();
  });
});
