"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const FROM = ["Ou", "my", " Gâ", "teau"];
const TO = ["OH", "ME", "GA", "TO"];

/**
 * Oumy Gâteau → OHMEGATO → Ω : les syllabes glissent d'un nom à l'autre, puis se
 * replient en Oméga. Joué une fois à l'entrée dans l'écran ; version fixe sans animation.
 */
export function TypoTransformation() {
  const ref = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [animated, setAnimated] = useState(true);

  const play = () => {
    setStage(0);
    window.setTimeout(() => setStage(1), 900);
    window.setTimeout(() => setStage(2), 2100);
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

  if (!animated) {
    return (
      <div className="flex flex-col items-center gap-3 text-center" aria-label="Oumy Gâteau, devenu OHMEGATO, puis Ω">
        <p className="font-script text-[clamp(2rem,7vw,3.4rem)] text-caramel-encre">Oumy Gâteau</p>
        <p aria-hidden className="text-[1.6rem]">↓</p>
        <p className="font-display text-[clamp(2.4rem,9vw,5rem)] tracking-[0.04em]">OHMEGATO</p>
        <p aria-hidden className="text-[1.6rem]">↓</p>
        <p className="font-display text-[clamp(4rem,14vw,8rem)] leading-none text-rose-encre">Ω</p>
      </div>
    );
  }

  return (
    <div ref={ref} className="flex flex-col items-center gap-4">
      <p className="sr-only">Oumy Gâteau, devenu OHMEGATO, puis Ω.</p>
      <div aria-hidden className="relative grid min-h-[clamp(9rem,26vw,13rem)] w-full place-items-center">
        {/* Étapes 1 et 2 : les syllabes changent d'écriture sans changer de place */}
        <p
          className={cn(
            "flex flex-wrap justify-center transition-[opacity,transform] duration-700 ease-[var(--ohm-courbe)]",
            stage === 2 && "scale-50 opacity-0",
          )}
        >
          {FROM.map((syllable, index) => (
            <span key={index} className="relative inline-grid">
              <span
                className={cn(
                  "col-start-1 row-start-1 whitespace-pre font-script text-[clamp(2.2rem,8vw,4rem)] text-caramel-encre transition-[opacity,transform] duration-500",
                  stage >= 1 && "-translate-y-3 opacity-0",
                )}
                style={{ transitionDelay: `${index * 90}ms` }}
              >
                {syllable}
              </span>
              <span
                className={cn(
                  "col-start-1 row-start-1 font-display text-[clamp(2.4rem,9vw,5rem)] tracking-[0.04em] transition-[opacity,transform] duration-500",
                  stage >= 1 ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
                )}
                style={{ transitionDelay: `${index * 90 + 120}ms` }}
              >
                {TO[index]}
              </span>
            </span>
          ))}
        </p>
        {/* Étape 3 : Oméga */}
        <p
          className={cn(
            "absolute font-display text-[clamp(5rem,18vw,10rem)] leading-none text-rose-encre transition-[opacity,transform] duration-700 ease-[var(--ohm-courbe)]",
            stage === 2 ? "scale-100 opacity-100" : "scale-150 opacity-0",
          )}
        >
          Ω
        </p>
      </div>
      <button type="button" onClick={play} className="min-h-11 font-bold underline decoration-caramel decoration-2 underline-offset-4">
        Rejouer la transformation
      </button>
    </div>
  );
}
