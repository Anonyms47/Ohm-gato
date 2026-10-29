"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * OHMEGATO = OMEGA (Ω) + TO (Τ) : le nom se sépare en ses deux moitiés, puis chaque moitié révèle sa lettre grecque.
 * Joué une fois à l'entrée dans l'écran ; version fixe sans animation si les animations sont réduites.
 */
const LEFT = "OHMEGA";
const RIGHT = "TO";

export function TypoTransformation() {
  const ref = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [animated, setAnimated] = useState(true);

  const play = () => {
    setStage(0);
    window.setTimeout(() => setStage(1), 900);
    window.setTimeout(() => setStage(2), 2000);
  };

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- préférence lue une seule fois
      setAnimated(false);
      return;
    }
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        play();
      },
      { threshold: 0.5 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const word = "font-display text-[clamp(2.2rem,9vw,5rem)] tracking-[0.04em]";
  const letter = "font-display text-[clamp(2.4rem,9vw,4.5rem)] leading-none text-rose-encre";

  if (!animated) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className={word}>OHMEGATO</p>
        <p aria-hidden className="text-[1.6rem]">↓</p>
        <p className="flex flex-wrap items-baseline justify-center gap-x-5 gap-y-1">
          <span className="font-bold">
            OMEGA <span className={letter}>Ω</span>
          </span>
          <span aria-hidden>+</span>
          <span className="font-bold">
            TO <span className={letter}>Τ</span>
          </span>
        </p>
        <p className="sr-only">OHMEGATO associe OMEGA (Ω) et TO (Τ).</p>
      </div>
    );
  }

  return (
    <div ref={ref} className="flex flex-col items-center gap-4">
      <p className="sr-only">OHMEGATO associe OMEGA (Ω) et TO (Τ).</p>
      <div aria-hidden className="flex min-h-[clamp(9rem,26vw,13rem)] w-full flex-col items-center justify-center gap-2">
        <p className={cn("flex transition-[gap] duration-700 ease-[var(--ohm-courbe)]", stage >= 1 ? "gap-6 sm:gap-10" : "gap-0")}>
          <span className={word}>{LEFT}</span>
          <span className={cn(word, "text-caramel-encre")}>{RIGHT}</span>
        </p>
        <p className={cn("flex items-baseline gap-6 transition-[opacity,transform] duration-700 ease-[var(--ohm-courbe)] sm:gap-10", stage === 2 ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0")}>
          <span className={letter}>Ω</span>
          <span className={cn(letter, "text-caramel-encre")}>Τ</span>
        </p>
      </div>
      <button type="button" onClick={play} className="min-h-11 font-bold underline decoration-caramel decoration-2 underline-offset-4">
        Rejouer l&apos;animation
      </button>
    </div>
  );
}
