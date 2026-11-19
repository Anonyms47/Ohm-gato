import { expect, test } from "@playwright/test";
import { acceptTermsAndContinue, addToBox, db, e164, fillPickupCheckout, grantAdmin, login, testPhone, waitForHydration } from "./helpers";

const CYCLE = "00000000-0000-4000-8000-000000000012";
const SURPLUS =
  "Vous avez raté la précommande ? Quelques douceurs de la fournée sont encore disponibles. Commande possible dans la limite du stock réellement restant.";

async function cycleRow() {
  const [row] = (await db(`production_cycles?select=status,closes_at,production_date,fulfillment_date,surplus_ends_at&id=eq.${CYCLE}`)) as {
    status: string;
    closes_at: string | null;
    production_date: string;
    fulfillment_date: string;
    surplus_ends_at: string | null;
  }[];
  return row!;
}
async function patchCycle(values: Record<string, unknown>) {
  await db(`production_cycles?id=eq.${CYCLE}`, { method: "PATCH", body: JSON.stringify(values) });
}

test.describe("Fournées : commandes permanentes et surplus", () => {
  test("commandes ouvertes : message officiel, frise en quatre moments, bouton adapté", async ({ page }) => {
    await page.goto("/fournees");
    await expect(page.getByTestId("message-fournee").filter({ visible: true })).toContainText(/^Vous pouvez commander à tout moment\. Votre commande sera préparée (pendant la semaine|le )/);
    const frise = page.getByRole("list", { name: "Les quatre moments de la fournée" });
    await expect(frise.getByRole("listitem")).toHaveCount(4);
    await expect(frise.getByText("L’atelier prépare votre fournée")).toBeVisible();
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

  test("ancienne date limite dépassée : la commande reste possible, aucune fermeture", async ({ page }) => {
    const before = await cycleRow();
    try {
      await patchCycle({ closes_at: new Date(Date.now() - 3 * 86400_000).toISOString() });
      await page.goto("/fournees");
      await expect(page.getByText("Commandes ouvertes").first()).toBeVisible();
      await expect(page.getByText(/Commandes fermées|Précommandes clôturées|terminées/)).toHaveCount(0);
      await addToBox(page, "cookies", "Unité");
      await fillPickupCheckout(page);
      await page.getByRole("button", { name: "Imprimer mon récapitulatif" }).click();
      await acceptTermsAndContinue(page);
      await page.getByRole("button", { name: "Payer avec Paiement de test" }).click();
      await expect(page).toHaveURL(/\/paiement-test\//);
    } finally {
      await patchCycle({ closes_at: before.closes_at });
    }
  });

  test("sans date de remise à venir : on commande quand même, la date est communiquée par OHMEGATO", async ({ page }) => {
    const before = await cycleRow();
    const counts = async () => [
      ((await db(`orders?select=id&cycle_id=eq.${CYCLE}`)) as unknown[]).length,
      ((await db("payments?select=id")) as unknown[]).length,
    ];
    // Boîte remplie et bon complété tant que la date de remise est valide.
    await addToBox(page, "cookies", "Unité");
    await fillPickupCheckout(page);
    await page.getByRole("button", { name: "Imprimer mon récapitulatif" }).click();
    await acceptTermsAndContinue(page);
    const start = await counts();
    try {
      // Le calendrier passe pendant que la cliente est sur la page : la page chargée avant le changement est refusée
      // proprement (rien d'enregistré), puis une page rechargée propose la commande sans fournée.
      await patchCycle({ production_date: "2020-01-01", fulfillment_date: "2020-01-02" });
      await page.getByRole("button", { name: "Payer avec Paiement de test" }).click();
      await expect(page.getByText(/Les dates de la fournée viennent de changer : cette commande n'a pas été enregistrée/)).toBeVisible();
      await expect(page).toHaveURL(/\/commande$/);
      expect(await counts()).toEqual(start);
      expect((await cycleRow()).status).toBe("open");

      await page.goto("/fournees");
      await expect(page.getByText("Dates à annoncer").first()).toBeVisible();
      await expect(page.getByTestId("message-fournee").filter({ visible: true })).toContainText("Vous pouvez commander quand même");
      await expect(page.getByText(/Commandes fermées|Précommandes clôturées/)).toHaveCount(0);
      // Boîte et validation restent accessibles, sans créneau.
      await page.goto("/ma-boite");
      await waitForHydration(page);
      await expect(page.getByText("Cookies").first()).toBeVisible();
      await expect(page.getByTestId("commande-sans-fournee")).toContainText("OHMEGATO vous communique la date");
      await expect(page.getByRole("link", { name: "Continuer ma commande" }).first()).toBeVisible();
      await fillPickupCheckout(page);
      await expect(page.getByTestId("type-commande")).toContainText("OHMEGATO vous communique la date");
      await page.getByRole("button", { name: "Imprimer mon récapitulatif" }).click();
      await acceptTermsAndContinue(page);
      await page.getByRole("button", { name: "Payer avec Paiement de test" }).click();
      await expect(page).toHaveURL(/\/paiement-test\//);
      // Commande enregistrée sans fournée ni créneau : la date reste à communiquer.
      const [order] = (await db("orders?select=id,cycle_id,slot_id,order_kind,fulfillment_date_snapshot,reference&order=created_at.desc&limit=1")) as {
        id: string;
        cycle_id: string | null;
        slot_id: string | null;
        order_kind: string;
        fulfillment_date_snapshot: string | null;
        reference: string;
      }[];
      expect(order).toMatchObject({ cycle_id: null, slot_id: null, order_kind: "on_demand", fulfillment_date_snapshot: null });
      expect(order!.reference).toMatch(/^OHM-\S{5}$/);
    } finally {
      await patchCycle({ production_date: before.production_date, fulfillment_date: before.fulfillment_date });
    }
  });

  test("surplus publié : message, quantité réelle restante, retrait seul, puis fin de fournée", async ({ page }) => {
    const before = await cycleRow();
    try {
      await patchCycle({ status: "surplus", surplus_ends_at: new Date(Date.now() + 3 * 86400_000).toISOString(), surplus_delivery_allowed: false });
      await page.goto("/fournees");
      await expect(page.getByText("Surplus disponible").first()).toBeVisible();
      await expect(page.getByTestId("message-fournee").filter({ visible: true })).toHaveText(SURPLUS);
      await expect(page.getByRole("link", { name: "Voir les douceurs disponibles" })).toBeVisible();
      await expect(page.getByText(/^En surplus : \d+ cookies$/)).toBeVisible();
      await expect(page.getByText("Presque épuisé")).toHaveCount(0);
      await expect(page.getByText(/Commandes tardives : retrait uniquement/)).toBeVisible();

      await patchCycle({ surplus_ends_at: new Date(Date.now() - 60_000).toISOString() });
      await page.goto("/fournees");
      await expect(page.getByTestId("message-fournee").filter({ visible: true })).toHaveText(
        "Cette fournée est terminée. Vous pouvez commander quand même : OHMEGATO vous communique la date de livraison ou de retrait. Consultez Nos fournées pour découvrir la prochaine ouverture.",
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
    // Fournée ouverte : la production réelle se saisit une fois la fournée passée en production, aucun surplus publiable.
    await expect(page.getByRole("heading", { name: "Production" })).toBeVisible();
    await expect(page.getByTestId("publication-surplus")).toHaveCount(0);
    await page.goto(`/admin/fournees/${CYCLE}/production`);
    await expect(page.getByTestId("fiche-production").getByRole("rowheader", { name: /Cookies/ })).toBeVisible();
  });
});
