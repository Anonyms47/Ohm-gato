// Données de l'écran de chargement : écriture rapide du logotype officiel.
// Usage : node scripts/logo-morph/build-loading.mjs
import fs from "node:fs";
import path from "node:path";
import { buildWritingData } from "./export-writing.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
// Écriture vive (≈ 1,9 s), lettres très chevauchées ; m et e d'un seul geste.
const PLAN = [
  { id: "o1", rev: false, t0: 0.0, t1: 0.42 },
  { id: "h", rev: false, t0: 0.22, t1: 0.62 },
  { id: "m", rev: false, t0: 0.44, t1: 0.88, out: "linear" },
  { id: "e", rev: false, t0: 0.88, t1: 1.22, in: "linear" },
  { id: "g", rev: false, t0: 1.0, t1: 1.45 },
  { id: "a", rev: false, t0: 1.24, t1: 1.6 },
  { id: "t", rev: true, t0: 1.44, t1: 1.7 },
  { id: "o2", rev: false, t0: 1.56, t1: 1.95 },
];
const data = buildWritingData(220, PLAN, 2.0);
const out = path.join(ROOT, "src/components/brand/logo-morph/loading-data.json");
fs.writeFileSync(out, JSON.stringify(data) + "\n");
console.log("écrit", path.relative(ROOT, out), (fs.statSync(out).size / 1024).toFixed(0) + " Ko");
