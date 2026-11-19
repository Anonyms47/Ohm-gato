// Captures du site public (lecture seule) pour la vidéo de présentation : accueil (ordinateur) et carte (mobile).
// Usage : node scripts/promo/capture-site.mjs [https://ohmegato.com]
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const OUT = path.join(ROOT, "scripts/promo/captures");
const BASE = process.argv[2] ?? "https://ohmegato.com";
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require("@playwright/test"));
}
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
const toWebp = (png) => {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", png, "-c:v", "libwebp", "-quality", "90", png.replace(/\.png$/, ".webp")]);
};
// fait défiler toute la page pour déclencher le chargement différé des images, puis attend qu'elles soient prêtes
async function loadAll(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
    document.querySelectorAll("img").forEach((i) => (i.loading = "eager"));
    await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => (i.onload = i.onerror = r)))));
  });
  await page.waitForTimeout(600);
}
// accueil, écran d'ordinateur
const d = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await d.goto(BASE + "/", { waitUntil: "networkidle" });
await loadAll(d);
await d.screenshot({ path: path.join(OUT, "accueil.png"), fullPage: true });
// carte, téléphone : page entière sans la barre fixe, puis la barre seule
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await m.goto(BASE + "/carte", { waitUntil: "networkidle" });
await loadAll(m);
const bar = await m.evaluate(() => {
  const el = [...document.querySelectorAll("body *")].find((e) => getComputedStyle(e).position === "fixed");
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { y: r.top, h: r.height };
});
if (bar) await m.screenshot({ path: path.join(OUT, "carte-barre.png"), clip: { x: 0, y: bar.y, width: 390, height: bar.h } });
await m.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => getComputedStyle(e).position === "fixed").forEach((e) => (e.style.visibility = "hidden")));
await m.screenshot({ path: path.join(OUT, "carte.png"), fullPage: true });
// écrans de téléphone (vue réelle, barre du bas comprise) : fournée et livraison
const shots = [
  ["/fournees", 300, "fournees.png"],
  ["/fournees", 1960, "programme.png"],
  ["/livraison-retrait", 480, "livraison.png"],
];
for (const [url, y, file] of shots) {
  await m.goto(BASE + url, { waitUntil: "networkidle" });
  await loadAll(m);
  await m.evaluate((y) => window.scrollTo(0, y), y);
  await m.waitForTimeout(500);
  await m.screenshot({ path: path.join(OUT, file) });
}
await browser.close();
for (const f of ["accueil.png", "carte.png", "carte-barre.png", ...shots.map((s) => s[2])]) toWebp(path.join(OUT, f));
execFileSync("sh", ["-c", `rm -f ${OUT}/*.png`]);
console.log("captures :", OUT);
