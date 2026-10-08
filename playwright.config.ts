import { defineConfig, devices } from "@playwright/test";

/**
 * Parcours critiques sur trois expériences : téléphone, tablette, ordinateur.
 * Prérequis : Supabase local démarré (`npm run db:start`). La base est
 * réinitialisée avant la suite (données de test de supabase/seed/dev.sql).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  // En développement, chaque page est compilée à sa première visite : une redirection
  // vers une page encore jamais ouverte peut dépasser le délai par défaut de 5 s.
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3000",
    locale: "fr-SN",
    timezoneId: "Africa/Dakar",
    trace: "retain-on-failure",
    // Navigateur imposé par l'environnement (ex. conteneur sans téléchargement) : PLAYWRIGHT_CHROMIUM_PATH.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  // Une adresse IP simulée par projet : la limite anti-abus par IP reste active pendant les tests.
  projects: [
    { name: "telephone", use: { ...devices["Pixel 7"], extraHTTPHeaders: { "x-forwarded-for": "10.0.0.1" } } },
    { name: "tablette", use: { ...devices["Galaxy Tab S4"], browserName: "chromium", extraHTTPHeaders: { "x-forwarded-for": "10.0.0.2" } } },
    {
      name: "ordinateur",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 860 }, extraHTTPHeaders: { "x-forwarded-for": "10.0.0.3" } },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
