"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const DRAWN_KEY = "ohmegato.annotations";

/**
 * Flèche manuscrite des affiches. Elle se dessine une seule fois par visite,
 * quand elle entre à l'écran ; sans animation si l'utilisateur le demande.
 */
export function HandArrow({ id, className, path = "M6 10 C 40 4, 78 20, 92 58 M 78 50 L 92 60 L 98 44" }: { id: string; className?: string; path?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [state, setState] = useState<"idle" | "drawing" | "done">("idle");

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let drawn: string[] = [];
    try {
      drawn = JSON.parse(window.sessionStorage.getItem(DRAWN_KEY) ?? "[]") as string[];
    } catch {
      drawn = [];
    }
    if (drawn.includes(id) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- état initial lu depuis le navigateur
      setState("done");
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setState("drawing");
        try {
          window.sessionStorage.setItem(DRAWN_KEY, JSON.stringify([...drawn, id]));
        } catch {
          // sans stockage, la flèche se redessinera à la prochaine visite
        }
        observer.disconnect();
      },
      { threshold: 0.6 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [id]);

  return (
    <svg ref={ref} aria-hidden viewBox="0 0 100 70" fill="none" className={cn("overflow-visible text-caramel-encre", className)}>
      <path
        d={path}
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={state === "done" ? 0 : 1}
        style={state === "drawing" ? { animation: "ohm-trace 900ms var(--ohm-courbe) forwards" } : undefined}
      />
    </svg>
  );
}
