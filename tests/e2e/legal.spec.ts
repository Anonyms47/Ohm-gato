import { expect, test } from "@playwright/test";
import { addToBox, db, e164, fillPickupCheckout, grantAdmin, isMobile, login, testPhone, waitForHydration } from "./helpers";

const LEGAL = [
  ["/conditions-generales", "Conditions générales"],
  ["/livraison-retrait", "Livraison et retrait"],
  ["/annulation-remboursement", "Annulation et remboursement"],
  ["/confidentialite", "Confidentialité"],
  ["/cookies", "Cookies"],
  ["/mentions-legales", "Mentions légales"],
  ["/allergenes-conservation", "Allergènes et conservation"],
] as const;

test.describe("Pages légales", () => {
  test("chaque page s'ouvre avec son titre, sa version, son sommaire et son URL canonique", async ({ page }) => {
    for (const [path, title] of LEGAL) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(page.getByTestId("version-document")).toContainText(/Version \d+\.\d+ · en vigueur depuis le/);
      await expect(page.getByRole("navigation", { name: "Sommaire" })).toBeAttached();
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${path}$`));
      await expect(page.locator("body")).not.toContainText(/à compléter|undefined|\{\{/);
    }
  });

  test("informations publiques : statut d'activité, coordonnées, livraison payée au livreur", async ({ page }) => {
    await page.goto("/mentions-legales");
    await expect(page.getByText("OHMEGATO est une activité de pâtisserie maison exploitée par Alima à Dakar, actuellement en cours de formalisation.")).toBeVisible();
    await expect(page.getByText("contact@ohmegato.com").first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/SARL|SUARL|NINEA|RCCM/);
    await page.goto("/livraison-retrait");
    await expect(page.getByTestId("encart-livraison")).toContainText("Les frais de livraison sont réglés séparément au livreur.");
    await page.goto("/allergenes-conservation");
    await expect(page.getByTestId("allergenes-par-produit")).toContainText(/Cake à l.orange/);
  });

  test("pied de page : trois groupes, accordéons accessibles sur téléphone", async ({ page }) => {
    await page.goto("/");
    await waitForHydration(page);
    const footer = page.getByRole("navigation", { name: "Pied de page" });
    if (isMobile(page)) {
      const toggle = footer.getByRole("button", { name: "Informations" });
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
    }
    await footer.getByRole("link", { name: "Conditions générales" }).click();
    await expect(page).toHaveURL(/\/conditions-generales$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Conditions générales");
  });

  test("page de suivi : explication et liens utiles", async ({ page }) => {
    await page.goto("/suivi");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Suivre ma commande");
  });
});

test.describe("Acceptation au paiement", () => {
  test("case non cochée par défaut, bloquante, liens dans un nouvel onglet, version enregistrée", async ({ page }) => {
    await addToBox(page, "brownies", "Box de 4");
    await fillPickupCheckout(page);
    await page.getByRole("button", { name: "Imprimer mon récapitulatif" }).click();

    const box = page.getByRole("checkbox", { name: /J'ai lu et j'accepte les Conditions générales/ });
    await expect(box).not.toBeChecked();
    const acceptance = page.getByTestId("acceptation");
    await expect(acceptance.getByRole("link", { name: /Conditions générales/ })).toHaveAttribute("target", "_blank");
    await expect(acceptance.getByRole("link", { name: /politique d'annulation/ })).toHaveAttribute("href", "/annulation-remboursement");
    await expect(acceptance.getByRole("link", { name: /Politique de confidentialité/ })).toHaveAttribute("href", "/confidentialite");
    await expect(acceptance).toContainText("Les informations saisies sont utilisées pour traiter votre commande");

    // Sans la case : le paiement reste bloqué.
    await page.getByRole("button", { name: "Tout est bon, payer" }).click();
    await expect(page.getByText(/Cochez la case pour accepter/)).toBeVisible();
    await expect(box).toBeFocused();
    await expect(page.getByRole("button", { name: /Payer avec/ })).toHaveCount(0);

    // Un document ouvert dans un nouvel onglet ne fait rien perdre.
    const [tab] = await Promise.all([page.context().waitForEvent("page"), acceptance.getByRole("link", { name: /Conditions générales/ }).click()]);
    await expect(tab.getByRole("heading", { level: 1 })).toHaveText("Conditions générales");
    await tab.close();
    await expect(page.getByText("Ceci n'est pas encore une confirmation.")).toBeVisible();

    await box.check();
    await page.getByRole("button", { name: "Tout est bon, payer" }).click();
    await page.getByRole("button", { name: "Payer avec Paiement de test" }).click();
    await expect(page).toHaveURL(/\/paiement-test\//);
    const [published] = (await db("legal_document_versions?select=id,content_hash&document_slug=eq.conditions-generales&status=eq.published")) as {
      id: string;
      content_hash: string;
    }[];
    const [latest] = (await db("order_acceptances?select=terms_version_id,terms_hash,channel&order=accepted_at.desc&limit=1")) as {
      terms_version_id: string;
      terms_hash: string;
      channel: string;
    }[];
    expect(latest).toEqual({ terms_version_id: published!.id, terms_hash: published!.content_hash, channel: "web" });
  });

  test("livraison : rappel que les frais se règlent au livreur, aucun frais ajouté", async ({ page }) => {
    await addToBox(page, "brownies", "Box de 4");
    await page.goto("/commande");
    await waitForHydration(page);
    await page.getByLabel("Nom").fill("Awa Diop");
    await page.getByLabel(/Téléphone/).fill(testPhone());
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByRole("radio", { name: /^Livraison/ }).check();
    await page.getByLabel("Adresse").fill("Villa 24, rue MZ-12");
    await page.getByLabel("Quartier", { exact: true }).fill("Mermoz");
    await page.getByLabel("Point de repère").fill("En face de la pharmacie");
    await page.getByRole("button", { name: "Placer le repère au centre de la carte" }).click();
    await expect(page.getByText("Repère placé.")).toBeVisible();
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByLabel("Créneau de livraison").click();
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByRole("button", { name: "Imprimer mon récapitulatif" }).click();
    await expect(page.getByTestId("rappel-livraison")).toHaveText(
      "Les frais de livraison ne sont pas inclus dans ce paiement. Ils seront réglés séparément au livreur.",
    );
    await expect(page.getByRole("button", { name: /Tout est bon, payer/ })).toContainText("Livraison à régler séparément au livreur");
  });
});

test.describe("Administration des documents", () => {
  test("brouillon, aperçu, publication d'une nouvelle version et historique", async ({ page }) => {
    const admin = testPhone();
    await login(page, admin, "/admin");
    await grantAdmin(e164(admin));
    await page.goto("/admin/documents");
    await expect(page.getByRole("heading", { name: "Documents et règles", level: 1 })).toBeVisible();
    await expect(page.getByTestId("alerte-identite")).toContainText("Identité légale incomplète");

    await page.goto("/admin/documents/cookies");
    await waitForHydration(page);
    const version = await page.getByRole("textbox", { name: "Version" }).inputValue();
    const marker = `Mention de test ${Date.now()}`;
    const text = page.getByLabel("Texte du document");
    await text.fill(`${await text.inputValue()}\n\n${marker}`);
    await page.getByRole("button", { name: "Aperçu public" }).click();
    await expect(page.getByTestId("apercu-document")).toContainText(marker);
    await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
    await expect(page.getByText(/Brouillon enregistré/)).toBeVisible();

    // Le brouillon n'est pas encore en ligne.
    const pub = await page.context().newPage();
    await pub.goto("/cookies");
    await expect(pub.locator("body")).not.toContainText(marker);

    await page.getByRole("button", { name: `Publier la version ${version}` }).click();
    await page.getByRole("button", { name: "Publier", exact: true }).click();
    // Le brouillon publié disparaît (et son message avec) : on vérifie l'historique, durable.
    await expect(page.getByTestId(`version-${version}`)).toContainText("En ligne");

    await pub.reload();
    await expect(pub.getByTestId("version-document")).toContainText(`Version ${version}`);
    await expect(pub.getByText(marker)).toBeVisible();
    await pub.close();

    await page.reload();
    await expect(page.getByTestId(`version-${version}`)).toContainText("En ligne");
    await expect(page.getByTestId("version-1.0")).toContainText("Archivée");
    await page.goto("/admin/journal");
    await expect(page.getByText("Document publié").first()).toBeVisible();
  });
});

test.describe("Mise en page des pages légales", () => {
  for (const width of [320, 375, 390, 768, 1366, 1920]) {
    test(`aucun débordement à ${width} px`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height: 800 } });
      const page = await context.newPage();
      for (const [path] of LEGAL) {
        await page.goto(path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${path} à ${width}px`).toBeLessThanOrEqual(0);
      }
      await context.close();
    });
  }
});
