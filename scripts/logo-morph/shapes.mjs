// Lecture des SVG officiels de la charte et découpe en rubans appariés (sources : lettres ; cibles : pièces du symbole).
// Aucune forme n'est redessinée : chaque contour provient des tracés de public/brand/, seules des coupes droites
// (à travers une bande, ou entre un contre-forme et le bord) sont ajoutées pour délimiter les pièces.
import fs from "node:fs";
import path from "node:path";
import {
  parsePath, bbox, centroid, principalAxis, rayHit, insertHit, indexOfPoint, arc, arcAvoiding,
  cutAcross, signedArea, densify, ribbonFromChains, norm, dist,
} from "./geometry.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const readPaths = (file) => {
  const svg = fs.readFileSync(path.join(ROOT, "public/brand", file), "utf8");
  return [...svg.matchAll(/<path[^>]*fill="([^"]+)"[^>]*d="([^"]+)"/g)].map((m) => ({ fill: m[1], d: m[2] }));
};

// Scène 1920 × 1080 : les deux logos sont centrés, à échelle fixe (aucun zoom pendant l'animation).
export const STAGE = { width: 1920, height: 1080 };
export const LOGO_T = { s: 0.75, tx: 960 - 893 * 0.75, ty: 540 - 292 * 0.75 };
export const SYM_T = { s: 0.48, tx: 960 - 500 * 0.48, ty: 540 - 880.5 * 0.48 };
const L = ([x, y]) => [LOGO_T.tx + x * LOGO_T.s, LOGO_T.ty + y * LOGO_T.s];
const S = ([x, y]) => [SYM_T.tx + x * SYM_T.s, SYM_T.ty + y * SYM_T.s];

const STEP = 1.2; // pas de densification (px de scène)

function orient(poly, sign) {
  return Math.sign(signedArea(poly)) === sign ? poly : poly.slice().reverse();
}
const rotateTo = (poly, i) => [...poly.slice(i), ...poly.slice(0, i)];

/** Anneau combiné « extérieur + fente + trou » : rend simplement connexe une forme à un trou. */
function slitRing(ext, hole, pExt, qHole) {
  const e = orient(ext, 1);
  const h = orient(hole, -1);
  const ie = indexOfPoint(e, pExt);
  const ih = indexOfPoint(h, qHole);
  const er = rotateTo(e, ie);
  const hr = rotateTo(h, ih);
  return [...er, er[0], ...hr, hr[0]];
}

/** Ruban sur un anneau à partir des quatre coins (points approchés ou indices). */
function bandOnRing(ring, a0, b0, a1, b1, n) {
  const idx = (c) => (typeof c === "number" ? c : indexOfPoint(ring, c));
  const iA0 = idx(a0), iB0 = idx(b0), iA1 = idx(a1), iB1 = idx(b1);
  const A = arcAvoiding(ring, iA0, iA1, [iB0, iB1]);
  const B = arcAvoiding(ring, iB0, iB1, [iA0, iA1]);
  return finishRibbon(A, B, n);
}

/** Ruban annulaire : bord extérieur et bord du trou, parcourus dans le même sens depuis la couture. */
function ringRibbon(ext, hole, seamOrigin, seamDir, n) {
  const he = rayHit(hole, seamOrigin, seamDir);
  const [h2, ih] = insertHit(hole, he);
  const hx = rayHit(ext, seamOrigin, seamDir);
  const [e2, ie] = insertHit(ext, hx);
  const e = orient(e2, 1);
  const h = orient(h2, 1);
  const ie2 = indexOfPoint(e, e2[ie]);
  const ih2 = indexOfPoint(h, h2[ih]);
  const A = [...rotateTo(e, ie2), e[ie2]];
  const B = [...rotateTo(h, ih2), h[ih2]];
  return finishRibbon(A, B, n);
}

function finishRibbon(A, B, n) {
  const Ad = densify(A, STEP);
  const Bd = densify(B, STEP);
  let rib = ribbonFromChains(Ad, Bd, n);
  // convention : L à gauche du sens de parcours (aire signée positive du contour L + R inversé)
  const area = signedArea([...rib.L, ...rib.R.slice().reverse()]);
  if (area < 0) rib = { L: rib.R, R: rib.L };
  return rib;
}

export const reverseRibbon = (r) => ({ L: r.R.slice().reverse(), R: r.L.slice().reverse() });

// ---------------------------------------------------------------------------------------------
export function loadShapes(n = 420) {
  const logo = readPaths("logotype-ohmegato.svg");
  const sym = readPaths("symbole-ohmegato.svg");

  // --- Logotype : 12 sous-tracés, identifiés par leur abscisse minimale (unités du SVG source)
  const subs = parsePath(logo[0].d);
  const byX = (x) => {
    const p = subs.reduce((best, s) => (Math.abs(bbox(s)[0] - x) < Math.abs(bbox(best)[0] - x) ? s : best));
    return p;
  };
  const raw = {
    o1: byX(60), o1h: byX(104), h: byX(292), me: byX(485), eh: byX(816), g: byX(995), gh: byX(1030),
    a: byX(1198), ah: byX(1237), t: byX(1424), o2: byX(1535), o2h: byX(1571),
  };
  const lg = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v.map(L)]));

  // Séparation m | e : coupe droite à travers le trait montant qui les relie
  const meCut = cutAcross(lg.me, L([764, 336]), norm([0.88, 0.47]));
  const arcs = [arc(meCut.poly, meCut.ia, meCut.ib, 1), arc(meCut.poly, meCut.ia, meCut.ib, -1)];
  const mean = (p) => p.reduce((s, q) => s + q[0], 0) / p.length;
  const [mPoly, ePoly] = mean(arcs[0]) < mean(arcs[1]) ? arcs : arcs.reverse();

  const letters = {};
  letters.o1 = ringRibbon(lg.o1, lg.o1h, centroid(lg.o1h), norm([1, 0.35]), n);
  letters.h = bandOnRing(lg.h, L([292, 379]), L([327, 379]), L([466, 379]), L([431, 379]), n);
  letters.m = bandOnRing(mPoly, L([490, 392]), L([510, 392]), meCut.b, meCut.a, n);
  {
    const ring = slitRing(ePoly, lg.eh, L([788, 331.5]), L([817, 265]));
    letters.e = bandOnRing(ring, meCut.b, meCut.a, L([914, 325]), L([942, 347]), n);
  }
  {
    const ring = slitRing(lg.g, lg.gh, L([1150.2, 357.7]), L([1151, 345]));
    letters.g = bandOnRing(ring, 0, ring.length - 1, L([1001, 461]), L([1032, 447.5]), n);
  }
  letters.a = ringRibbon(lg.a, lg.ah, centroid(lg.ah), norm([0.3, 1]), n);
  letters.t = bandOnRing(lg.t, L([1443, 379]), L([1479, 379]), L([1443, 116]), L([1479, 116]), n);
  letters.o2 = ringRibbon(lg.o2, lg.o2h, centroid(lg.o2h), norm([0.6, 1]), n);

  // --- Symbole
  const symSubs = parsePath(sym[1].d).map((p) => p.map(S));
  const diamond = parsePath(sym[0].d)[0].map(S);
  const omega = symSubs.reduce((a, b) => (b.length > a.length ? b : a));
  const rest = symSubs.filter((p) => p !== omega);
  const cup = rest.reduce((a, b) => (bbox(b)[2] - bbox(b)[0] > bbox(a)[2] - bbox(a)[0] ? b : a));
  const slots = rest.filter((p) => p !== cup).sort((a, b) => centroid(a)[0] - centroid(b)[0]);

  // Ω : quatre coupes à travers la bande
  const cuts = [
    { c: [162, 850], d: [1, 0] },
    { c: [240, 480], d: [0.7, 0.7] },
    { c: [760, 480], d: [-0.7, 0.7] },
    { c: [826, 680], d: [1, -0.2] },
  ];
  let om = omega;
  const cutPts = [];
  for (const k of cuts) {
    const r = cutAcross(om, S(k.c), norm(k.d));
    om = r.poly;
    cutPts.push([r.a, r.b]);
  }
  const hc = S([500, 780]);
  const outerInner = cutPts.map(([a, b]) => (dist(a, hc) > dist(b, hc) ? { o: a, i: b } : { o: b, i: a }));
  const oi = outerInner.map(({ o, i }) => ({ o: indexOfPoint(om, o), i: indexOfPoint(om, i) }));
  const all = oi.flatMap(({ o, i }) => [o, i]);
  const without = (...ks) => all.filter((k) => !ks.includes(k));
  const pieces = {};
  {
    const ring = arcAvoiding(om, oi[0].o, oi[0].i, without(oi[0].o, oi[0].i));
    pieces.o1 = bandOnRing(ring, 0, ring.length - 1, S([78, 1229]), S([215, 1230]), n);
  }
  for (const [k, name] of [[0, "h"], [1, "m"], [2, "e"]]) {
    const outer = arcAvoiding(om, oi[k].o, oi[k + 1].o, without(oi[k].o, oi[k + 1].o));
    const inner = arcAvoiding(om, oi[k + 1].i, oi[k].i, without(oi[k].i, oi[k + 1].i));
    const ring = [...outer, ...inner];
    pieces[name] = bandOnRing(ring, 0, ring.length - 1, outer.length - 1, outer.length, n);
  }
  {
    const ring = arcAvoiding(om, oi[3].o, oi[3].i, without(oi[3].o, oi[3].i));
    pieces.g = bandOnRing(ring, 0, ring.length - 1, S([922, 1229]), S([785, 1230]), n);
  }

  // Caissette : coupes dans l'axe des fentes 2 et 4, puis coutures diagonales vers les coins
  let O = cup;
  const sl = slots.map((s) => s.slice());
  const slotCut = (k) => {
    const c = centroid(sl[k]);
    let ax = principalAxis(sl[k]);
    if (ax[1] < 0) ax = [-ax[0], -ax[1]];
    const res = {};
    for (const [name, d] of [["t", [-ax[0], -ax[1]]], ["b", ax]]) {
      const hs = rayHit(sl[k], c, d);
      const [s2, is] = insertHit(sl[k], hs);
      sl[k] = s2;
      const ho = rayHit(O, c, d);
      const [o2, io] = insertHit(O, ho);
      O = o2;
      res[name] = { q: s2[is], p: o2[io] };
    }
    return res;
  };
  const c2 = slotCut(1);
  const c4 = slotCut(3);
  const iO = (p) => indexOfPoint(O, p);
  const iS = (k, p) => indexOfPoint(sl[k], p);
  const halfArc = (k, from, to, side) => {
    const a1 = arc(sl[k], iS(k, from), iS(k, to), 1);
    const a2 = arc(sl[k], iS(k, from), iS(k, to), -1);
    const m1 = mean(a1);
    const m2 = mean(a2);
    return side === "left" ? (m1 < m2 ? a1 : a2) : m1 < m2 ? a2 : a1;
  };
  const leftExt = [
    ...arcAvoiding(O, iO(c2.b.p), iO(c2.t.p), [iO(c4.t.p), iO(c4.b.p)]),
    ...halfArc(1, c2.t.q, c2.b.q, "left"),
  ];
  const centerExt = [
    ...arcAvoiding(O, iO(c2.t.p), iO(c4.t.p), [iO(c2.b.p), iO(c4.b.p)]),
    ...halfArc(3, c4.t.q, c4.b.q, "left"),
    ...arcAvoiding(O, iO(c4.b.p), iO(c2.b.p), [iO(c2.t.p), iO(c4.t.p)]),
    ...halfArc(1, c2.b.q, c2.t.q, "right"),
  ];
  const rightExt = [
    ...arcAvoiding(O, iO(c4.t.p), iO(c4.b.p), [iO(c2.t.p), iO(c2.b.p)]),
    ...halfArc(3, c4.b.q, c4.t.q, "right"),
  ];
  {
    const s = { c: centroid(sl[0]), d: [0, 1] };
    pieces.a = ringRibbon(leftExt, sl[0], s.c, s.d, n);
  }
  {
    const s = { c: centroid(sl[2]), d: [0, 1] };
    pieces.t = ringRibbon(centerExt, sl[2], s.c, s.d, n);
  }
  {
    const s = { c: centroid(sl[4]), d: [0, 1] };
    pieces.o2 = ringRibbon(rightExt, sl[4], s.c, s.d, n);
  }

  return {
    letters, pieces, diamond,
    official: { logo: lg, omega, cup, slots, diamond },
    debug: { cutPts, c2, c4 },
  };
}
