/**
 * Moteur du morphing « ohmegato » → symbole muffin.
 *
 * Chaque lettre est un ruban : deux bords appariés (gauche/droit) le long d'une âme. Pendant l'animation,
 * chaque point de l'âme glisse sur un rail (lettre → trajectoire en S → pièce du symbole), la tête en premier,
 * le reste suivant avec un léger retard. Les bords sont exprimés dans le repère local du rail : la forme de
 * départ et celle d'arrivée sont reconstruites exactement, l'entre-deux reste un ruban sans torsion.
 * Fichier sans dépendance (TypeScript effaçable) : il sert aussi aux scripts de contrôle et d'export vidéo.
 */

export type RibbonData = {
  /** nom de la lettre (o1, h, m, e, g, a, t, o2) */
  id: string;
  /** nombre de paires de points */
  n: number;
  /** rail : x, y, angle de tangente (rad) et abscisse curviligne cumulée, à plat */
  track: number[];
  /** position de départ / d'arrivée de chaque paire sur le rail */
  uSrc: number[];
  uTgt: number[];
  /** décalages locaux (tangente, normale) des bords gauche puis droit au départ : aL, bL, aR, bR par paire */
  offSrc: number[];
  /** points d'arrivée exacts : xL, yL, xR, yR par paire */
  tgt: number[];
  /** fenêtre temporelle (s) et retard de la queue (fraction de la fenêtre) */
  t0: number;
  t1: number;
  lag: number;
  /** 1 : la tête mène ; -1 : la queue mène (la panse du g s'enroule d'abord dans le fût) */
  lead: number;
  /** part « glissement en ruban » (1) / « pose progressive » (0) par paire, lissée ; facultatif */
  lam?: number[];
  /** déformation du temps local (1 = aucune, > 1 : départ plus retenu) */
  warp: number;
  /** demi-largeur du ruban en vol (px de scène, signée pour le bord gauche) */
  hn: number;
  /** distance de rail sur laquelle la lettre se délie / la pièce prend forme (px) */
  ds: number;
  dt: number;
};

/** Tracé officiel, inchangé, avec sa mise à l'échelle dans la scène : [échelle, tx, ty]. */
export type OfficialPath = { d: string; transform: [number, number, number] };

export type MorphData = {
  width: number;
  height: number;
  duration: number;
  /** logotype officiel, symbole officiel (Ω + caissette) et losange officiel */
  logo: OfficialPath;
  symbol: OfficialPath;
  diamond: OfficialPath;
  /** l'animation affiche les rubans entre ces deux instants, les tracés officiels en dehors */
  morphStart: number;
  morphEnd: number;
  diamondIn: [number, number];
  ribbons: RibbonData[];
};

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
/** départ lent, glissement fluide, arrivée progressive, sans rebond */
export const ease = (x: number) => {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/** Position et angle sur le rail à l'abscisse u (recherche dichotomique, interpolation linéaire). */
function sample(track: number[], u: number, out: Float64Array) {
  const count = track.length / 4;
  let lo = 0;
  let hi = count - 1;
  if (u <= track[3]!) hi = 1;
  else if (u >= track[(count - 1) * 4 + 3]!) lo = count - 2;
  else {
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (track[mid * 4 + 3]! <= u) lo = mid;
      else hi = mid;
    }
  }
  const i = lo * 4;
  const j = hi * 4;
  const span = track[j + 3]! - track[i + 3]!;
  const t = span > 0 ? Math.min(1, Math.max(0, (u - track[i + 3]!) / span)) : 0;
  out[0] = track[i]! + (track[j]! - track[i]!) * t;
  out[1] = track[i + 1]! + (track[j + 1]! - track[i + 1]!) * t;
  out[2] = track[i + 2]! + (track[j + 2]! - track[i + 2]!) * t;
}

/** Points du contour d'un ruban au temps t (secondes) : L à l'endroit puis R à l'envers. */
export function ribbonPoints(r: RibbonData, time: number): Float64Array {
  const pts = new Float64Array(r.n * 4);
  const tau = Math.pow(clamp01((time - r.t0) / (r.t1 - r.t0)), r.warp);
  const s = new Float64Array(3);
  const last = r.n - 1;
  for (let k = 0; k < r.n; k++) {
    // la tête (k = n - 1) part la première, la queue suit avec un retard (ou l'inverse si lead < 0)
    const lagK = r.lag * (r.lead > 0 ? 1 - k / last : k / last);
    const e = ease((tau - lagK) / (1 - r.lag));
    const u0 = r.uSrc[k]!;
    const u1 = r.uTgt[k]!;
    const u = u0 + (u1 - u0) * e;
    sample(r.track, u, s);
    const c = Math.cos(s[2]!);
    const sn = Math.sin(s[2]!);
    // forme de la lettre → ruban neutre sur les ds premiers px de rail, puis pose sur la position exacte
    // de la pièce pendant les dt derniers px. La matière qui se déplace peu (g) passe progressivement de l'un à l'autre.
    const span = Math.abs(u1 - u0);
    const reach = r.ds + r.dt;
    const lambda = r.lam ? r.lam[k]! : clamp01((span - reach) / reach);
    const ws = lambda * smooth((u - u0) / r.ds);
    const wt = lambda * smooth(1 - (u1 - u) / r.dt) + (1 - lambda) * smooth(e);
    const o = k * 4;
    const aL = r.offSrc[o]! * (1 - ws);
    const bL = r.offSrc[o + 1]! + (r.hn - r.offSrc[o + 1]!) * ws;
    const aR = r.offSrc[o + 2]! * (1 - ws);
    const bR = r.offSrc[o + 3]! + (-r.hn - r.offSrc[o + 3]!) * ws;
    const lx = s[0]! + aL * c - bL * sn;
    const ly = s[1]! + aL * sn + bL * c;
    const rx = s[0]! + aR * c - bR * sn;
    const ry = s[1]! + aR * sn + bR * c;
    pts[k * 2] = lx + (r.tgt[o]! - lx) * wt;
    pts[k * 2 + 1] = ly + (r.tgt[o + 1]! - ly) * wt;
    // R (stocké à l'envers à la suite de L)
    const q = (2 * r.n - 1 - k) * 2;
    pts[q] = rx + (r.tgt[o + 2]! - rx) * wt;
    pts[q + 1] = ry + (r.tgt[o + 3]! - ry) * wt;
  }
  return pts;
}

const fmt = (v: number) => (Math.round(v * 10) / 10).toString();

/** Attribut d du ruban au temps t. */
export function ribbonPath(r: RibbonData, time: number): string {
  const p = ribbonPoints(r, time);
  let d = "M" + fmt(p[0]!) + " " + fmt(p[1]!);
  for (let i = 2; i < p.length; i += 2) d += "L" + fmt(p[i]!) + " " + fmt(p[i + 1]!);
  return d + "Z";
}

export type Frame =
  | { mode: "logo"; diamond: number }
  | { mode: "ribbons"; body: string; diamond: number }
  | { mode: "symbol"; diamond: number };

/** Image de l'animation au temps t (secondes) : tracés officiels au départ et à l'arrivée, rubans entre les deux. */
export function frameAt(data: MorphData, time: number): Frame {
  const [d0, d1] = data.diamondIn;
  const diamond = ease((time - d0) / (d1 - d0));
  if (time <= data.morphStart) return { mode: "logo", diamond };
  if (time >= data.morphEnd) return { mode: "symbol", diamond };
  return { mode: "ribbons", body: data.ribbons.map((r) => ribbonPath(r, time)).join(""), diamond };
}

export const svgTransform = ([s, tx, ty]: [number, number, number]) => `matrix(${s} 0 0 ${s} ${tx} ${ty})`;
