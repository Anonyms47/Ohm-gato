// Export vidéo silencieuse 1920 × 1080, 60 i/s, 6 s (360 images) : node scripts/logo-morph/export-video.mjs [sortie.mp4]
// Nécessite Playwright (Chromium) et ffmpeg. Chaque image est calculée au temps exact t = i / 60 (pas de capture temps réel).
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
const eng = await import(path.join(ROOT, "src/components/brand/logo-morph/engine.ts"));
const data = JSON.parse(fs.readFileSync(path.join(ROOT, "src/components/brand/logo-morph/morph-data.json"), "utf8"));
const out = path.resolve(process.argv[2] ?? path.join(ROOT, "ohmegato-morph-1920x1080-60fps.mp4"));
const FPS = 60;
const frames = Math.round(data.duration * FPS);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "morph-"));

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const tr = (o) => eng.svgTransform(o.transform);
await page.setContent(`<body style="margin:0;background:#F5E9D6"><svg id="s" viewBox="0 0 1920 1080" width="1920" height="1080" style="display:block;background:#F5E9D6">
<path id="b" fill="#3A2418"/><path id="d" fill="#DCA7AE" d="${data.diamond.d}" transform="${tr(data.diamond)}" opacity="0"/></svg></body>`);
for (let i = 0; i < frames; i++) {
  const t = i / FPS;
  const f = eng.frameAt(data, t);
  const src = f.mode === "logo" ? data.logo : f.mode === "symbol" ? data.symbol : null;
  await page.evaluate(
    ([d, transform, op]) => {
      const b = document.getElementById("b");
      b.setAttribute("d", d);
      if (transform) b.setAttribute("transform", transform);
      else b.removeAttribute("transform");
      document.getElementById("d").setAttribute("opacity", String(op));
    },
    [src ? src.d : f.body, src ? tr(src) : null, f.diamond],
  );
  await page.screenshot({ path: path.join(dir, `f${String(i).padStart(4, "0")}.png`) });
}
await browser.close();
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(dir, "f%04d.png"), "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-preset", "slow", "-r", String(FPS), out]);
fs.rmSync(dir, { recursive: true, force: true });
console.log("vidéo :", out);
