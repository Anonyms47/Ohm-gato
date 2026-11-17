// Vidéo de présentation du site OHMEGATO : conversation façon messagerie → la bulle du lien devient la fenêtre
// du vrai site (accueil) → la fenêtre devient un téléphone (carte mobile) → plein écran → le logotype s'écrit →
// il se transforme en symbole → bouton « Commander ». Captures du site : scripts/promo/capture-site.mjs.
// 1920 × 1080, 60 i/s, sans son. Usage : node scripts/promo/export-promo.mjs [sortie.mp4] [--from s] [--to s] [--step n]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { buildWritingData } from "../logo-morph/export-writing.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require("@playwright/test"));
}
const eng = await import(path.join(ROOT, "src/components/brand/logo-morph/engine.ts"));
const wr = await import(path.join(ROOT, "src/components/brand/logo-morph/writing.ts"));
const morph = JSON.parse(fs.readFileSync(path.join(ROOT, "src/components/brand/logo-morph/morph-data.json"), "utf8"));
const writing = buildWritingData(260, undefined, undefined, 1); // même échelle que le morphing

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? Number(args[args.indexOf(k) + 1]) : d);
const out = path.resolve(args.find((a) => a.endsWith(".mp4")) ?? path.join(ROOT, "docs/animations/ohmegato-presentation-1920x1080-60fps.mp4"));
const FPS = 60;
const DURATION = 56.8;

// Conversation : bulles bleues (envoyées) à droite, grises (reçues) à gauche, sans noms. Rythme de lecture naturel.
const msgs = [
  { side: "l", t: 1.7, typing: 1.1, text: "Tu fais quoi samedi ?" },
  { side: "r", t: 3.3, text: "Rien de prévu, pourquoi ?" },
  { side: "l", t: 5.2, typing: 1.2, text: "J’ai trop envie de pâtisseries maison 😋" },
  { side: "r", t: 6.9, text: "Tu connais OHMEGATO ?" },
  { side: "l", t: 8.6, typing: 1.0, text: "Non, c’est quoi ?" },
  { side: "r", t: 10.2, text: "Des pâtisseries faites maison à Dakar 🍪" },
  { side: "r", t: 11.5, text: "Cookies, brownies, muffins, choux…" },
  { side: "l", t: 13.3, typing: 1.1, text: "Et on commande comment ?" },
  { side: "r", t: 14.9, text: "Sur le site, par fournées. Livraison dans Dakar ou retrait à Sud Foire." },
  { side: "l", t: 16.6, typing: 0.9, text: "Envoie le lien !" },
  { side: "r", t: 17.6, text: "ohmegato.com", link: true, meta: "Distribué" },
];
const times = { browser: 19.0, tour: 20.3, phone: 31.2, phoneTour: 32.4, tap: 35.4, trio: 36.4, merge: 39.6, brand: 40.7, write: 41.8, morph: 45.9, final: 51.5 };

// Parcours de la page d'accueil (secondes depuis « tour » → position en px de page) et titres associés.
const homeScroll = [[0, 0], [2.3, 0], [3.3, 1090], [5.6, 1090], [6.6, 2090], [8.4, 2090], [9.4, 2880], [10.9, 2880]];
// carte mobile : défilement jusqu'à la fiche Cookies, toucher sur « Ajouter · 800 FCFA » (coordonnées de la page)
const carteScroll = [[0, 0], [0.6, 0], [2.6, 440], [9, 440]];
const tapAt = [263, 1186];
const CAP_X = 1360;
const captions = [
  { lines: ["Par", "fournées."], accent: ["fournées."], x: CAP_X, y: 380, t0: times.tour + 0.2, t1: times.tour + 2.4 },
  { lines: ["Fait", "maison."], accent: ["maison."], x: CAP_X, y: 380, t0: times.tour + 3.2, t1: times.tour + 5.7 },
  { lines: ["Livré", "dans Dakar."], accent: ["Dakar."], x: CAP_X, y: 380, t0: times.tour + 6.5, t1: times.tour + 8.5 },
  { lines: ["Ou retiré à", "Sud Foire."], accent: ["Foire."], x: CAP_X, y: 380, t0: times.tour + 9.3, t1: times.tour + 10.7 },
  { lines: ["Choisis."], accent: ["Choisis."], x: 190, y: 430, t0: times.phone + 1.4, t1: times.tap - 0.1 },
  { lines: ["Ajoute."], accent: ["Ajoute."], x: 1290, y: 430, t0: times.tap + 0.05, t1: times.trio + 0.4 },
  { lines: ["Ta fournée, livrée à Dakar."], accent: ["Dakar."], center: true, size: 76, y: 70, t0: times.trio + 0.5, t1: times.merge - 0.1 },
];

const C = (f) => "file://" + path.join(ROOT, "scripts/promo/captures", f);
const captures = {
  home: C("accueil.webp"),
  carte: C("carte.webp"),
  bar: C("carte-barre.webp"),
  programme: C("programme.webp"),
  fournees: C("fournees.webp"),
};

// losange officiel dans la scène : centre et côté
const dpts = [...morph.diamond.d.matchAll(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g)].map((m) => [Number(m[1]), Number(m[2])]);
const [ds, dtx, dty] = morph.diamond.transform;
const dxs = dpts.map((p) => dtx + p[0] * ds);
const dys = dpts.map((p) => dty + p[1] * ds);
const diamond = {
  cx: (Math.min(...dxs) + Math.max(...dxs)) / 2,
  cy: (Math.min(...dys) + Math.max(...dys)) / 2,
  side: ((Math.max(...dxs) - Math.min(...dxs)) / 2) * Math.SQRT2,
};

const scene = {
  msgs,
  times,
  captions,
  homeScroll,
  carteScroll,
  tapAt,
  captures,
  diamond,
  diamondD: morph.diamond.d,
  diamondTransform: eng.svgTransform(morph.diamond.transform),
  pillText: "Commander sur ohmegato.com",
  tagline: "Pâtisseries faites maison à Dakar",
};

const clamp = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => {
  const t = clamp(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
const lerp = (a, b, k) => a + (b - a) * k;

/** Tracés de marque au temps t (null avant le plein écran crème). */
function brandAt(t) {
  if (t < times.write) return null;
  if (t < times.morph) {
    const d = wr.writingAt(writing, t - times.write);
    return d === null ? { d: writing.logo.d, transform: wr.writingTransform(writing.logo.transform), diamond: 0 } : { d, diamond: 0 };
  }
  if (t < times.final) {
    const f = eng.frameAt(morph, Math.min(6, 1 + (t - times.morph)));
    if (f.mode === "ribbons") return { d: f.body, diamond: f.diamond };
    const src = f.mode === "logo" ? morph.logo : morph.symbol;
    return { d: src.d, transform: eng.svgTransform(src.transform), diamond: f.diamond };
  }
  // le symbole remonte et se réduit pour laisser place à la phrase et au bouton
  const s2 = 0.5;
  const k = ease((t - times.final) / 1.3);
  const g = [lerp(1, s2, k), lerp(0, 960 - 960 * s2, k), lerp(0, 120 - 152 * s2, k)];
  return {
    d: morph.symbol.d,
    transform: eng.svgTransform(morph.symbol.transform),
    diamond: 1,
    group: `translate(${g[1]} ${g[2]}) scale(${g[0]})`,
  };
}

const from = opt("--from", 0);
const to = opt("--to", DURATION);
const step = opt("--step", 1);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "promo-"));
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const html = fs
  .readFileSync(path.join(ROOT, "scripts/promo/scene.html"), "utf8")
  .replace("__JOST__", "file://" + path.join(ROOT, "node_modules/@fontsource-variable/jost/files/jost-latin-wght-normal.woff2"));
const htmlPath = path.join(dir, "scene.html");
fs.writeFileSync(htmlPath, html);
await page.goto("file://" + htmlPath);
await page.evaluate((s) => (window.__SCENE = s), scene);
await page.evaluate(() => document.fonts.ready);
await page.addScriptTag({ path: path.join(ROOT, "scripts/promo/scene.js") });
await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? 1 : new Promise((r) => (i.onload = i.onerror = r))))));

const frames = [];
for (let i = Math.round(from * FPS); i < Math.round(to * FPS); i += step) frames.push(i);
let n = 0;
for (const i of frames) {
  const t = i / FPS;
  await page.evaluate(([t, b]) => window.render(t, b), [t, brandAt(t)]);
  await page.screenshot({ path: path.join(dir, `f${String(n++).padStart(5, "0")}.png`) });
}
await browser.close();
if (step === 1) {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(dir, "f%05d.png"), "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "17", "-preset", "slow", "-r", String(FPS), out]);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log("vidéo :", out);
} else {
  console.log("images :", dir, n);
}
