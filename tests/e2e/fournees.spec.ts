import { expect, test } from "@playwright/test";
import { addToBox, db, e164, grantAdmin, login, testPhone, waitForHydration } from "./helpers";

const CYCLE = "00000000-0000-4000-8000-000000000012";
const PREORDER_CLOSED =
  "Les précommandes sont terminées. La production est en préparation. Des produits supplémentaires pourront être proposés après la livraison des commandes confirmées.";
const SURPLUS =
  "Vous avez raté la précommande ? Quelques douceurs de la fournée sont encore disponibles. Commande possible dans la limite du stock réellement restant.";

async function cycleRow() {
  const [row] = (await db(`production_cycles?select=status,closes_at,surplus_ends_at&id=eq.${CYCLE}`)) as {
    status: string;
    closes_at: string;
    surplus_ends_at: string | null;
  }[];
  return row!;
}
async function patchCycle(values: Record<string, unknown>) {
  await db(`production_cycles?id=eq.${CYCLE}`, { method: "PATCH", body: JSON.stringify(values) });
}

test.describe("Fournées : précommande, clôture et surplus", () => {
  test("précommandes ouvertes : message officiel, frise en quatre moments, bouton adapté", async ({ page }) => {
    await page.goto("/fournees");
    await expect(page.getByTestId("message-fournee")).toContainText(/^Commandez avant le .+ à \d{2} h \d{2}\. Votre commande sera préparée pendant la semaine/);
    const frise = page.getByRole("list", { name: "Les quatre moments de la fournée" });
    await expect(frise.getByRole("listitem")).toHaveCount(4);
    await expect(frise.getByText("Alima prépare votre fournée")).toBeVisible();
    await expect(frise.getByText("Les douceurs restantes peuvent revenir en stock")).toBeVisible();
    await expect(frise.locator('[aria-current="step"]')).toHaveCount(1);
    // Frise verticale sur téléphone et petite tablette, horizontale à partir de 768 px.
    const columns = await frise.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
    expect(columns).toBe((page.viewportSize()?.width ?? 1200) >= 768 ? 4 : 1);
    await expect(page.getByRole("link", { name: "Composer ma boîte" }).first()).toBeVisible();
    await page.goto("/nos-fournees");
    await expect(page).toHaveURL(/\/fournees$/);
    await page.goto("/fournees/12");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fournée n°12");
  });

  test("date limite passée : précommande refusée, boîte conservée, aucun faux surplus", async ({ page }) => {
    const before = await cycleRow();
    await addToBox(page, "cookies", "Unité");
    try {
      await patchCycle({ closes_at: new Date(Date.now() - 60_000).toISOString() });
      await page.goto("/fournees");
      await expect(page.getByText("Précommandes clôturées").first()).toBeVisible();
      await expect(page.getByTestId("message-fournee")).toHaveText(PREORDER_CLOSED);
      await expect(page.getByText("Revenez après la fournée pour vérifier les disponibilités.")).toBeVisible();
      await expect(page.getByRole("button", { name: /Prévenez-moi/ })).toHaveCount(0);
      await page.goto("/commande");
      await waitForHydration(page);
      await expect(page.getByTestId("commande-fermee")).toContainText("Les précommandes sont terminées");
      await expect(page.getByTestId("commande-fermee")).toContainText("Votre boîte est conservée");
      // Côté serveur : la précommande est refusée même si le navigateur insiste.
      const response = await page.request.post("/api/orders", {
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
        data: { idempotencyKey: crypto.randomUUID() },
      });
      expect(response.status()).toBe(422);
    } finally {
      await patchCycle({ closes_at: before.closes_at });
    }
  });

  test("surplus publié : message, quantité réelle restante, retrait seul, puis fin de fournée", async ({ page }) => {
    const before = await cycleRow();
    try {
      await patchCycle({ status: "surplus", surplus_ends_at: new Date(Date.now() + 3 * 86400_000).toISOString(), surplus_delivery_allowed: false });
      await page.goto("/fournees");
      await expect(page.getByText("Surplus disponible").first()).toBeVisible();
      await expect(page.getByTestId("message-fournee")).toHaveText(SURPLUS);
      await expect(page.getByRole("link", { name: "Voir les douceurs disponibles" })).toBeVisible();
      await expect(page.getByText(/^En surplus : \d+ cookies$/)).toBeVisible();
      await expect(page.getByText("Presque épuisé")).toHaveCount(0);
      await expect(page.getByText(/Commandes tardives : retrait uniquement/)).toBeVisible();

      await patchCycle({ surplus_ends_at: new Date(Date.now() - 60_000).toISOString() });
      await page.goto("/fournees");
      await expect(page.getByTestId("message-fournee")).toHaveText(
        "Cette fournée est terminée. Consultez Nos fournées pour découvrir la prochaine ouverture.",
      );
      await expect(page.getByRole("link", { name: "Découvrir les prochaines fournées" })).toBeVisible();
    } finally {
      await patchCycle({ status: before.status, surplus_ends_at: before.surplus_ends_at });
    }
  });

  test("administration : synthèse de la demande, production, surplus et fiche imprimable", async ({ page }) => {
    const admin = testPhone();
    await login(page, admin, "/admin");
    await grantAdmin(e164(admin));
    await page.goto(`/admin/fournees/${CYCLE}`);
    await waitForHydration(page);
    await expect(page.getByRole("heading", { name: "Synthèse de la demande" })).toBeVisible();
    const table = page.getByTestId("synthese-demande");
    await expect(table.getByRole("columnheader", { name: "Paiement à vérifier" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Publié en surplus" })).toBeVisible();
    await expect(table.getByRole("rowheader", { name: "Cookies" })).toBeVisible();
    // Fournée ouverte : la production réelle se saisit après la clôture, aucun surplus publiable.
    await expect(page.getByRole("heading", { name: "Production" })).toBeVisible();
    await expect(page.getByTestId("publication-surplus")).toHaveCount(0);
    await page.goto(`/admin/fournees/${CYCLE}/production`);
    await expect(page.getByTestId("fiche-production").getByRole("rowheader", { name: /Cookies/ })).toBeVisible();
  });
});
