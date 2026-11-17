// Vidéo de présentation du site OHMEGATO : conversation façon messagerie → ouverture du lien → le logotype
// s'écrit → il se transforme en symbole → le losange devient la fiche produit → grille → bouton « Commander ».
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
const DURATION = 44.5;

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
const times = { toBrand: 19.0, write: 19.9, morph: 23.6, card: 29.0, heroStep: 1.75, grid: 0, final: 0 };
times.grid = times.card + 1.4 + 4 * times.heroStep;
times.final = times.grid + 3.0;

const P = (slug) => "file://" + path.join(ROOT, "public/products", slug + ".webp");
const products = [
  { slug: "cookies", name: "Cookies", desc: "Bords croustillants, cœur moelleux." },
  { slug: "brownies", name: "Brownies", desc: "Petits carrés très chocolatés." },
  { slug: "muffins-pepites", name: "Muffins aux pépites", desc: "Moelleux, pépites, légère note de cannelle." },
  { slug: "choux-creme", name: "Choux à la crème", desc: "Fourrés de crème pâtissière." },
  { slug: "moelleux-chocolat", name: "Moelleux au chocolat" },
  { slug: "moelleux-pommes", name: "Moelleux aux pommes" },
  { slug: "cake-orange", name: "Cake à l’orange" },
  { slug: "verrines-fruitees", name: "Verrines fruitées" },
].map((p) => ({ ...p, img: P(p.slug) }));

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
  heroes: products.slice(0, 4),
  grid: products,
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

/** Tracés de marque au temps t (null avant l'ouverture du lien). */
function brandAt(t) {
  if (t < times.write) return null;
  if (t < times.morph) {
    const d = wr.writingAt(writing, t - times.write);
    return d === null ? { d: writing.logo.d, transform: wr.writingTransform(writing.logo.transform), diamond: 0 } : { d, diamond: 0 };
  }
  if (t < times.card) {
    const f = eng.frameAt(morph, Math.min(6, 1 + (t - times.morph)));
    if (f.mode === "ribbons") return { d: f.body, diamond: f.diamond };
    const src = f.mode === "logo" ? morph.logo : morph.symbol;
    return { d: src.d, transform: eng.svgTransform(src.transform), diamond: f.diamond };
  }
  // le symbole se range en haut à gauche pendant que le losange devient la carte, puis revient au centre
  const s1 = 0.142;
  const corner = [s1, 90 - 755 * s1, 60 - 152 * s1];
  const s2 = 0.46;
  const center = [s2, 960 - 960 * s2, 110 - 152 * s2];
  const k1 = ease((t - times.card) / 1.4);
  const k2 = ease((t - times.final) / 1.3);
  const g = [0, 1, 2].map((i) => lerp(lerp([1, 0, 0][i], corner[i], k1), center[i], k2));
  const diamondBack = clamp((t - times.card - 1.0) / 0.5);
  return {
    d: morph.symbol.d,
    transform: eng.svgTransform(morph.symbol.transform),
    diamond: diamondBack,
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
