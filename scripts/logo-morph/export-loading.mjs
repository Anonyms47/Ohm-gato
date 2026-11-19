// Vidéo de l'écran de chargement (deux cycles) : 1920 × 1080, 60 i/s, sans son.
// Usage : node scripts/logo-morph/export-loading.mjs [sortie.mp4]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require("@playwright/test"));
}
const w = await import(path.join(ROOT, "src/components/brand/logo-morph/writing.ts"));
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "src/components/brand/logo-morph/loading-data.json"), "utf8"));
const out = path.resolve(process.argv[2] ?? path.join(ROOT, "docs/animations/ohmegato-chargement-1920x1080-60fps.mp4"));
// mêmes durées que LoadingOhmegato.tsx
const HOLD = 0.75;
const ERASE = 0.7;
const REST = 0.25;
const CYCLE = data.writeEnd + HOLD + ERASE + REST;
const FPS = 60;
const frames = Math.round((REST + 2 * CYCLE) * FPS);
// logotype à environ 60 % de la largeur de l'image, centré
const VIEWBOX = "-300 -168.75 2520 1417.5";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "chargement-"));
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.setContent(`<body style="margin:0;background:#F5E9D6"><svg viewBox="${VIEWBOX}" width="1920" height="1080" style="display:block;background:#F5E9D6"><path id="b" fill="#3A2418"/></svg></body>`);
const official = w.writingTransform(data.logo.transform);
for (let i = 0; i < frames; i++) {
  // court silence initial, puis deux cycles complets
  const t = i / FPS - REST;
  const c = t < 0 ? CYCLE - REST + (t + REST) : t % CYCLE;
  let d;
  let tr = null;
  if (c < data.writeEnd) d = w.writingAt(data, c) ?? "";
  else if (c < data.writeEnd + HOLD) {
    d = data.logo.d;
    tr = official;
  } else d = w.erasingAt(data, Math.min(1, (c - data.writeEnd - HOLD) / ERASE));
  await page.evaluate(
    ([d, tr]) => {
      const b = document.getElementById("b");
      b.setAttribute("d", d);
      if (tr) b.setAttribute("transform", tr);
      else b.removeAttribute("transform");
    },
    [d, tr],
  );
  await page.screenshot({ path: path.join(dir, `f${String(i).padStart(4, "0")}.png`) });
}
await browser.close();
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(dir, "f%04d.png"), "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-preset", "slow", "-r", String(FPS), out]);
fs.rmSync(dir, { recursive: true, force: true });
console.log("vidéo :", out);
