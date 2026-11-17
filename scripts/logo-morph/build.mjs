// Génère src/components/brand/logo-morph/morph-data.json à partir des SVG officiels de la charte.
// Usage : node scripts/logo-morph/build.mjs
import fs from "node:fs";
import path from "node:path";
import { loadShapes, reverseRibbon, LOGO_T, SYM_T, STAGE } from "./shapes.mjs";
import { sub, add, mul, norm, dist } from "./geometry.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const OUT = path.join(ROOT, "src/components/brand/logo-morph/morph-data.json");

const N = 320; // paires par ruban
const STEP = 2; // pas du rail (px de scène)

// ---------------------------------------------------------------------------------------------
// Chorégraphie (secondes). Les lettres se délient de gauche à droite entre 1 s et 1,5 s ;
// elles glissent ensuite sur leur rail jusqu'à leur pièce ; tout est en place à 4,5 s.
// via : points de passage du rail entre la lettre et sa pièce (coordonnées de scène 1920 × 1080).
export const CHOREO = {
  o1: { head: "s1", target: "rev", t0: 1.0, t1: 4.45, lag: 0.12, warp: 1.6, hn: 9, via: [[455, 720], [470, 860], [580, 945], [705, 905]] },
  h: { head: "s1", target: "fwd", t0: 1.07, t1: 3.85, lag: 0.12, warp: 1.3, hn: 9, via: [[610, 720], [625, 815], [700, 850], [745, 800]], rail: ["o1:rev"] },
  m: { head: "s0", target: "fwd", t0: 1.14, t1: 3.3, lag: 0.1, hn: 9, via: [[690, 705], [725, 770], [765, 765]], rail: ["o1:rev", "h"] },
  e: { head: "s1", target: "fwd", t0: 1.21, t1: 3.4, lag: 0.1, warp: 1.7, hn: 9, via: [[1045, 512], [1042, 452], [1022, 410], [1025, 368], [1045, 340]] },
  g: { head: "s1", target: "fwd", t0: 1.28, t1: 3.0, lag: 0.02, lead: -1, hn: 13.5, ds: 30, smoothLam: 40, gTrack: true, via: [] },
  a: { head: "s1", target: "fwd", t0: 1.35, t1: 3.35, lag: 0.12, hn: 9, via: [[1265, 700], [1290, 830], [1230, 905], [1130, 912], [1040, 912], [960, 914]] },
  t: { head: "s0", target: "fwd", t0: 1.42, t1: 3.95, lag: 0.12, warp: 1.35, hn: 9, via: [[1400, 730], [1450, 880], [1340, 950], [1180, 925], [1100, 908], [1060, 906]] },
  o2: { head: "s1", target: "fwd", t0: 1.49, t1: 4.45, lag: 0.12, warp: 1.5, hn: 9, via: [[1600, 680], [1640, 870], [1500, 990], [1300, 975], [1170, 915]] },
};

function smoothLam(uSrc, uTgt, ds, dt, radius) {
  const reach = ds + dt;
  const raw = uSrc.map((u, k) => Math.min(1, Math.max(0, (Math.abs(uTgt[k] - u) - reach) / reach)));
  return raw.map((_, k) => {
    let acc = 0;
    let c = 0;
    for (let j = Math.max(0, k - radius); j <= Math.min(raw.length - 1, k + radius); j++) {
      acc += raw[j];
      c++;
    }
    return Math.round((acc / c) * 100) / 100;
  });
}
const median = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
const mid = (r) => r.L.map((p, i) => [(p[0] + r.R[i][0]) / 2, (p[1] + r.R[i][1]) / 2]);
const dirAt = (pts, i, j) => norm(sub(pts[j], pts[i]));

function hermite(p0, p1, m0, m1, steps) {
  const out = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    out.push([
      h00 * p0[0] + h10 * m0[0] + h01 * p1[0] + h11 * m1[0],
      h00 * p0[1] + h10 * m0[1] + h01 * p1[1] + h11 * m1[1],
    ]);
  }
  return out;
}

/** Raccord lisse (Catmull-Rom avec tangentes imposées aux extrémités). */
function connector(a, da, b, db, via) {
  const P = [a, ...via, b];
  const T = P.map((p, i) => {
    if (i === 0) return mul(da, dist(P[0], P[1]) * 1.1);
    if (i === P.length - 1) return mul(db, dist(P[i - 1], P[i]) * 1.1);
    return mul(sub(P[i + 1], P[i - 1]), 0.5);
  });
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const steps = Math.max(4, Math.ceil(dist(P[i], P[i + 1]) / 1));
    out.push(...hermite(P[i], P[i + 1], T[i], T[i + 1], steps));
  }
  out.pop(); // le dernier point est le début de la cible
  return out;
}

function smooth(pts, iterations, fixed) {
  let a = pts.map((p) => p.slice());
  for (let it = 0; it < iterations; it++) {
    const b = a.map((p) => p.slice());
    for (let i = 1; i < a.length - 1; i++) {
      if (fixed.has(i)) continue;
      b[i][0] = (a[i - 1][0] + 2 * a[i][0] + a[i + 1][0]) / 4;
      b[i][1] = (a[i - 1][1] + 2 * a[i][1] + a[i + 1][1]) / 4;
    }
    a = b;
  }
  return a;
}

function cumulative(pts) {
  const c = [0];
  for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + dist(pts[i - 1], pts[i]));
  return c;
}

function buildRibbon(id, src, tgt, cfg) {
  const n = src.L.length;
  const sc = mid(src);
  const tc = mid(tgt);
  // partie du rail portée par la lettre elle-même
  let kb = n;
  let raw;
  let srcPart;
  let con;
  if (cfg.gTrack) {
    // g : rail = panse puis fût de la lettre, prolongé jusqu'au bas du pied droit ; la panse s'enroule dans le fût,
    // le fût et le crochet glissent vers le bras et le pied, puis chaque point se pose sur la pièce.
    let kStem = 0;
    for (let k = 0; k < n; k++) if (sc[k][1] < sc[kStem][1] + 0 && k < n * 0.6) kStem = k;
    kb = kStem;
    while (kb < n - 1 && sc[kb][1] < tc[n - 1][1] - 70) kb++;
    srcPart = sc.slice(0, kb);
    const end = tc[n - 1];
    con = connector(srcPart[kb - 1], dirAt(srcPart, kb - 9, kb - 1), add(end, [0, 30]), [0, 1], [end]);
    raw = [...srcPart, ...con, add(end, [0, 30])];
  } else {
    srcPart = sc.slice(0, kb);
    const back = Math.min(8, kb - 1);
    const da = dirAt(srcPart, kb - 1 - back, kb - 1);
    const db = dirAt(tc, 0, 8);
    con = connector(srcPart[kb - 1], da, tc[0], db, [...cfg.via, ...(cfg.railPts ?? [])]);
    raw = [...srcPart, ...con, ...tc];
  }
  const fixed = new Set([0, raw.length - 1]);
  const sm = smooth(raw, cfg.smoothIt ?? 160, fixed);
  const cum = cumulative(sm);
  const tgtStart = srcPart.length + con.length;
  const uSrc = [];
  const uTgt = [];
  for (let k = 0; k < kb; k++) uSrc.push(cum[k]);
  if (!cfg.gTrack) for (let k = 0; k < n; k++) uTgt.push(cum[tgtStart + k]);
  // rail rééchantillonné à pas constant (angle déroulé)
  const total = cum[cum.length - 1];
  const count = Math.ceil(total / STEP) + 1;
  const tpos = [];
  let seg = 0;
  for (let i = 0; i < count; i++) {
    const u = Math.min(total, i * STEP);
    while (seg < sm.length - 2 && cum[seg + 1] < u) seg++;
    const span = cum[seg + 1] - cum[seg] || 1;
    const t = Math.min(1, Math.max(0, (u - cum[seg]) / span));
    tpos.push([sm[seg][0] + (sm[seg + 1][0] - sm[seg][0]) * t, sm[seg][1] + (sm[seg + 1][1] - sm[seg][1]) * t, u]);
  }
  const track = [];
  let prevAng = null;
  for (let i = 0; i < tpos.length; i++) {
    const a = tpos[Math.max(0, i - 2)];
    const b = tpos[Math.min(tpos.length - 1, i + 2)];
    let ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    if (prevAng !== null) {
      while (ang - prevAng > Math.PI) ang -= 2 * Math.PI;
      while (ang - prevAng < -Math.PI) ang += 2 * Math.PI;
    }
    prevAng = ang;
    track.push(tpos[i][0], tpos[i][1], ang, tpos[i][2]);
  }
  // g : projection monotone de la matière restante (fût bas, crochet) et des points d'arrivée sur le rail
  const project = (pts, from, floor) => {
    const out = [];
    let i0 = from;
    let prev = floor;
    for (const p of pts) {
      let bi = i0;
      let bd = Infinity;
      for (let i = i0; i < tpos.length; i++) {
        const d = dist(tpos[i], p);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
      i0 = bi;
      prev = Math.max(tpos[bi][2], prev + 0.01);
      out.push(prev);
    }
    return out;
  };
  if (kb < n) uSrc.push(...project(sc.slice(kb), Math.ceil(uSrc[kb - 1] / STEP), uSrc[kb - 1]));
  if (cfg.gTrack) {
    const ut = project(tc, 0, -1);
    for (let k = 0; k < n; k++) uTgt.push(Math.max(ut[k], uSrc[k]));
  }
  // décalages locaux des bords
  const sampleAt = (u) => {
    let lo = Math.min(tpos.length - 2, Math.max(0, Math.floor(u / STEP)));
    const i = lo * 4;
    const j = (lo + 1) * 4;
    const span = track[j + 3] - track[i + 3];
    const t = span > 0 ? Math.min(1, Math.max(0, (u - track[i + 3]) / span)) : 0;
    return [track[i] + (track[j] - track[i]) * t, track[i + 1] + (track[j + 1] - track[i + 1]) * t, track[i + 2] + (track[j + 2] - track[i + 2]) * t];
  };
  const offsets = (rib, us) => {
    const out = [];
    for (let k = 0; k < n; k++) {
      const [x, y, ang] = sampleAt(us[k]);
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      for (const p of [rib.L[k], rib.R[k]]) {
        const dx = p[0] - x;
        const dy = p[1] - y;
        out.push(dx * c + dy * s, -dx * s + dy * c);
      }
    }
    return out;
  };
  const r1 = (v) => Math.round(v * 100) / 100;
  const r3 = (v) => Math.round(v * 10000) / 10000;
  return {
    id,
    n,
    track: track.map((v, i) => (i % 4 === 2 ? r3(v) : r1(v))),
    uSrc: uSrc.map(r1),
    uTgt: uTgt.map(r1),
    offSrc: offsets(src, uSrc).map(r1),
    tgt: tgt.L.flatMap((p, k) => [p[0], p[1], tgt.R[k][0], tgt.R[k][1]]).map(r1),
    t0: cfg.t0,
    t1: cfg.t1,
    lag: cfg.lag,
    lead: cfg.lead ?? 1,
    warp: cfg.warp ?? 1,
    ...(cfg.smoothLam ? { lam: smoothLam(uSrc, uTgt, cfg.ds ?? 45, cfg.dt ?? 70, cfg.smoothLam) } : {}),
    hn: r1(cfg.hn * Math.sign(median(offsets(src, uSrc).filter((_, i) => i % 4 === 1)))),
    ds: cfg.ds ?? 45,
    dt: cfg.dt ?? 70,
  };
}

export function build() {
  const sh = loadShapes(N);
  const ribbons = [];
  for (const [id, cfg] of Object.entries(CHOREO)) {
    // la tête (fin du ruban, k = n - 1) est l'extrémité qui entraîne le trait
    const src = cfg.head === "s1" ? sh.letters[id] : reverseRibbon(sh.letters[id]);
    const tgt = cfg.target === "fwd" ? sh.pieces[id] : reverseRibbon(sh.pieces[id]);
    // rails : âmes des pièces traversées avant d'atteindre la sienne (points de passage espacés)
    const railPts = (cfg.rail ?? []).flatMap((spec) => {
      const [pid, dir] = spec.split(":");
      const c = mid(dir === "rev" ? reverseRibbon(sh.pieces[pid]) : sh.pieces[pid]);
      const pts = [];
      for (let k = 0; k < c.length; k += 24) pts.push(c[k]);
      return pts;
    });
    ribbons.push(buildRibbon(id, src, tgt, { ...cfg, railPts }));
  }
  const svg = (f) => fs.readFileSync(path.join(ROOT, "public/brand", f), "utf8");
  const ds = (f) => [...svg(f).matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
  const [diamondD, symbolD] = ds("symbole-ohmegato.svg");
  const [logoD] = ds("logotype-ohmegato.svg");
  return {
    width: STAGE.width,
    height: STAGE.height,
    duration: 6,
    logo: { d: logoD, transform: [LOGO_T.s, LOGO_T.tx, LOGO_T.ty] },
    symbol: { d: symbolD, transform: [SYM_T.s, SYM_T.tx, SYM_T.ty] },
    diamond: { d: diamondD, transform: [SYM_T.s, SYM_T.tx, SYM_T.ty] },
    morphStart: 1.0,
    morphEnd: Math.max(...ribbons.map((r) => r.t1)),
    diamondIn: [4.5, 5.0],
    ribbons,
  };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const data = build();
  fs.writeFileSync(OUT, JSON.stringify(data));
  console.log("écrit", path.relative(ROOT, OUT), (fs.statSync(OUT).size / 1024).toFixed(0) + " Ko");
}
