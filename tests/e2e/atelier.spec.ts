import { expect, test } from "@playwright/test";
import { acceptTermsAndContinue, addToBox, db, e164, fillPickupCheckout, freshIp, grantAdmin, localEnv, login, testPhone, waitForHydration } from "./helpers";

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
    // Le badge « Insight » des outils de développement de Next recouvre la barre du bas : absent en production.
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
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
      for (const path of ["/admin", "/admin/paiements", "/admin/actions", "/admin/aide", "/admin/commandes", "/admin/chiffres?periode=tout"]) {
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
  // Adresse distincte : ces commandes ne doivent pas épuiser la limite par adresse des autres tests.
  await freshIp(page);
  await addToBox(page, "cookies", "Box de 3");
  await fillPickupCheckout(page);
  await confirmCheckout(page);
  await page.getByRole("button", { name: "Payer avec Paiement de test" }).click();
  await expect(page).toHaveURL(/\/paiement-test\//);
  await page.getByRole("button", { name: "Simuler un paiement réussi" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("C'est noté.");
  return (await page.getByText(/^Commande OHM12-/).first().textContent())!.replace("Commande ", "").trim();
}

/** Annule une commande de test (stock rendu) pour ne pas peser sur les autres parcours. */
async function cancelTestOrder(reference: string) {
  const [order] = (await db(`orders?select=id&reference=eq.${reference}`)) as { id: string }[];
  await db("rpc/admin_set_order_status", { method: "POST", body: JSON.stringify({ p_order_id: order!.id, p_status: "cancelled", p_note: "Test terminé", p_actor: null }) });
}

/** Commande au retrait « payer avec Wave » (paiement à vérifier) ; renvoie sa référence. */
async function waveOrder(page: import("@playwright/test").Page): Promise<string> {
  await freshIp(page);
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

    await page.locator("summary", { hasText: /^Notes internes/ }).click(); // section repliée
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
    await expect(page.getByRole("link", { name: /Reprendre la fournée n°12 ·/ })).toBeVisible();
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

test.describe("Atelier — chiffres", () => {
  test("résumé des ventes : seules les commandes payées comptent, par produit et par fournée", async ({ page }) => {
    test.slow();
    const reference = await paidPickupOrder(page);
    const [order] = (await db(`orders?select=total_fcfa&reference=eq.${reference}`)) as { total_fcfa: number }[];
    const wave = await waveOrder(page); // paiement Wave non vérifié : jamais compté dans le total
    const admin = testPhone();
    await login(page, admin, "/admin");
    await grantAdmin(e164(admin));

    await page.goto("/admin/chiffres?periode=tout");
    await expect(page.getByRole("heading", { level: 1, name: "Chiffres" })).toBeVisible();
    const paid = (await db("orders?select=total_fcfa&payment_status=eq.paid")) as { total_fcfa: number }[];
    const refunds = (await db("order_refunds?select=amount_fcfa")) as { amount_fcfa: number }[];
    const expected = paid.reduce((s, o) => s + o.total_fcfa, 0) - refunds.reduce((s, r) => s + r.amount_fcfa, 0);
    const digits = (text: string | null) => Number((text ?? "").replace(/\D/g, ""));
    expect(digits(await page.getByTestId("chiffres-net").textContent())).toBe(expected);
    expect(order!.total_fcfa).toBeGreaterThan(0);
    await expect(page.getByRole("region", { name: "Par produit" }).getByRole("rowheader", { name: "Cookies" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Par fournée" }).getByText("Fournée n°12")).toBeVisible();
    await expect(page.getByText(/paiements? Wave à vérifier/)).toBeVisible();

    // Accessible depuis le menu « Le reste » (panneau « Plus » sur petit écran).
    await page.goto("/admin");
    await waitForHydration(page);
    if ((page.viewportSize()?.width ?? 1200) < 1024) {
      await page.getByRole("navigation", { name: "Accès rapides" }).getByRole("button", { name: "Plus" }).click();
      await page.getByRole("dialog", { name: "Toutes les rubriques" }).getByRole("link", { name: "Chiffres" }).click();
    } else {
      // Groupe « Le reste », replié par défaut.
      const menu = page.getByRole("navigation", { name: "Administration" });
      await menu.getByRole("button", { name: "Le reste" }).click();
      await menu.getByRole("link", { name: "Chiffres", exact: true }).click();
    }
    await expect(page).toHaveURL(/\/admin\/chiffres/);
    await cancelTestOrder(wave);
    await cancelTestOrder(reference);
  });
});

test.describe("Atelier — automatisations", () => {
  test("état des e-mails : test de connexion, message en pause repris une seule fois, commande sans e-mail", async ({ page }) => {
    test.slow();
    const reference = await paidPickupOrder(page);
    const [order] = (await db(`orders?select=id&reference=eq.${reference}`)) as { id: string }[];
    const admin = testPhone();
    await login(page, admin, "/admin");
    await grantAdmin(e164(admin));

    // Sans e-mail : rien à envoyer, ce n'est pas une panne.
    await page.goto(`/admin/commandes/${order!.id}`);
    await expect(page.getByTestId("sans-email")).toContainText("Aucun e-mail fourni");
    expect(((await db(`email_outbox?select=id&order_id=eq.${order!.id}`)) as unknown[]).length).toBe(0);

    // Un message mis en pause par une erreur de configuration.
    const email = `pause-${Date.now()}@example.com`;
    const key = `e2e:held:${Date.now()}`;
    await db(`orders?id=eq.${order!.id}`, { method: "PATCH", body: JSON.stringify({ customer_email: email }) });
    await db("email_outbox", {
      method: "POST",
      body: JSON.stringify({ idempotency_key: key, template: "payment_confirmed", order_id: order!.id, to_email: email, status: "held", attempts: 1, error_category: "key_invalid", last_error: "La clé Brevo n'est pas reconnue" }),
    });

    await page.goto("/admin/notifications");
    await waitForHydration(page);
    const block = page.getByRole("region", { name: "État des e-mails" });
    await expect(block.getByText(/En pause : [1-9]/)).toBeVisible();
    // Codes de connexion (SMTP Supabase) suivis à part, sans aucun secret.
    await expect(block.getByTestId("etat-codes-connexion")).toContainText("SMTP de connexion");
    await expect(block).not.toContainText(/xkeysib|xsmtpsib|api-key/i);
    await block.getByRole("button", { name: "Tester la connexion" }).click();
    await expect(block.getByText("Mode test : aucun service réel n'est utilisé ici.")).toBeVisible();

    const issue = block.getByRole("listitem").filter({ hasText: reference });
    await expect(issue).toContainText("La clé Brevo n'est pas reconnue");
    await issue.getByRole("checkbox").check();
    await block.getByRole("button", { name: "Réessayer les messages sélectionnés" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Renvoyer" }).click();

    // Envoyé une seule fois, même ligne, même clé d'idempotence.
    const sent = () => db(`test_messages?select=body&channel=eq.email&destination=eq.${encodeURIComponent(email)}`) as Promise<{ body: string }[]>;
    await expect.poll(async () => (await sent()).length, { timeout: 20_000 }).toBe(1);
    const rows = (await db(`email_outbox?select=status,idempotency_key,attempts&order_id=eq.${order!.id}`)) as { status: string; idempotency_key: string; attempts: number }[];
    expect(rows).toEqual([{ status: "sent", idempotency_key: key, attempts: 2 }]);
    await page.getByRole("button", { name: "Mettre l'atelier à jour maintenant" }).click();
    await expect(page.getByText(/Atelier à jour/)).toBeVisible();
    expect((await sent()).length).toBe(1);
    await cancelTestOrder(reference);
  });

  test("état des e-mails réservé à l'équipe", async ({ page }) => {
    await login(page, testPhone(), "/compte");
    await page.goto("/admin/notifications");
    await expect(page.getByRole("heading", { name: "Accès réservé" })).toBeVisible();
    await expect(page.getByText("État des e-mails")).toHaveCount(0);
  });

  test("e-mail facultatif à la commande : « commande enregistrée » envoyé sans passage par l'atelier", async ({ page }) => {
    await freshIp(page);
    await addToBox(page, "cake-orange", "4 tranches");
    await page.goto("/commande");
    await waitForHydration(page);
    const email = `sans-compte-${Date.now()}@example.com`;
    await page.getByLabel("Nom").fill("Awa Diop");
    await page.getByLabel(/Téléphone/).fill(testPhone());
    await page.getByLabel("E-mail (facultatif)").fill("pas-une-adresse");
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page.getByText("Cette adresse e-mail n'est pas valide.").first()).toBeVisible();
    await page.getByLabel("E-mail (facultatif)").fill(email);
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByRole("radio", { name: /^Retrait/ }).check();
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByLabel("Créneau de retrait").click();
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.getByRole("button", { name: "Continuer" }).click();
    await confirmCheckout(page);
    await page.getByRole("button", { name: "Payer avec Wave" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Commande confirmée");
    const reference = (await page.getByText(/^Commande OHM12-/).first().textContent())!.replace("Commande ", "").trim();

    // Aucune visite de l'atelier : l'e-mail part juste après la commande (boîte de test hors production).
    const messages = () => db(`test_messages?select=body&channel=eq.email&destination=eq.${encodeURIComponent(email)}`) as Promise<{ body: string }[]>;
    await expect.poll(async () => (await messages()).length, { timeout: 20_000 }).toBe(1);
    expect((await messages())[0]!.body).toMatch(/enregistrée/i);
    await cancelTestOrder(reference);
  });

  test("e-mail transactionnel envoyé une seule fois (boîte de test), notifications, réglages et passage planifié protégé", async ({ page, playwright }) => {
    test.slow();
    const reference = await paidPickupOrder(page);
    const [order] = (await db(`orders?select=id&reference=eq.${reference}`)) as { id: string }[];
    const email = `cliente-${Date.now()}@example.com`;
    await db(`orders?id=eq.${order!.id}`, { method: "PATCH", body: JSON.stringify({ customer_email: email }) });

    const admin = testPhone();
    await login(page, admin, "/admin");
    await grantAdmin(e164(admin));
    await page.goto(`/admin/commandes/${order!.id}`);
    await waitForHydration(page);
    await page.getByRole("button", { name: "Passer en préparation" }).click();
    await expect(page.getByText("Statut mis à jour.")).toBeVisible();

    // L'e-mail part juste après l'action, dans la boîte de test (aucun envoi réel hors production).
    await expect
      .poll(async () => ((await db(`test_messages?select=body&channel=eq.email&destination=eq.${encodeURIComponent(email)}`)) as { body: string }[]).length, { timeout: 20_000 })
      .toBe(1);
    const [message] = (await db(`test_messages?select=body&channel=eq.email&destination=eq.${encodeURIComponent(email)}`)) as { body: string }[];
    expect(message!.body).toContain(`${reference} : en préparation`);

    // Mise à jour manuelle : idempotente, aucun second e-mail pour la même étape.
    await page.goto("/admin/notifications");
    await waitForHydration(page);
    await page.getByRole("button", { name: "Mettre l'atelier à jour maintenant" }).click();
    await expect(page.getByText(/Atelier à jour/)).toBeVisible();
    await page.getByRole("button", { name: "Mettre l'atelier à jour maintenant" }).click();
    expect(((await db(`test_messages?select=body&channel=eq.email&destination=eq.${encodeURIComponent(email)}`)) as unknown[]).length).toBe(1);
    const outbox = (await db(`email_outbox?select=status&order_id=eq.${order!.id}`)) as { status: string }[];
    expect(outbox.filter((o) => o.status === "sent").length).toBe(outbox.length);

    // Notifications : actions réelles, menant à l'élément concerné.
    await page.reload();
    await expect(page.getByText(/informations allergènes restent à vérifier/).first()).toBeVisible();
    await expect(page.getByText(/mode test/)).toBeVisible();

    // Réglages des délais : enregistrés et journalisés.
    await page.goto("/admin/reglages#automatisations");
    await waitForHydration(page);
    await page.getByLabel("Paiement Wave en attente (heures)").fill("24");
    await page.getByRole("button", { name: "Enregistrer les réglages" }).click();
    await expect(page.getByText("Réglages des automatisations enregistrés.")).toBeVisible();

    // Passage planifié : refusé sans le secret.
    const anonymous = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
    expect([401, 503]).toContain((await anonymous.get("/api/cron/atelier")).status());
    expect([401, 503]).toContain((await anonymous.get("/api/cron/atelier", { headers: { Authorization: "Bearer faux-secret-0000000000" } })).status());
    // Avec le secret : deux passages de suite ne créent rien en double.
    const auth = { Authorization: `Bearer ${localEnv("CRON_SECRET")}` };
    const first = await anonymous.get("/api/cron/atelier", { headers: auth });
    expect(first.status()).toBe(200);
    const second = (await (await anonymous.get("/api/cron/atelier", { headers: auth })).json()) as { result: { notifications: { opened: number }; emails: { sent: number } } };
    expect(second.result.notifications.opened).toBe(0);
    expect(second.result.emails.sent).toBe(0);
    await anonymous.dispose();
  });
});
