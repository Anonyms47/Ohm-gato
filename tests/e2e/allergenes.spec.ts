import { expect, test } from "@playwright/test";
import { addToBox, db, e164, grantAdmin, login, testPhone, waitForHydration } from "./helpers";

const NOTICE =
  "Vous avez une allergie ou une intolérance ? Contactez OHMEGATO avant de commander afin de vérifier la composition du produit et les risques éventuels liés à sa préparation.";

test.describe("Allergènes", () => {
  test("fiches : allergènes, information de recette et avertissement, rien d'inventé", async ({ page }) => {
    await page.goto("/carte/cookies");
    const cookies = page.getByTestId("allergenes");
    await expect(cookies.getByText("Allergènes : gluten, œufs et lait.")).toBeVisible();
    await expect(cookies.getByText("Contient du chocolat noir et du chocolat au lait.")).toBeVisible();
    await expect(cookies.getByText(NOTICE)).toBeVisible();
    await expect(cookies).not.toContainText("soja");
    await expect(cookies).not.toContainText("traces");

    await page.goto("/carte/brownies");
    const brownies = page.getByTestId("allergenes");
    await expect(brownies.getByText("Allergènes : gluten et œufs.")).toBeVisible();
    await expect(brownies.getByText("Contient du chocolat.")).toBeVisible();
    await expect(brownies.getByText("Préparé sans lait ajouté, mais non garanti sans lactose ni sans traces de lait.")).toBeVisible();

    await page.goto("/carte/choux-creme");
    const choux = page.getByTestId("allergenes");
    await expect(choux.getByText("Parfum vanille")).toBeVisible();
    await expect(choux.getByText("Parfum chocolat")).toBeVisible();
    await expect(choux.getByText("Contient du chocolat.")).toHaveCount(1);
    await expect(choux.getByText("Allergènes : gluten, œufs et lait.")).toHaveCount(2);
  });

  test("boîte mélangée : union des parfums, avertissement dans Ma boîte et sur le sur-mesure", async ({ page }) => {
    await addToBox(page, "choux-creme", "Box de 5", { flavor: "Vanille" });
    await addToBox(page, "choux-creme", "Box de 5", { flavor: "Chocolat" });
    await page.goto("/ma-boite");
    const box = page.getByTestId("allergenes-boite");
    await expect(box.getByText("Choux à la crème (vanille, chocolat)")).toBeVisible();
    await expect(box.getByText("Contient du chocolat.")).toBeVisible();
    await expect(box.getByText(NOTICE)).toBeVisible();

    await page.goto("/sur-mesure");
    await expect(page.getByText(NOTICE)).toBeVisible();
  });

  test("administration : modification, aperçu exact puis affichage client", async ({ page }) => {
    test.slow(); // connexion, deux passages dans l'admin et la fiche client
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    const [cake] = (await db("products?select=id&slug=eq.cake-orange")) as { id: string }[];
    const admin = testPhone();
    await login(page, admin, "/admin");
    await grantAdmin(e164(admin));
    await page.goto(`/admin/produits/${cake!.id}`);
    await waitForHydration(page);
    const editor = page.getByTestId("editeur-allergenes");
    const preview = editor.getByTestId("apercu-allergenes");
    await expect(preview.getByText("Allergènes : gluten, œufs et lait.")).toBeVisible();
    await expect(preview.getByText("Contient de l’orange.")).toBeVisible();
    await expect(editor.getByText("Vérification d’emballage nécessaire").first()).toBeVisible();

    // Rien ne dépasse de l'écran du téléphone, même avec les longs libellés.
    const viewport = page.viewportSize()!;
    expect(await page.evaluate(() => window.innerWidth)).toBe(viewport.width);
    await editor.getByRole("button", { name: "Ajouter une information de recette" }).click();
    await editor.getByLabel("Contient…").last().fill("de la vanille");
    await expect(preview.getByText("Contient de l’orange et de la vanille.")).toBeVisible();
    await editor.getByRole("button", { name: "Enregistrer les allergènes" }).click();
    await expect(page.getByText("Allergènes enregistrés.")).toBeVisible();

    await page.goto("/carte/cake-orange");
    await expect(page.getByTestId("allergenes").getByText("Contient de l’orange et de la vanille.")).toBeVisible();
    // L'indicateur interne n'apparaît jamais côté client.
    await expect(page.getByTestId("allergenes")).not.toContainText("Déduit de la recette");

    // Remise en état pour les autres parcours.
    await page.goto(`/admin/produits/${cake!.id}`);
    await waitForHydration(page);
    await expect(editor.getByLabel("Contient…")).toHaveCount(2);
    await editor.getByRole("button", { name: "Retirer" }).last().click();
    await expect(preview.getByText("Contient de l’orange.")).toBeVisible();
    await editor.getByRole("button", { name: "Enregistrer les allergènes" }).click();
    await expect(page.getByText("Allergènes enregistrés.")).toBeVisible();
    // (avertissement « React.Fragment » préexistant, venant d'une bibliothèque, ignoré ici)
    expect(errors.filter((e) => !e.includes("Failed to load resource") && !e.includes("React.Fragment"))).toEqual([]);
  });
});
