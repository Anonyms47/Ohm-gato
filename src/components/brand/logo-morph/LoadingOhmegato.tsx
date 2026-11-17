"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { erasingAt, writingAt, writingTransform, type WritingData } from "./writing";

/**
 * Écran de chargement OHMEGATO : le logotype officiel s'écrit d'un geste vif, se tient, puis se retire
 * lettre après lettre, en boucle tant que le chargement dure. Couleurs de la charte, caméra fixe.
 * Mouvement réduit : logotype officiel fixe.
 */

const CREAM = "#F5E9D6";
const CHOCOLATE = "#3A2418";
// cadrage serré autour du logotype dans la scène 1920 × 1080
const VIEWBOX = "204 290 1512 500";
// cycle : écriture (0 → writeEnd), tenue, effacement, court silence
const HOLD = 0.75;
const ERASE = 0.7;
const REST = 0.25;

let dataPromise: Promise<WritingData> | null = null;
const loadData = () => (dataPromise ??= import("./loading-data.json").then((m) => m.default as unknown as WritingData));

type Props = {
  className?: string;
  /** plein écran au-dessus de la page (défaut) ou intégré dans son conteneur */
  overlay?: boolean;
  /** texte annoncé aux lecteurs d'écran */
  label?: string;
};

export function LoadingOhmegato({ className, overlay = true, label = "Chargement en cours" }: Props) {
  const pathRef = useRef<SVGPathElement>(null);
  const [data, setData] = useState<WritingData | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(motion.matches);
    update();
    motion.addEventListener("change", update);
    let alive = true;
    loadData().then((loaded) => alive && setData(loaded));
    return () => {
      alive = false;
      motion.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    const el = pathRef.current;
    if (!data || !el) return;
    const official = () => {
      el.setAttribute("d", data.logo.d);
      el.setAttribute("transform", writingTransform(data.logo.transform));
    };
    if (reduced) {
      official();
      return;
    }
    const cycle = data.writeEnd + HOLD + ERASE + REST;
    let raf = 0;
    let start = -1;
    const tick = (now: number) => {
      if (start < 0) start = now;
      const t = ((now - start) / 1000) % cycle;
      const writing = t < data.writeEnd ? writingAt(data, t) : null;
      if (writing !== null) {
        el.setAttribute("d", writing);
        el.removeAttribute("transform");
      } else if (t < data.writeEnd + HOLD) {
        official();
      } else {
        el.setAttribute("d", erasingAt(data, Math.min(1, (t - data.writeEnd - HOLD) / ERASE)));
        el.removeAttribute("transform");
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [data, reduced]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(overlay ? "fixed inset-0 z-50" : "w-full", "flex items-center justify-center px-6", className)}
      style={{ background: CREAM }}
    >
      <span className="sr-only">{label}</span>
      <svg viewBox={VIEWBOX} aria-hidden className="block h-auto w-full max-w-[44rem]">
        <path ref={pathRef} fill={CHOCOLATE} />
      </svg>
    </div>
  );
}
