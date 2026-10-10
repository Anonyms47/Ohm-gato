import { expect, test } from "@playwright/test";
import { addToBox, db, e164, grantAdmin, login, testPhone, waitForHydration } from "./helpers";

const NOTICE =
  "Les produits sont préparés dans un environnement artisanal. En cas d’allergie sévère, contactez OHMEGATO avant de commander afin que la faisabilité de votre commande puisse être vérifiée.";
const PRODUCTS = ["muffins-pepites", "brownies", "moelleux-chocolat", "moelleux-pommes", "cookies", "cake-orange", "verrines-fruitees", "choux-creme"];

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
    await expect(
      brownies.getByText("Préparé sans ajout direct de lait. D’autres ingrédients, comme le chocolat, peuvent contenir du lait ou des traces de lait."),
    ).toBeVisible();
    await expect(page.getByText("préparés sans ajout direct de lait et présentés en petits carrés").first()).toBeVisible();

    await page.goto("/carte/choux-creme");
    const choux = page.getByTestId("allergenes");
    await expect(choux.getByText("Parfum vanille")).toBeVisible();
    await expect(choux.getByText("Parfum chocolat")).toBeVisible();
    await expect(choux.getByText("Contient de la crème pâtissière et de la vanille.")).toHaveCount(1);
    await expect(choux.getByText("Contient de la crème pâtissière et du chocolat.")).toHaveCount(1);
    await expect(choux.getByText("Allergènes : gluten, œufs et lait.")).toHaveCount(2);
  });

  test("informations confirmées par Alima : descriptions, conservation, aucune fausse garantie", async ({ page }) => {
    const descriptions: Record<string, string> = {
      "muffins-pepites": "préparés avec des pépites de chocolat et une légère note de cannelle",
      "moelleux-chocolat": "recouvert d’une sauce chocolat fondante et de pépites de chocolat",
      "moelleux-pommes": "un fond de lamelles de pommes caramélisées",
      cookies: "garnis de chocolat noir et de chocolat au lait concassés",
      "cake-orange": "à base de gâteau au yaourt",
      "verrines-fruitees": "Les parfums déjà réalisés sont la fraise, l’orange et la mangue.",
      "choux-creme": "Des choux garnis de crème pâtissière, proposés à la vanille ou au chocolat.",
    };
    const storage: Record<string, RegExp> = {
      "muffins-pepites": /boîte hermétique à température ambiante et à consommer sous 2 jours/,
      brownies: /température ambiante et à consommer sous 2 jours\. Gardez-les bien emballés\./,
      "moelleux-chocolat": /au réfrigérateur et à consommer sous 2 jours/,
      "moelleux-pommes": /au réfrigérateur et à consommer sous 2 jours/,
      cookies: /légèrement réchauffés avant dégustation/,
      "cake-orange": /jusqu'à une semaine.*Réfrigération recommandée en cas de forte chaleur/,
      "verrines-fruitees": /au réfrigérateur et à consommer sous 2 jours/,
      "choux-creme": /au réfrigérateur et à consommer sous 2 jours/,
    };
    for (const slug of PRODUCTS) {
      await page.goto(`/carte/${slug}`);
      const main = page.locator("main");
      if (descriptions[slug]) await expect(main.getByText(descriptions[slug]!, { exact: false }).first()).toBeVisible();
      await expect(main.getByText(storage[slug]!).first()).toBeVisible();
      await expect(main).not.toContainText(/sans lactose|sans produits laitiers|Déduit de la recette|Confirmé par Alima|soja|arachide|sésame|fruits à coque/i);
    }
    await page.goto("/allergenes-conservation");
    await expect(page.getByTestId("version-document")).toContainText("Version 1.1");
    await expect(page.locator("main")).not.toContainText(/sans lactose|sans produits laitiers/i);
    await expect(
      page.getByText("Respectez la chaîne du froid pour les produits contenant de la crème, une sauce ou des fruits. Ne consommez pas un produit présentant une odeur, une texture ou un aspect anormal."),
    ).toBeVisible();
    await expect(page.getByTestId("allergenes-par-produit")).toContainText("Contient du yaourt et de l’orange.");
  });

  test("boîte mélangée : union des parfums, avertissement dans Ma boîte et sur le sur-mesure", async ({ page }) => {
    await addToBox(page, "choux-creme", "Box de 5", { flavor: "Vanille" });
    await addToBox(page, "choux-creme", "Box de 5", { flavor: "Chocolat" });
    await page.goto("/ma-boite");
    const box = page.getByTestId("allergenes-boite");
    await expect(box.getByText("Choux à la crème (vanille, chocolat)")).toBeVisible();
    await expect(box.getByText(/Contient de la crème pâtissière, (de la vanille et du chocolat|du chocolat et de la vanille)\./)).toBeVisible();
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
    await expect(preview.getByText("Contient du yaourt et de l’orange.")).toBeVisible();
    await expect(editor.getByText("Vérification d’emballage nécessaire").first()).toBeVisible();
    await expect(editor.getByTestId("allergene-produit-lait").getByTestId("provenance")).toHaveText("Confirmé par Alima le 10/10/2026 · confirmation vocale");

    // Rien ne dépasse de l'écran du téléphone, même avec les longs libellés.
    const viewport = page.viewportSize()!;
    expect(await page.evaluate(() => window.innerWidth)).toBe(viewport.width);
    await editor.getByRole("button", { name: "Ajouter une information de recette" }).click();
    await editor.getByLabel("Contient…").last().fill("de la vanille");
    await expect(preview.getByText("Contient du yaourt, de l’orange et de la vanille.")).toBeVisible();
    await editor.getByRole("button", { name: "Enregistrer les allergènes" }).click();
    await expect(page.getByText("Allergènes enregistrés.")).toBeVisible();

    await page.goto("/carte/cake-orange");
    await expect(page.getByTestId("allergenes").getByText("Contient du yaourt, de l’orange et de la vanille.")).toBeVisible();
    // L'indicateur interne n'apparaît jamais côté client.
    await expect(page.getByTestId("allergenes")).not.toContainText("Déduit de la recette");

    // Remise en état pour les autres parcours.
    await page.goto(`/admin/produits/${cake!.id}`);
    await waitForHydration(page);
    await expect(editor.getByLabel("Contient…")).toHaveCount(3);
    await editor.getByRole("button", { name: "Retirer" }).last().click();
    await expect(preview.getByText("Contient du yaourt et de l’orange.")).toBeVisible();
    await editor.getByRole("button", { name: "Enregistrer les allergènes" }).click();
    await expect(page.getByText("Allergènes enregistrés.")).toBeVisible();
    // La confirmation d'Alima est conservée après l'enregistrement, et l'historique garde les anciennes valeurs.
    await page.reload();
    await expect(editor.getByTestId("allergene-produit-lait").getByTestId("provenance")).toHaveText("Confirmé par Alima le 10/10/2026 · confirmation vocale");
    const history = (await db(`product_allergen_history?select=reason&product_id=eq.${cake!.id}`)) as { reason: string }[];
    expect(history.map((h) => h.reason)).toContain("Modification dans l’administration");

    // Filtre par état de vérification : compteur recalculé, jamais forcé à zéro.
    await page.goto("/admin/produits");
    await expect(page.getByTestId("compteur-a-verifier")).toContainText("33 informations « à vérifier »");
    await page.getByRole("link", { name: /^Confirmé par Alima \(\d+\)$/ }).click();
    await expect(page.getByTestId("liste-verification")).toContainText("Cake à l’orange · Tout le produit · Lait et produits laitiers : Contient");
    await page.getByRole("link", { name: /^À vérifier sur l’emballage \(33\)$/ }).click();
    await expect(page.getByTestId("liste-verification")).toContainText("Brownies · Tout le produit · Soja : À vérifier");

    // (avertissement « React.Fragment » préexistant, venant d'une bibliothèque, ignoré ici)
    expect(errors.filter((e) => !e.includes("Failed to load resource") && !e.includes("React.Fragment"))).toEqual([]);
  });
});
