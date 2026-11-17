/**
 * Écriture du logotype officiel « ohmegato » trait par trait (sans dépendance, TypeScript effaçable).
 * Chaque lettre est un ruban (bords gauche/droit appariés) révélé de son début à sa fin, comme un geste de plume.
 * Sert à la vidéo d'écriture et à l'écran de chargement.
 */

export type WritingLetter = {
  id: string;
  /** xL, yL, xR, yR par paire, dans l'ordre du geste */
  pts: number[];
  t0: number;
  t1: number;
  /** "linear" : vitesse conservée vers / depuis la lettre liée (m → e) */
  out?: "linear";
  in?: "linear";
};

export type WritingData = {
  width: number;
  height: number;
  /** tracé officiel du logotype et sa mise à l'échelle [échelle, tx, ty] */
  logo: { d: string; transform: [number, number, number] };
  /** fin de l'écriture : le tracé officiel s'affiche à partir de cet instant */
  writeEnd: number;
  letters: WritingLetter[];
};

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Avancement (0 → 1) du geste d'une lettre au temps t. */
export function letterProgress(l: WritingLetter, t: number): number {
  const x = clamp01((t - l.t0) / (l.t1 - l.t0));
  if (l.out === "linear") return x * x;
  if (l.in === "linear") return 1 - (1 - x) * (1 - x);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

const f1 = (v: number) => (Math.round(v * 10) / 10).toString();

/** Contour de la partie écrite d'une lettre, de from à to (fractions du geste). */
export function strokePath(l: WritingLetter, from: number, to: number): string {
  const n = l.pts.length / 4;
  if (to <= from || to <= 0 || from >= 1) return "";
  const at = (k: number, side: 0 | 2): [number, number] => {
    const i = Math.min(n - 2, Math.floor(k));
    const f = k - i;
    const a = i * 4 + side;
    const b = (i + 1) * 4 + side;
    return [l.pts[a]! + (l.pts[b]! - l.pts[a]!) * f, l.pts[a + 1]! + (l.pts[b + 1]! - l.pts[a + 1]!) * f];
  };
  const k0 = clamp01(from) * (n - 1);
  const k1 = clamp01(to) * (n - 1);
  const L: [number, number][] = [at(k0, 0)];
  const R: [number, number][] = [at(k0, 2)];
  for (let k = Math.floor(k0) + 1; k < k1; k++) {
    L.push([l.pts[k * 4]!, l.pts[k * 4 + 1]!]);
    R.push([l.pts[k * 4 + 2]!, l.pts[k * 4 + 3]!]);
  }
  L.push(at(k1, 0));
  R.push(at(k1, 2));
  const pts = [...L, ...R.reverse()];
  return "M" + pts.map((q) => f1(q[0]) + " " + f1(q[1])).join("L") + "Z";
}

/** Logotype en cours d'écriture au temps t (null : afficher le tracé officiel). */
export function writingAt(data: WritingData, t: number): string | null {
  if (t >= data.writeEnd) return null;
  return data.letters.map((l) => strokePath(l, 0, letterProgress(l, t))).join("");
}

/**
 * Effacement : chaque lettre se retire dans l'ordre d'écriture, sa fin suivant son début (le trait « repart »).
 * u : 0 → logotype complet, 1 → page vide.
 */
export function erasingAt(data: WritingData, u: number): string {
  const count = data.letters.length;
  return data.letters
    .map((l, i) => {
      const start = (i / count) * 0.55;
      const x = clamp01((u - start) / 0.45);
      const e = x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
      return strokePath(l, e, 1);
    })
    .join("");
}

export const writingTransform = ([s, tx, ty]: [number, number, number]) => `matrix(${s} 0 0 ${s} ${tx} ${ty})`;
