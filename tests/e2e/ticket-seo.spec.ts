import { expect, test, type Page } from "@playwright/test";
import { addToBox, fillPickupCheckout, waitForHydration } from "./helpers";

/** Boîte d'un cookie, coordonnées et réception remplies : on arrive à l'étape « Vérification ». */
async function jusqueVerification(page: Page) {
  await addToBox(page, "cookies", "Unité");
  await fillPickupCheckout(page);
  await expect(page.getByRole("heading", { name: /Vérification/ })).toBeVisible();
}

const ticket = (page: Page) => page.getByTestId("ticket-recapitulatif");

async function contenuLisible(page: Page) {
  const t = ticket(page);
  await expect(t).toBeVisible();
  await expect(t).toContainText("1 × Cookies");
  await expect(t).toContainText("Total produits à payer en ligne");
  await expect(t).toContainText("Ceci n'est pas encore une confirmation.");
  // Le tampon ne recouvre aucune ligne du ticket.
  const tampon = await t.getByText("À vérifier", { exact: true }).boundingBox();
  const ligne = await t.getByText("1 × Cookies").boundingBox();
  expect(tampon && ligne && tampon.y + tampon.height <= ligne.y + 1).toBe(true);
  // Le ticket tient dans la largeur de l'écran.
  const box = await t.boundingBox();
  const vw = page.viewportSize()!.width;
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(vw + 1);
}

test.describe("Ticket de l'étape Vérification", () => {
  test("l'impression descend puis le ticket reste affiché, lisible et dans l'écran", async ({ page }) => {
    await jusqueVerification(page);
    await expect(ticket(page)).toBeHidden();
    await page.getByRole("button", { name: "Imprimer mon récapitulatif" }).click();
    await expect(ticket(page)).toHaveAttribute("data-phase", "printed", { timeout: 4000 });
    await contenuLisible(page);
    // Ramené dans l'écran, au-dessus de la barre fixe.
    await expect(ticket(page)).toBeInViewport();
    // La commande n'est pas bloquée.
    await expect(page.getByRole("checkbox", { name: /J'ai lu et j'accepte les Conditions générales/ })).toBeVisible();
  });

  test("animation en échec : le ticket est affiché sans attendre", async ({ page }) => {
    await jusqueVerification(page);
    // Aucune animation ne peut démarrer : le ticket doit quand même apparaître vite et complet.
    await page.addStyleTag({ content: "[data-testid=ticket-recapitulatif]{animation:none !important}" });
    await page.getByRole("button", { name: "Imprimer mon récapitulatif" }).click();
    await expect(ticket(page)).toHaveAttribute("data-phase", "printed", { timeout: 1500 });
    await contenuLisible(page);
  });

  test("« Passer l'animation » affiche le ticket tout de suite", async ({ page }) => {
    await jusqueVerification(page);
    await page.getByRole("button", { name: "Imprimer mon récapitulatif" }).click();
    await page.getByRole("button", { name: "Passer l'animation" }).click();
    await expect(ticket(page)).toHaveAttribute("data-phase", "printed");
    await contenuLisible(page);
  });

  test("retour à une étape puis retour à la vérification : le ticket reste affiché", async ({ page }) => {
    await jusqueVerification(page);
    await page.getByRole("button", { name: "Imprimer mon récapitulatif" }).click();
    await expect(ticket(page)).toHaveAttribute("data-phase", "printed", { timeout: 4000 });
    await page.getByRole("button", { name: "Modifier" }).first().click();
    // Retour à la première étape, puis on repasse par chacune jusqu'à la vérification.
    for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Continuer" }).first().click();
    // Même boîte : le récapitulatif déjà imprimé revient directement, sans rejouer l'animation.
    await expect(ticket(page)).toHaveAttribute("data-phase", "printed");
    await contenuLisible(page);
  });

  test("à l'impression du navigateur, le ticket est présent sans l'imprimante ni les barres fixes", async ({ page }) => {
    await jusqueVerification(page);
    await page.emulateMedia({ media: "print" });
    await expect(ticket(page)).toBeVisible();
    await expect(ticket(page)).toContainText("Total produits à payer en ligne");
  });
});

test.describe("Ticket avec animations réduites", () => {
  test.use({ reducedMotion: "reduce" });
  test("récapitulatif statique immédiatement accessible, sans bouton ni animation", async ({ page }) => {
    await jusqueVerification(page);
    await waitForHydration(page);
    await expect(ticket(page)).toHaveAttribute("data-phase", "printed");
    await expect(page.getByRole("button", { name: "Imprimer mon récapitulatif" })).toHaveCount(0);
    await contenuLisible(page);
  });
});

test.describe("Référencement et textes", () => {
  for (const chemin of ["/", "/carte", "/carte/cookies", "/notre-histoire", "/sur-mesure", "/fournees", "/conditions-generales", "/allergenes-conservation"]) {
    test(`canonical présent et sans paramètre : ${chemin}`, async ({ page }) => {
      await page.goto(`${chemin}?utm_source=test&vue=liste`);
      const href = await page.locator('link[rel="canonical"]').getAttribute("href");
      expect(href).toBeTruthy();
      const url = new URL(href!);
      expect(url.pathname.replace(/\/$/, "") || "/").toBe(chemin);
      expect(url.search).toBe("");
    });
  }

  for (const chemin of ["/connexion", "/commande", "/ma-boite", "/compte", "/suivi/jeton-inconnu"]) {
    test(`page privée en noindex : ${chemin}`, async ({ page }) => {
      await page.goto(chemin);
      await expect(page.locator('head meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    });
  }

  test("accueil : livraison à la date confirmée pour la commande", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("À la date confirmée pour votre commande", { exact: false }).first()).toBeAttached();
    await expect(page.locator("body")).not.toContainText("le jour prévu de la fournée");
  });

  test("allergènes : plus de phrase sur des traces « en cours de vérification »", async ({ page }) => {
    await page.goto("/allergenes-conservation");
    await expect(page.locator("body")).not.toContainText("restent en cours de vérification");
    await expect(page.locator("body")).not.toContainText("ne sont pas affichées tant qu'elles ne sont pas contrôlées");
  });
});
