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


// Conversation : bulles bleues (envoyées) à droite, grises (reçues) à gauche, sans noms. Rythme de lecture naturel.
// Conversation en grand pour accrocher ; le rythme suit la longueur de chaque message (temps de lecture naturel).
const conversation = [
  ["l", "Tu connais un bon endroit pour commander des petits fours ?"],
  ["r", "Pourquoi ?"],
  ["l", "Flemme de préparer pour le chill de ce soir 😂"],
  ["r", "Tu connais OHMEGATO ?"],
  ["l", "OHMEGATO ? Non. Montre stp !!"],
  ["r", "Regarde…"],
];
const msgs = [];
{
  let t = 0.5;
  let prevLen = 0;
  for (const [side, text, extra] of conversation) {
    const read = prevLen ? 0.7 + prevLen * 0.03 : 0;
    const typing = side === "l" ? 0.8 + Math.min(0.7, text.length * 0.008) : 0;
    t += read + typing + (side === "r" ? 0.3 : 0);
    msgs.push({ side, text, t: Math.round(t * 100) / 100, ...(side === "l" ? { typing } : {}), ...(extra ?? {}) });
    prevLen = text.length;
  }
}
// enchaînements calés sur la fin de la conversation (écarts identiques à la version précédente)
const B = msgs[msgs.length - 1].t + 2.6;
const rel = { browser: 0, tour: 1.3, phone: 12.2, phoneTour: 13.4, tap: 16.4, trio: 17.4, merge: 20.6, brand: 21.7, write: 22.8, morph: 26.9, final: 32.5 };
const times = Object.fromEntries(Object.entries(rel).map(([k, v]) => [k, B + v]));

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

const DURATION = times.final + 5.3;
// repères pour la bande son (sons des bulles, musique) : scripts/promo/mix-audio.mjs
fs.writeFileSync(
  path.join(ROOT, "scripts/promo/timings.json"),
  JSON.stringify(
    {
      received: msgs.filter((m) => m.side === "l").map((m) => m.t),
      sent: msgs.filter((m) => m.side === "r").map((m) => m.t),
      drop: times.browser,
      phone: times.phone,
      brand: times.brand,
      final: times.final,
      duration: DURATION,
    },
    null,
    2,
  ) + "\n",
);
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
