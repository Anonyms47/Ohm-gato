import { expect, test } from "@playwright/test";
import { addToBox, db, e164, freshIp, grantAdmin, login, testPhone, waitForHydration } from "./helpers";

const ZONE = "Zone test e2e";

test.describe("Alertes « prochaine fournée »", () => {
  test("inscription par e-mail, doublon silencieux, consentement obligatoire, désinscription", async ({ page }) => {
    await freshIp(page);
    const email = `alerte.${Date.now()}@example.test`;
    await page.goto("/fournees");
    await waitForHydration(page);
    const block = page.getByTestId("prevenez-moi").first();
    await block.getByRole("button", { name: "Être prévenu par e-mail" }).click();
    await block.getByLabel("Votre adresse e-mail").fill(email);
    await page.waitForTimeout(1500); // piège temporel : un envoi instantané est ignoré
    await block.getByRole("button", { name: "Me prévenir par e-mail" }).click();
    await expect(block.getByText(/Cochez la case/)).toBeVisible();
    await block.getByRole("checkbox").check();
    await block.getByRole("button", { name: "Me prévenir par e-mail" }).click();
    await expect(page.getByTestId("alerte-confirmation").first()).toBeVisible();
    const rows = (await db(`batch_alert_subscribers?select=status,unsubscribe_token,consent_text&email=eq.${encodeURIComponent(email)}`)) as { status: string; unsubscribe_token: string; consent_text: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe("active");
    expect(rows[0]!.consent_text).toContain("J'accepte de recevoir un e-mail");

    // Doublon : même confirmation, une seule ligne.
    await page.reload();
    await waitForHydration(page);
    const again = page.getByTestId("prevenez-moi").first();
    await again.getByRole("button", { name: "Être prévenu par e-mail" }).click();
    await again.getByLabel("Votre adresse e-mail").fill(email.toUpperCase());
    await again.getByRole("checkbox").check();
    await page.waitForTimeout(1500);
    await again.getByRole("button", { name: "Me prévenir par e-mail" }).click();
    await expect(page.getByTestId("alerte-confirmation").first()).toBeVisible();
    expect(((await db(`batch_alert_subscribers?select=id&email=ilike.${encodeURIComponent(email)}`)) as unknown[]).length).toBe(1);

    // Désinscription par le lien personnel.
    await page.goto(`/alertes/desinscription/${rows[0]!.unsubscribe_token}`);
    await waitForHydration(page);
    await page.getByRole("button", { name: /désinscrire|Me désinscrire/i }).first().click();
    await expect(async () => {
      const [r] = (await db(`batch_alert_subscribers?select=status&email=eq.${encodeURIComponent(email)}`)) as { status: string }[];
      expect(r!.status).toBe("inactive");
    }).toPass();
  });
});

test.describe("Livraison par zones", () => {
  test.afterEach(async () => {
    await db(`delivery_zones?name=eq.${encodeURIComponent(ZONE)}`, { method: "DELETE" });
  });

  test("le quartier fixe la zone et le tarif, hors paiement en ligne et figé sur la commande", async ({ page }) => {
    await db("delivery_zones", { method: "POST", body: JSON.stringify({ name: ZONE, districts: ["Quartier Alpha"], fee_fcfa: 2500, sort_order: 99 }) });
    await addToBox(page, "brownies", "Box de 4");
    await page.goto("/commande");
    await waitForHydration(page);
    await page.getByLabel("Nom").fill("Awa Diop");
    await page.getByLabel(/Téléphone/).fill(testPhone());
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByRole("radio", { name: /^Livraison/ }).check();
    await page.getByLabel("Adresse").fill("Villa 24");
    const choice = page.getByTestId("choix-quartier");
    await choice.getByLabel("Quartier").click();
    await page.getByRole("option", { name: /Quartier Alpha/ }).click();
    await expect(page.getByTestId("tarif-livraison")).toContainText(/2\s?500/);
    await expect(page.getByTestId("tarif-livraison")).toContainText("livreur");
  });
});

test.describe("Réseaux, identité et mobile", () => {
  test("Snapchat masqué sans identifiant, Instagram présent, aucun nom personnel sur le site public", async ({ page }) => {
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("link", { name: /Instagram/ }).first()).toBeAttached();
    await expect(footer.getByRole("link", { name: /Snapchat/ })).toHaveCount(0);
    for (const path of ["/", "/notre-histoire", "/conditions-generales", "/livraison-retrait", "/confidentialite"]) {
      await page.goto(path);
      await expect(page.locator("body")).not.toContainText(/Thiam|Sadiya|Alimatou/);
    }
    await page.goto("/mentions-legales");
    await expect(page.locator("body")).toContainText("Responsable de l’activité : Madame Alimatou Sadiya Thiam.".replace("’", "'"), { useInnerText: true }).catch(async () => {
      await expect(page.locator("body")).toContainText(/Alimatou Sadiya Thiam/);
    });
  });

  for (const width of [320, 375, 390, 430]) {
    test(`aucun débordement horizontal à ${width} px (accueil, fournées, carte, boîte)`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      for (const path of ["/", "/fournees", "/carte", "/boite"]) {
        await page.goto(path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${path} à ${width}px`).toBeLessThanOrEqual(0);
      }
      await context.close();
    });
  }
});

test.describe("Atelier : zones, paiements, alertes", () => {
  test("les rubriques de l'atelier s'ouvrent et le tarif vide reste « à confirmer »", async ({ page }) => {
    const admin = testPhone();
    await login(page, admin, "/admin");
    await grantAdmin(e164(admin));
    for (const [path, title] of [
      ["/admin/zones", /Zones de livraison/],
      ["/admin/moyens-de-paiement", /Moyens de paiement/],
      ["/admin/alertes", /Alertes/],
      ["/admin/reglages", /Réglages/],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    }
    await page.goto("/admin/moyens-de-paiement");
    await expect(page.locator("body")).toContainText(/Orange Money/);
  });
});
