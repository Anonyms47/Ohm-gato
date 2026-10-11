import { expect, test } from "@playwright/test";
import { acceptTermsAndContinue, addToBox, db, e164, fillPickupCheckout, freshIp, grantAdmin, isMobile, login, payWithTestProvider, testPhone, waitForHydration } from "./helpers";

test.describe("Nos fournées — le journal du four", () => {
  test("fournée, dates, produits et ajout direct à Ma boîte", async ({ page }) => {
    await page.goto("/fournees");
    await waitForHydration(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nos fournées");
    await expect(page.getByText("Précommandes ouvertes").first()).toBeVisible();
    await expect(page.getByText("Date limite de commande")).toBeVisible();
    await expect(page.getByText("Livraison et retrait").first()).toBeVisible();
    // Précommande sans limite de quantité : aucun « reste » affiché.
    await expect(page.getByText(/^Reste \d+ cookies$/)).toHaveCount(0);
    await expect(page.getByText("Pas encore de date programmée.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Les fournées passées" })).toBeVisible();
    const cookies = page.locator("li").filter({ has: page.getByRole("heading", { name: "Cookies" }) });
    // Le choix du format s'ouvre à la demande, puis l'ajout reste direct.
    await cookies.getByText("Choisir le format").click();
    await cookies.getByRole("button", { name: /^Ajouter ·/ }).click();
    await expect(cookies.getByRole("button", { name: "Ajouté à Ma boîte" })).toBeVisible();
  });
});

test.describe("Notre histoire", () => {
  test("Oumy Gâteau → OHMEGATO → Ω, le café présenté comme un projet", async ({ page }) => {
    await page.goto("/notre-histoire");
    await expect(page.getByText("Oumy Gâteau, devenu OHMEGATO, puis Ω.")).toBeAttached();
    await expect(page.getByText(/troisième année à l'ESP/)).toBeVisible();
    await expect(page.getByText(/n'existe pas encore/)).toBeVisible();
    // Aucun emplacement vide : citation, photos et audio absents tant qu'ils ne sont pas fournis.
    await expect(page.locator("blockquote")).toHaveCount(0);
    await expect(page.locator("audio")).toHaveCount(0);
  });
});

test.describe("Retrouvons votre carnet — connexion par code", () => {
  test("code incorrect, essais restants puis bon code : carnet ouvert", async ({ page }) => {
    const phone = testPhone();
    await freshIp(page);
    await page.goto("/connexion");
    await waitForHydration(page);
    await page.getByLabel("Numéro de téléphone").fill(phone);
    await page.getByRole("button", { name: "Recevoir mon code" }).click();
    await expect(page.getByText(/Code envoyé à/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Renvoyer le code \(dans/ })).toBeDisabled();
    const code = /(\d{6})/.exec((await page.getByTestId("code-test").textContent()) ?? "")![1]!;
    await page.getByLabel("Code reçu").fill(code === "000000" ? "111111" : "000000");
    await page.getByRole("button", { name: "Ouvrir mon carnet" }).click();
    await expect(page.getByText(/Ce code ne correspond pas\. Encore 4 essais\./)).toBeVisible();
    await page.getByLabel("Code reçu").fill(code);
    await page.getByRole("button", { name: "Ouvrir mon carnet" }).click();
    await expect(page.getByText("Votre carnet est ouvert.")).toBeVisible();
    await page.getByLabel(/Comment vous appeler/).fill("Awa Diop");
    await page.getByRole("button", { name: "Enregistrer et ouvrir mon carnet" }).click();
    await expect(page).toHaveURL(/\/compte$/);
    await expect(page.getByText("Bonjour Awa")).toBeVisible();
  });

  test("code expiré puis trop de tentatives", async ({ page }) => {
    const phone = testPhone();
    await freshIp(page);
    await page.goto("/connexion");
    await waitForHydration(page);
    await page.getByLabel("Numéro de téléphone").fill(phone);
    await page.getByRole("button", { name: "Recevoir mon code" }).click();
    await expect(page.getByTestId("code-test")).toBeVisible();
    // Le code a été demandé il y a 11 minutes.
    const old = new Date(Date.now() - 11 * 60 * 1000).toISOString();
    const rows = (await db("otp_requests?select=id&order=created_at.desc&limit=1")) as { id: string }[];
    await db(`otp_requests?id=eq.${rows[0]!.id}`, { method: "PATCH", body: JSON.stringify({ created_at: old }) });
    await page.getByLabel("Code reçu").fill("123456");
    await page.getByRole("button", { name: "Ouvrir mon carnet" }).click();
    await expect(page.getByText("Ce code a expiré. Demandez-en un nouveau.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Recevoir un nouveau code" })).toBeVisible();

    await db(`otp_requests?id=eq.${rows[0]!.id}`, { method: "PATCH", body: JSON.stringify({ created_at: new Date().toISOString(), failed_attempts: 4 }) });
    await page.getByLabel("Code reçu").fill("999999");
    await page.getByRole("button", { name: "Recevoir un nouveau code" }).isVisible();
    await page.evaluate(() => (document.querySelector("form") as HTMLFormElement).requestSubmit());
    await expect(page.getByText(/Trop de codes incorrects|Ce code ne correspond pas/)).toBeVisible();
  });

  test("commande invitée retrouvée après connexion avec le même numéro", async ({ page }) => {
    await addToBox(page, "cookies", "Unité");
    await page.goto("/commande");
    await waitForHydration(page);
    const phone = testPhone();
    await page.getByLabel("Nom").fill("Fatou Sow");
    await page.getByLabel(/Téléphone/).fill(phone);
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByRole("radio", { name: /^Retrait/ }).check();
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByLabel("Créneau de retrait").click();
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByRole("button", { name: "Continuer" }).click();
    await payWithTestProvider(page);
    await page.getByRole("button", { name: "Simuler un paiement réussi" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("C'est noté.");

    await login(page, phone);
    await expect(page.getByText(/Nous avons retrouvé 1 commande/)).toBeVisible();
  });
});

test.describe("Mon carnet OHMEGATO", () => {
  test("commande active, ticket, détail, recomposition et profil", async ({ page }) => {
    const phone = testPhone();
    await login(page, phone);
    await page.getByRole("button", { name: "Ouvrir mon carnet" }).click();
    await expect(page).toHaveURL(/\/compte$/);

    // Une commande passée connectée apparaît en priorité.
    await addToBox(page, "brownies", "Box de 4");
    await fillPickupCheckout(page);
    await payWithTestProvider(page);
    await page.getByRole("button", { name: "Simuler un paiement réussi" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("C'est noté.");
    await page.goto("/compte");
    await expect(page.getByRole("heading", { name: "Commande en cours" })).toBeVisible();
    await expect(page.getByText("Commande confirmée").first()).toBeVisible();

    await page.goto("/compte/commandes");
    await page.getByRole("link", { name: /Voir le détail/ }).first().click();
    await expect(page.getByRole("heading", { name: "Paiements" })).toBeVisible();
    await expect(page.getByText(/Paiement de test/)).toBeVisible();
    await waitForHydration(page);
    await page.getByRole("button", { name: "Recomposer cette boîte" }).click();
    await expect(page.getByText(/Ajouté à Ma boîte : Brownies/)).toBeVisible();

    await page.goto("/compte/profil");
    await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible();
    await expect(page.getByText("cet appareil")).toBeVisible();
    await waitForHydration(page);
    await page.getByLabel("Me prévenir quand une nouvelle fournée ouvre").check();
    await page.getByRole("button", { name: "Enregistrer mes préférences" }).click();
    await expect(page.getByText("Préférences enregistrées.")).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Télécharger mes données (JSON)" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^ohmegato-mes-donnees-/);
  });

  test("produit préféré et suppression du compte", async ({ page }) => {
    await login(page, testPhone(), "/carte/cookies");
    await page.getByRole("button", { name: "Ouvrir mon carnet" }).click();
    await expect(page).toHaveURL(/\/carte\/cookies$/);
    await waitForHydration(page);
    await page.getByRole("button", { name: "Garder en préféré" }).click();
    await expect(page.getByRole("button", { name: /est dans vos préférés/ })).toBeVisible();
    await page.goto("/compte/profil#preferes");
    await expect(page.locator("#preferes").getByRole("link", { name: "Cookies" })).toBeVisible();

    await waitForHydration(page);
    await page.getByRole("button", { name: "Supprimer mon compte" }).click();
    await page.getByLabel("Écrivez SUPPRIMER pour confirmer").fill("SUPPRIMER");
    await page.getByRole("button", { name: "Supprimer définitivement mon compte" }).click();
    await expect(page).toHaveURL(/\/\?compte=supprime/);
    await page.goto("/compte");
    await expect(page).toHaveURL(/\/connexion/);
  });

  test("navigation mobile du carnet : Accueil, Commandes, Ma boîte, Profil", async ({ page }) => {
    test.skip(!isMobile(page), "Barre du bas réservée aux téléphones.");
    await login(page, testPhone());
    await page.getByRole("button", { name: "Ouvrir mon carnet" }).click();
    const nav = page.getByRole("navigation", { name: "Navigation du carnet" });
    for (const label of ["Accueil", "Commandes", "Profil"]) await expect(nav.getByRole("link", { name: label })).toBeVisible();
    await expect(nav.getByRole("button", { name: /Ma boîte/ })).toBeVisible();
  });
});

test.describe("Sur-mesure & Événements", () => {
  test("carnet conversationnel → demande → proposition d'OHMEGATO → acceptation → paiement", async ({ page, browser }) => {
    await freshIp(page);
    await page.goto("/sur-mesure");
    await waitForHydration(page);
    const next = () => page.getByRole("button", { name: /^(Continuer|Passer cette étape)$/ }).click();

    await next();
    await expect(page.getByText("Choisissez le type d'occasion.").first()).toBeVisible();
    await page.getByRole("radio", { name: "Anniversaire" }).check();
    await next();
    const date = new Date(Date.now() + 6 * 86400 * 1000).toISOString().slice(0, 10);
    await page.getByLabel("Date").fill(date);
    await page.getByLabel("Heure souhaitée").click();
    await page.getByRole("option", { name: "16 h 00" }).click();
    await next();
    await page.getByLabel("Nombre de personnes").fill("25");
    await next();
    await page.getByRole("checkbox", { name: "Verrines" }).check();
    await page.getByRole("checkbox", { name: "Création à discuter" }).check();
    await next();
    await page.getByLabel("Quantité").first().fill("25");
    await page.getByLabel("Quantité").nth(1).fill("1");
    await page.getByLabel("Votre idée").fill("Un gâteau en forme de 30");
    await next();
    await page.getByLabel("Ambiance, couleurs, thème").fill("Rose et crème");
    await next();
    await next(); // inspiration facultative
    await next(); // budget facultatif
    await page.getByRole("radio", { name: /Retrait gratuit/ }).check();
    await next();
    const phone = testPhone();
    await page.getByLabel("Nom").fill("Mariama Ba");
    await page.getByLabel(/^Téléphone/).fill(phone);
    await next();
    await expect(page.getByText("Ceci est une")).toBeVisible();
    await page.getByRole("button", { name: "Envoyer ma demande à OHMEGATO" }).click();
    await expect(page).toHaveURL(/\/sur-mesure\/suivi\/[A-Za-z0-9_-]{43}\?envoyee=1/);
    await expect(page.getByText("Reçue").first()).toBeVisible();
    await expect(page.getByText(/Une demande n'est pas une commande confirmée/)).toBeVisible();
    const trackingUrl = page.url();

    // Un autre navigateur avec le même lien ne voit pas les échanges.
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto(trackingUrl);
    await expect(otherPage.getByText(/Pour protéger vos informations/)).toBeVisible();
    await other.close();

    await page.getByLabel("Votre message").fill("Est-ce possible sans gluten ?");
    await page.getByRole("button", { name: "Envoyer le message" }).click();
    await expect(page.getByText("Est-ce possible sans gluten ?")).toBeVisible();

    // OHMEGATO fixe le prix.
    const [request] = (await db(`custom_requests?select=id&customer_phone=eq.${encodeURIComponent(e164(phone))}`)) as { id: string }[];
    await db("rpc/add_custom_proposal", {
      method: "POST",
      body: JSON.stringify({ p_request_id: request!.id, p_body: "25 verrines et un gâteau 30", p_lines: [], p_total_fcfa: 52000, p_valid_until: null, p_actor: null }),
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Proposition n°1" })).toBeVisible();
    await page.getByRole("button", { name: /Accepter et payer 52 000 FCFA/ }).click();
    await expect(page).toHaveURL(/\/suivi\//);
    await expect(page.getByText("52 000 FCFA").first()).toBeVisible();
  });
});

test.describe("Administration d'Alima", () => {
  test("accès refusé à un client, ouvert à l'administratrice", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/connexion\?suite=/);
    const phone = testPhone();
    await login(page, phone, "/admin");
    await page.getByRole("button", { name: "Ouvrir mon carnet" }).click();
    await expect(page.getByRole("heading", { name: "Accès réservé" })).toBeVisible();

    await grantAdmin(e164(phone));
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
    await expect(page.getByText("Fournée active")).toBeVisible();
  });

  test("commande : statut, historique et livraison sur la carte", async ({ page }) => {
    // Commande livrée avec position.
    await addToBox(page, "cookies", "Box de 3");
    await page.goto("/commande");
    await waitForHydration(page);
    await page.getByLabel("Nom").fill("Ibrahima Fall");
    await page.getByLabel(/Téléphone/).fill(testPhone());
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByRole("radio", { name: /^Livraison dans Dakar/ }).check();
    await page.getByLabel("Adresse").fill("Villa 12, rue 10");
    await page.getByLabel("Quartier", { exact: true }).fill("Mermoz");
    await page.getByLabel("Point de repère").fill("En face de la pharmacie");
    await page.getByLabel("Qui réceptionne ?").fill("Ibrahima Fall");
    await page.getByLabel("Son numéro").fill(testPhone());
    await page.getByRole("application").click({ position: { x: 120, y: 100 } });
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByLabel("Créneau de livraison").click();
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByRole("button", { name: "Continuer" }).click();
    await payWithTestProvider(page);
    await page.getByRole("button", { name: "Simuler un paiement réussi" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("C'est noté.");

    const admin = testPhone();
    await login(page, admin, "/admin/commandes");
    await grantAdmin(e164(admin));
    await page.goto("/admin/commandes?q=Ibrahima");
    await page.getByRole("link", { name: /^OHM12-/ }).first().click();
    await expect(page.getByRole("heading", { name: "Position exacte" })).toBeVisible();
    const reference = (await page.getByText(/^OHM12-\d{4,}$/).first().textContent())!.trim();
    await expect(page.getByRole("link", { name: "Ouvrir l'itinéraire" })).toBeVisible();
    await waitForHydration(page);
    for (const label of ["Passer en préparation", "Marquer prête"]) {
      await page.getByRole("button", { name: label }).click();
      await expect(page.getByText("Statut mis à jour.")).toBeVisible();
    }
    await expect(page.getByText(/Prête · par/)).toBeVisible();

    await page.goto("/admin/livraisons");
    await waitForHydration(page);
    await page.getByRole("button", { name: new RegExp(reference) }).click();
    await page.getByRole("textbox", { name: /^Livreur/ }).fill("Modou");
    // Chaque bouton disparaît dès que la commande change d'étape (son message avec lui) :
    // on vérifie donc l'étape atteinte plutôt que le message éphémère.
    await page.getByRole("button", { name: "Confier au livreur" }).click();
    await expect(page.getByRole("button", { name: "Livraison terminée" })).toBeVisible();
    await page.getByRole("button", { name: "Livraison terminée" }).click();
    await page.getByRole("button", { name: "Oui, livrée" }).click();
    await expect(page.getByRole("button", { name: "Livraison terminée" })).toHaveCount(0);
    await expect(page.getByText("Livrée", { exact: true }).first()).toBeVisible();
  });

  test("fournée : création en brouillon, stock et journal d'audit", async ({ page }) => {
    const admin = testPhone();
    await login(page, admin, "/admin");
    await grantAdmin(e164(admin));
    await page.goto("/admin/fournees/nouvelle");
    await waitForHydration(page);
    const number = String(100 + Math.floor(Math.random() * 800));
    await page.getByLabel("Numéro").fill(number);
    await page.getByLabel("Ouverture des commandes").fill("2030-01-10T09:00");
    await page.getByLabel("Date limite de précommande").fill("2030-01-12T18:00");
    await page.getByLabel("Début de la période de production").fill("2030-01-13");
    await page.getByLabel("Jour principal de livraison et de retrait").fill("2030-01-14");
    await page.getByRole("button", { name: "Créer la fournée (brouillon)" }).click();
    await expect(page.getByRole("heading", { name: new RegExp(`Fournée n°${number}`) })).toBeVisible();
    await waitForHydration(page);
    await page.getByRole("button", { name: "Ouvrir les commandes" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Ouvrir les commandes" }).click();
    await expect(page.getByText(/Une autre fournée est déjà ouverte|Ajoutez au moins un produit/).first()).toBeVisible();
    await page.goto("/admin/journal");
    await expect(page.getByText("Fournée créée").first()).toBeVisible();
  });
});

test.describe("Mise en page des nouvelles pages", () => {
  const pages = ["/fournees", "/sur-mesure", "/notre-histoire", "/connexion"];
  for (const viewport of [
    { width: 320, height: 640 },
    { width: 740, height: 360 },
    { width: 1920, height: 1080 },
    { width: 640, height: 400 },
  ]) {
    test(`aucun débordement à ${viewport.width}×${viewport.height}`, async ({ browser }) => {
      const context = await browser.newContext({ viewport, deviceScaleFactor: viewport.width === 640 ? 2 : 1 });
      const page = await context.newPage();
      for (const path of pages) {
        await page.goto(path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${path}`).toBeLessThanOrEqual(0);
      }
      await context.close();
    });
  }
});

test.describe("Paiement par lien Wave", () => {
  test("commande confirmée au choix de Wave, « Payée » seulement après enregistrement par OHMEGATO", async ({ page }) => {
    await addToBox(page, "cake-orange", "4 tranches");
    await fillPickupCheckout(page);
    await page.getByRole("button", { name: "Imprimer mon récapitulatif" }).click();
    await acceptTermsAndContinue(page);
    await page.getByRole("button", { name: "Payer avec Wave" }).click();
    await expect(page).toHaveURL(/\/suivi\/[A-Za-z0-9_-]{43}\?retour=wave/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Commande confirmée");
    const panel = page.getByTestId("paiement-wave");
    await expect(panel).toContainText("1 000 FCFA");
    const link = panel.getByRole("link", { name: /Payer 1 000 FCFA avec Wave/ });
    await expect(link).toHaveAttribute("href", /^https:\/\/pay\.wave\.com\/m\/.+amount=1000/);
    await expect(page.getByText("Payée", { exact: true })).toHaveCount(0);
    const reference = (await page.getByText(/^Commande OHM12-/).first().textContent())!.replace("Commande ", "").trim();
    const trackingUrl = page.url().replace(/\?.*$/, "");

    // Ma boîte est vidée : la commande est passée.
    await page.goto("/ma-boite");
    await expect(page.getByText("Votre boîte est vide.")).toBeVisible();

    // OHMEGATO constate le paiement.
    const admin = testPhone();
    await login(page, admin, "/admin");
    await grantAdmin(e164(admin));
    await page.goto("/admin");
    await expect(page.getByText(/Paiements Wave à vérifier/)).toBeVisible();
    await page.getByRole("link", { name: reference }).first().click();
    await waitForHydration(page);
    await page.getByLabel(/Référence de la transaction Wave/).fill("TX-123");
    await page.getByRole("button", { name: "Paiement Wave reçu" }).click();
    await page.getByRole("button", { name: "Oui, paiement reçu" }).click();
    await expect(page.getByText("Paiement enregistré : la commande est payée.")).toBeVisible();

    await page.goto(trackingUrl);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("C'est noté.");
  });
});
