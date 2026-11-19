// Vidéo « le logotype s'écrit » : 1920 × 1080, 60 i/s, sans son.
// Chaque lettre officielle est parcourue comme un trait de plume (ruban révélé de son début à sa fin) ;
// la dernière image affiche le tracé officiel lui-même.
// Usage : node scripts/logo-morph/export-writing.mjs [sortie.mp4]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { loadShapes, reverseRibbon, LOGO_T } from "./shapes.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require("@playwright/test"));
}
const out = path.resolve(process.argv[2] ?? path.join(ROOT, "docs/animations/ohmegato-ecriture-1920x1080-60fps.mp4"));
const FPS = 60;
const DURATION = 5;
const ZOOM = 0.86 / LOGO_T.s; // logotype un peu plus grand que dans la scène du morphing, centré
const Z = ([x, y]) => [960 + (x - 960) * ZOOM, 540 + (y - 540) * ZOOM];

// Ordre et rythme d'écriture : départ posé, accélération, m et e liés d'un seul geste.
const PLAN = [
  { id: "o1", rev: false, t0: 0.45, t1: 1.0 },
  { id: "h", rev: false, t0: 0.85, t1: 1.38 },
  { id: "m", rev: false, t0: 1.22, t1: 1.78, out: "linear" },
  { id: "e", rev: false, t0: 1.78, t1: 2.22, in: "linear" },
  { id: "g", rev: false, t0: 2.05, t1: 2.6 },
  { id: "a", rev: false, t0: 2.42, t1: 2.88 },
  { id: "t", rev: true, t0: 2.72, t1: 3.05 },
  { id: "o2", rev: false, t0: 2.92, t1: 3.42 },
];
const FINAL = 3.5; // tracé officiel exact à partir d'ici

const svg = fs.readFileSync(path.join(ROOT, "public/brand/logotype-ohmegato.svg"), "utf8");
const logoD = svg.match(/ d="([^"]+)"/)[1];
const s = LOGO_T.s * ZOOM;
const tx = 960 + (LOGO_T.tx - 960) * ZOOM;
const ty = 540 + (LOGO_T.ty - 540) * ZOOM;
/** Données d'écriture (lettres officielles en rubans, scène 1920 × 1080). n : paires par lettre. */
export function buildWritingData(n = 260, plan = PLAN, writeEnd = FINAL, zoom = ZOOM) {
  // zoom = 1 : même échelle que la scène du morphing (logotype à 0,75)
  const Zz = ([x, y]) => [960 + (x - 960) * zoom, 540 + (y - 540) * zoom];
  const sz = LOGO_T.s * zoom;
  const shapes = loadShapes(n);
  const r2 = (v) => Math.round(v * 10) / 10;
  return {
    width: 1920,
    height: 1080,
    logo: { d: logoD, transform: [sz, 960 + (LOGO_T.tx - 960) * zoom, 540 + (LOGO_T.ty - 540) * zoom] },
    writeEnd,
    letters: plan.map((p) => {
      const r = p.rev ? reverseRibbon(shapes.letters[p.id]) : shapes.letters[p.id];
      const pts = r.L.flatMap((q, k) => [...Zz(q), ...Zz(r.R[k])]).map(r2);
      const { id, t0, t1 } = p;
      return { id, pts, t0, t1, ...(p.out ? { out: p.out } : {}), ...(p.in ? { in: p.in } : {}) };
    }),
  };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
const sh = loadShapes(700);
  const ribbons = Object.fromEntries(
    PLAN.map((p) => {
      const r = p.rev ? reverseRibbon(sh.letters[p.id]) : sh.letters[p.id];
      return [p.id, { L: r.L.map(Z), R: r.R.map(Z) }];
    }),
  );

  const clamp = (x) => Math.min(1, Math.max(0, x));
  function progress(p, t) {
    const x = clamp((t - p.t0) / (p.t1 - p.t0));
    if (p.out === "linear") return x * x; // entrée douce, vitesse conservée vers la lettre liée (m → e)
    if (p.in === "linear") return 1 - (1 - x) * (1 - x); // reprend la vitesse, sortie douce
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; // départ posé, trait vif, arrivée douce
  }

  const f1 = (v) => (Math.round(v * 10) / 10).toString();
  function partial(r, p) {
    if (p <= 0) return "";
    const n = r.L.length;
    const k = p * (n - 1);
    const i = Math.floor(k);
    const L = r.L.slice(0, i + 1);
    const R = r.R.slice(0, i + 1);
    if (i < n - 1) {
      const f = k - i;
      const mix = (a, b) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      L.push(mix(r.L[i], r.L[i + 1]));
      R.push(mix(r.R[i], r.R[i + 1]));
    }
    const pts = [...L, ...R.reverse()];
    return "M" + pts.map((q) => f1(q[0]) + " " + f1(q[1])).join("L") + "Z";
  }

  const logoTransform = `matrix(${s} 0 0 ${s} ${tx} ${ty})`;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ecriture-"));
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.setContent(`<body style="margin:0;background:#F5E9D6"><svg viewBox="0 0 1920 1080" width="1920" height="1080" style="display:block;background:#F5E9D6"><path id="b" fill="#3A2418"/></svg></body>`);
  const frames = Math.round(DURATION * FPS);
  for (let i = 0; i < frames; i++) {
    const t = i / FPS;
    const exact = t >= FINAL;
    const d = exact ? logoD : PLAN.map((p) => partial(ribbons[p.id], progress(p, t))).join("");
    await page.evaluate(
      ([d, tr]) => {
        const b = document.getElementById("b");
        b.setAttribute("d", d);
        if (tr) b.setAttribute("transform", tr);
        else b.removeAttribute("transform");
      },
      [d, exact ? logoTransform : null],
    );
    await page.screenshot({ path: path.join(dir, `f${String(i).padStart(4, "0")}.png`) });
  }
  await browser.close();
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(dir, "f%04d.png"), "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-preset", "slow", "-r", String(FPS), out]);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log("vidéo :", out);
}
