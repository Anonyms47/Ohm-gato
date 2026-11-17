// Outils géométriques (sans dépendance) pour préparer le morphing logotype → symbole.
// Les contours sont des tableaux de points [x, y] fermés implicitement (dernier point ≠ premier).

export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const mul = (a, k) => [a[0] * k, a[1] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
export const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
export const len = (a) => Math.hypot(a[0], a[1]);
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const norm = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};

/** Lit un attribut d (commandes absolues M, L, C, Z) et renvoie les sous-tracés aplatis. */
export function parsePath(d, tol = 0.08) {
  const tokens = d.match(/[MLCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi);
  const subpaths = [];
  let cur = null;
  let i = 0;
  let cmd = "";
  let pos = [0, 0];
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[MLCZ]/i.test(tokens[i])) cmd = tokens[i++];
    if (cmd === "M") {
      pos = [num(), num()];
      cur = [pos];
      subpaths.push(cur);
      cmd = "L";
    } else if (cmd === "L") {
      pos = [num(), num()];
      cur.push(pos);
    } else if (cmd === "C") {
      const p1 = [num(), num()];
      const p2 = [num(), num()];
      const p3 = [num(), num()];
      flattenCubic(pos, p1, p2, p3, tol, cur);
      pos = p3;
    } else if (cmd === "Z" || cmd === "z") {
      cmd = "";
    } else {
      throw new Error("Commande inattendue " + cmd);
    }
  }
  return subpaths.map(dedupe);
}

function flattenCubic(p0, p1, p2, p3, tol, out, depth = 0) {
  const d1 = Math.abs(cross(sub(p1, p0), norm(sub(p3, p0))));
  const d2 = Math.abs(cross(sub(p2, p0), norm(sub(p3, p0))));
  if (depth > 12 || (d1 + d2 <= tol && dist(p0, p3) < 6)) {
    out.push(p3);
    return;
  }
  const p01 = lerp(p0, p1, 0.5);
  const p12 = lerp(p1, p2, 0.5);
  const p23 = lerp(p2, p3, 0.5);
  const a = lerp(p01, p12, 0.5);
  const b = lerp(p12, p23, 0.5);
  const m = lerp(a, b, 0.5);
  flattenCubic(p0, p01, a, m, tol, out, depth + 1);
  flattenCubic(m, b, p23, p3, tol, out, depth + 1);
}

function dedupe(poly) {
  const out = [];
  for (const p of poly) if (!out.length || dist(out[out.length - 1], p) > 1e-6) out.push(p);
  while (out.length > 1 && dist(out[0], out[out.length - 1]) < 1e-6) out.pop();
  return out;
}

export const transform = (poly, s, tx, ty) => poly.map(([x, y]) => [tx + x * s, ty + y * s]);

export function signedArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export const bbox = (poly) => {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
};

export const centroid = (poly) => {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p[0];
    y += p[1];
  }
  return [x / poly.length, y / poly.length];
};

/** Axe principal (ACP) d'un contour : direction unitaire. */
export function principalAxis(poly) {
  const c = centroid(poly);
  let xx = 0;
  let xy = 0;
  let yy = 0;
  for (const p of poly) {
    const d = sub(p, c);
    xx += d[0] * d[0];
    xy += d[0] * d[1];
    yy += d[1] * d[1];
  }
  const ang = 0.5 * Math.atan2(2 * xy, xx - yy);
  return [Math.cos(ang), Math.sin(ang)];
}

/** Première intersection d'un rayon (origine, direction) avec un contour : {seg, u, point, t}. */
export function rayHit(poly, o, d) {
  let best = null;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const e = sub(b, a);
    const den = cross(d, e);
    if (Math.abs(den) < 1e-12) continue;
    const ao = sub(a, o);
    const t = cross(ao, e) / den;
    const u = cross(ao, d) / den;
    if (t > 1e-9 && u >= 0 && u <= 1 && (!best || t < best.t)) best = { seg: i, u, t, point: add(o, mul(d, t)) };
  }
  if (!best) throw new Error("Rayon sans intersection");
  return best;
}

/** Insère le point d'impact dans le contour (ou réutilise un sommet confondu). Renvoie [contour, index]. */
export function insertHit(poly, hit) {
  const a = poly[hit.seg];
  const bIdx = (hit.seg + 1) % poly.length;
  const b = poly[bIdx];
  if (dist(a, hit.point) < 1e-6) return [poly, hit.seg];
  if (dist(b, hit.point) < 1e-6) return [poly, bIdx];
  const out = poly.slice();
  out.splice(hit.seg + 1, 0, hit.point);
  return [out, hit.seg + 1];
}

export const indexOfPoint = (poly, p) => {
  let best = -1;
  let bd = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const d = dist(poly[i], p);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
};

/** Arc inclusif de i à j dans le sens dir (+1 ou -1). */
export function arc(poly, i, j, dir) {
  const n = poly.length;
  const out = [poly[i]];
  let k = i;
  while (k !== j) {
    k = (k + dir + n) % n;
    out.push(poly[k]);
  }
  return out;
}

/** Arc de i à j qui évite les sommets interdits (indices). */
export function arcAvoiding(poly, i, j, forbidden) {
  for (const dir of [1, -1]) {
    const n = poly.length;
    let k = i;
    let ok = true;
    while (k !== j) {
      k = (k + dir + n) % n;
      if (k !== j && forbidden.includes(k)) {
        ok = false;
        break;
      }
    }
    if (ok) return arc(poly, i, j, dir);
  }
  throw new Error("Aucun arc libre");
}

/** Coupe un contour par une droite (point, direction) : insère les deux impacts encadrant le point. */
export function cutAcross(poly, c, d) {
  const h1 = rayHit(poly, c, d);
  let [p1, i1] = insertHit(poly, h1);
  const h2 = rayHit(p1, c, mul(d, -1));
  let [p2, i2] = insertHit(p1, h2);
  const P1 = h1.point;
  const P2 = h2.point;
  i1 = indexOfPoint(p2, P1);
  i2 = indexOfPoint(p2, P2);
  return { poly: p2, a: P1, b: P2, ia: i1, ib: i2 };
}

/** Rééchantillonne une polyligne ouverte en n points à pas d'arc constant. */
export function resampleOpen(pts, n) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  const total = cum[cum.length - 1];
  const out = [];
  let k = 0;
  for (let i = 0; i < n; i++) {
    const s = (total * i) / (n - 1);
    while (k < pts.length - 2 && cum[k + 1] < s) k++;
    const seg = cum[k + 1] - cum[k] || 1;
    out.push(lerp(pts[k], pts[k + 1], Math.min(1, Math.max(0, (s - cum[k]) / seg))));
  }
  return out;
}

/** Densifie une polyligne (pas maximal). */
export function densify(pts, step, closed = false) {
  const out = [];
  const n = pts.length;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const k = Math.max(1, Math.ceil(dist(a, b) / step));
    for (let j = 0; j < k; j++) out.push(lerp(a, b, j / k));
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

/**
 * Appariement DTW de deux chaînes (bords gauche/droit d'un ruban).
 * Renvoie une suite de paires [iA, iB] monotone, du début à la fin.
 */
export function dtwPairs(A, B) {
  const n = A.length;
  const m = B.length;
  const INF = 1e18;
  const D = new Float64Array(n * m).fill(INF);
  const cost = (i, j) => dist(A[i], B[j]);
  D[0] = cost(0, 0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (!i && !j) continue;
      let best = INF;
      if (i > 0) best = Math.min(best, D[(i - 1) * m + j]);
      if (j > 0) best = Math.min(best, D[i * m + j - 1]);
      if (i > 0 && j > 0) best = Math.min(best, D[(i - 1) * m + j - 1]);
      D[i * m + j] = best + cost(i, j);
    }
  }
  const path = [[n - 1, m - 1]];
  let i = n - 1;
  let j = m - 1;
  while (i > 0 || j > 0) {
    let bi = i;
    let bj = j;
    let best = INF;
    if (i > 0 && j > 0 && D[(i - 1) * m + j - 1] < best) {
      best = D[(i - 1) * m + j - 1];
      bi = i - 1;
      bj = j - 1;
    }
    if (i > 0 && D[(i - 1) * m + j] < best) {
      best = D[(i - 1) * m + j];
      bi = i - 1;
      bj = j;
    }
    if (j > 0 && D[i * m + j - 1] < best) {
      best = D[i * m + j - 1];
      bi = i;
      bj = j - 1;
    }
    i = bi;
    j = bj;
    path.push([i, j]);
  }
  return path.reverse();
}

/**
 * Construit un ruban (bords L et R appariés, n paires) à partir de deux chaînes allant
 * du capuchon de départ au capuchon d'arrivée.
 */
export function ribbonFromChains(A, B, n) {
  const pairs = dtwPairs(A, B);
  const pa = pairs.map(([i]) => A[i]);
  const pb = pairs.map(([, j]) => B[j]);
  // paramètre : demi-somme des avancées sur chaque bord
  const cum = [0];
  for (let k = 1; k < pairs.length; k++) cum.push(cum[k - 1] + (dist(pa[k - 1], pa[k]) + dist(pb[k - 1], pb[k])) / 2);
  const total = cum[cum.length - 1];
  // paramètres d'échantillonnage uniformes, puis recalés sur les coins vifs (raccords exacts entre pièces)
  const params = [];
  for (let q = 0; q < n; q++) params.push((total * q) / (n - 1));
  const turn = (P, k) => {
    if (k === 0 || k === P.length - 1) return 0;
    const a = sub(P[k], P[k - 1]);
    const b = sub(P[k + 1], P[k]);
    if (len(a) < 1e-9 || len(b) < 1e-9) return 0;
    return Math.abs(Math.atan2(cross(a, b), dot(a, b)));
  };
  const step = total / (n - 1);
  for (let k = 1; k < pairs.length - 1; k++) {
    const sharp = Math.max(turn(pa, k), turn(pb, k));
    if (sharp < 0.5) continue;
    const q = Math.round(cum[k] / step);
    if (q > 0 && q < n - 1 && cum[k] > params[q - 1] && cum[k] < params[q + 1]) params[q] = cum[k];
  }
  const L = [];
  const R = [];
  let k = 0;
  for (let q = 0; q < n; q++) {
    const s = params[q];
    while (k < pairs.length - 2 && cum[k + 1] < s) k++;
    const seg = cum[k + 1] - cum[k];
    const t = seg > 0 ? Math.min(1, Math.max(0, (s - cum[k]) / seg)) : 0;
    L.push(lerp(pa[k], pa[k + 1], t));
    R.push(lerp(pb[k], pb[k + 1], t));
  }
  return { L, R };
}

/** Contour fermé d'un ruban : L à l'endroit puis R à l'envers. */
export const ribbonOutline = ({ L, R }) => [...L, ...R.slice().reverse()];
