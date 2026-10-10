import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

/** Variables de .env.local (pour signer des webhooks de test). */
export function localEnv(name: string): string {
  const content = readFileSync(".env.local", "utf8");
  const line = content.split("\n").find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} absent de .env.local`);
  return line.slice(name.length + 1).trim();
}

/** Même seuil que useIsSmallScreen : en dessous, les listes s'ouvrent en feuille. */
export function isMobile(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1200) < 640;
}

/** Ouvre la fiche produit et ajoute un format à Ma boîte. */
export async function addToBox(page: Page, slug: string, format: string, options: { flavor?: string; quantity?: number } = {}) {
  await page.goto(`/carte/${slug}`);
  await waitForHydration(page);
  const form = page.locator("form").filter({ has: page.getByRole("radio", { name: new RegExp(format) }) }).first();
  await form.getByText(format, { exact: false }).first().click();
  if (options.flavor) {
    await form.getByRole("combobox", { name: "Parfum" }).or(form.getByLabel("Parfum")).first().click();
    await page.getByRole("option", { name: new RegExp(options.flavor) }).click();
  }
  for (let i = 1; i < (options.quantity ?? 1); i++) await form.getByRole("button", { name: "Ajouter un" }).click();
  await form.getByRole("button", { name: /^Ajouter ·/ }).click();
  await expect(form.getByRole("button", { name: "Ajouté à Ma boîte" })).toBeVisible();
}

/** Numéro sénégalais valide et différent à chaque test (la limite anti-abus compte par numéro). */
export function testPhone(): string {
  return `77 ${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
}

/** Remplit les étapes 1 à 4 du bon de fournée pour un retrait. */
export async function fillPickupCheckout(page: Page) {
  await page.goto("/commande");
  await waitForHydration(page);
  await page.getByLabel("Nom").fill("Awa Diop");
  await page.getByLabel(/Téléphone/).fill(testPhone());
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("radio", { name: /^Retrait/ }).check();
  await page.getByRole("button", { name: "Continuer" }).click();
  await chooseFirstSlot(page, "Créneau de retrait");
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByRole("button", { name: "Continuer" }).click();
}

export async function chooseFirstSlot(page: Page, label: string) {
  await page.getByLabel(label).click();
  await page.getByRole("option").first().click();
}

/** Coche la case obligatoire (conditions générales et politique d'annulation) puis passe au paiement. */
export async function acceptTermsAndContinue(page: Page) {
  await page.getByRole("checkbox", { name: /J'ai lu et j'accepte les Conditions générales/ }).check();
  await page.getByRole("button", { name: "Tout est bon, payer" }).click();
}

/** Étape de vérification puis paiement de test. */
export async function payWithTestProvider(page: Page) {
  await page.getByRole("button", { name: "Imprimer mon récapitulatif" }).click();
  await acceptTermsAndContinue(page);
  await page.getByRole("button", { name: "Payer avec Paiement de test" }).click();
  await expect(page).toHaveURL(/\/paiement-test\//);
}

/** Attend que la page soit interactive (React hydraté) avant d'interagir. */
export async function waitForHydration(page: Page) {
  await page.locator("html[data-hydrated='true']").waitFor({ state: "attached" });
}

/** Adresse IP simulée propre au test : la limite anti-abus par IP ne déborde pas d'un test à l'autre. */
export async function freshIp(page: Page) {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
}

/** Accès direct à la base locale (clé service, tests uniquement). */
export async function db(path: string, init: RequestInit = {}) {
  const key = localEnv("SUPABASE_SECRET_KEY");
  const response = await fetch(`${localEnv("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers ?? {}) },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

/** Connexion par code (mode test : le code s'affiche à l'écran). */
export async function login(page: Page, phone: string, next = "/compte") {
  await freshIp(page);
  await page.goto(`/connexion?suite=${encodeURIComponent(next)}`);
  await waitForHydration(page);
  await page.getByLabel("Numéro de téléphone").fill(phone);
  await page.getByRole("button", { name: "Recevoir mon code" }).click();
  const codeText = await page.getByTestId("code-test").textContent();
  const code = /(\d{6})/.exec(codeText ?? "")![1]!;
  await page.getByLabel("Code reçu").fill(code);
  await page.getByRole("button", { name: "Ouvrir mon carnet" }).click();
  await expect(page.getByText("Carnet retrouvé").first()).toBeAttached();
}

/** Donne le rôle administrateur au compte de ce numéro (format E.164). */
export async function grantAdmin(phoneE164: string) {
  const [profile] = (await db(`profiles?select=id&phone=eq.${phoneE164.replace(/^\+/, "")}`)) as { id: string }[];
  await db("staff_roles", { method: "POST", body: JSON.stringify({ user_id: profile!.id, role: "admin" }), headers: { Prefer: "resolution=ignore-duplicates" } });
}

/** « 77 123 45 67 » → « +221771234567 » */
export function e164(phone: string) {
  return `+221${phone.replace(/\s/g, "")}`;
}
