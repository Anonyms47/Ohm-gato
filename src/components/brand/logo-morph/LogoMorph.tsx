"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { frameAt, svgTransform, type MorphData } from "./engine";

/**
 * Animation « ohmegato » → symbole muffin (6 s), construite sur les SVG officiels de public/brand.
 * Les lettres se déroulent en rubans, glissent sur leurs rails et forment chacune une pièce du symbole ;
 * départ et arrivée affichent les tracés officiels eux-mêmes. Avec prefers-reduced-motion, le symbole final
 * est affiché tel quel, sans mouvement.
 *
 * Responsive : la scène suit la largeur de son conteneur ; sur écran étroit, le cadrage se resserre autour
 * de la zone utile (sans zoom ni mouvement de caméra pendant la lecture).
 */

export type LogoMorphHandle = {
  /** relance depuis le début */
  play: () => void;
  /** affiche l'instant t (secondes), lecture suspendue */
  seek: (t: number) => void;
};

type Props = {
  className?: string;
  /** lecture automatique au montage (défaut : oui) */
  autoPlay?: boolean;
  /** cadrage : scène 16:9 complète, serré, ou automatique selon la largeur (défaut) */
  framing?: "scene" | "tight" | "auto";
  /** appelé à la fin de chaque lecture */
  onEnd?: () => void;
};

const SCENE = "0 0 1920 1080";
const TIGHT = "220 90 1480 900";
const CREAM = "#F5E9D6";
const CHOCOLATE = "#3A2418";
const ROSE = "#DCA7AE";

let dataPromise: Promise<MorphData> | null = null;
const loadData = () => (dataPromise ??= import("./morph-data.json").then((m) => m.default as unknown as MorphData));

export const LogoMorph = forwardRef<LogoMorphHandle, Props>(function LogoMorph(
  { className, autoPlay = true, framing = "auto", onEnd },
  ref,
) {
  const bodyRef = useRef<SVGPathElement>(null);
  const diamondRef = useRef<SVGPathElement>(null);
  const dataRef = useRef<MorphData | null>(null);
  const rafRef = useRef(0);
  const [data, setData] = useState<MorphData | null>(null);
  const [reduced, setReduced] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  const draw = useCallback((t: number) => {
    const data = dataRef.current;
    const body = bodyRef.current;
    const diamond = diamondRef.current;
    if (!data || !body || !diamond) return;
    const f = frameAt(data, t);
    if (f.mode === "ribbons") {
      body.setAttribute("d", f.body);
      body.removeAttribute("transform");
    } else {
      const src = f.mode === "logo" ? data.logo : data.symbol;
      body.setAttribute("d", src.d);
      body.setAttribute("transform", svgTransform(src.transform));
    }
    diamond.setAttribute("opacity", String(f.diamond));
  }, []);

  const play = useCallback(() => {
    const data = dataRef.current;
    if (!data) return;
    cancelAnimationFrame(rafRef.current);
    let start = -1;
    const tick = (now: number) => {
      if (start < 0) start = now;
      const t = (now - start) / 1000;
      draw(Math.min(t, data.duration));
      if (t < data.duration) rafRef.current = requestAnimationFrame(tick);
      else onEndRef.current?.();
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [draw]);

  const seek = useCallback(
    (t: number) => {
      cancelAnimationFrame(rafRef.current);
      draw(t);
    },
    [draw],
  );

  useImperativeHandle(ref, () => ({ play, seek }), [play, seek]);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const width = window.matchMedia("(max-width: 699px)");
    const update = () => {
      setReduced(motion.matches);
      setNarrow(width.matches);
    };
    update();
    motion.addEventListener("change", update);
    width.addEventListener("change", update);
    return () => {
      motion.removeEventListener("change", update);
      width.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (reduced) return;
    let alive = true;
    loadData().then((loaded) => {
      if (!alive) return;
      dataRef.current = loaded;
      setData(loaded);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [reduced]);

  useEffect(() => {
    if (!data || reduced) return;
    draw(0);
    if (autoPlay) play();
  }, [data, reduced, autoPlay, draw, play]);

  const viewBox = framing === "scene" ? SCENE : framing === "tight" || narrow ? TIGHT : SCENE;

  return (
    <svg
      viewBox={viewBox}
      role="img"
      aria-label="Le logotype ohmegato se transforme en symbole OHMEGATO"
      className={cn("block h-auto w-full", className)}
      style={{ background: CREAM }}
    >
      {reduced ? (
        <StaticSymbol />
      ) : (
        <>
          <path ref={bodyRef} fill={CHOCOLATE} />
          {data && <path ref={diamondRef} fill={ROSE} opacity={0} d={data.diamond.d} transform={svgTransform(data.diamond.transform)} />}
        </>
      )}
    </svg>
  );
});

/** Affichage fixe (mouvement réduit) : le symbole officiel, à sa place finale dans la scène. */
function StaticSymbol() {
  // matrice identique à celle de la scène animée (échelle 0,48, centrage sur 960 × 540)
  const transform = "matrix(0.48 0 0 0.48 720 117.36)";
  return <image href="/brand/symbole-ohmegato.svg" width={1000} height={1761} transform={transform} />;
}
