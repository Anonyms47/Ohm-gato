"use client";

import { cn } from "@/lib/cn";

/** Sélecteur de quantité : boutons de 44 px, valeur annoncée. */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  label,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max: number;
  /** Ex. « Quantité de Cookies, Box de 6 ». */
  label: string;
  className?: string;
}) {
  const button =
    "grid size-11 place-items-center rounded-full text-[1.4rem] font-bold leading-none text-chocolat " +
    "hover:bg-chocolat/10 disabled:cursor-not-allowed disabled:opacity-35";
  return (
    <div role="group" aria-label={label} className={cn("inline-flex items-center rounded-full border-2 border-chocolat/35 bg-blanc-casse", className)}>
      <button
        type="button"
        className={button}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Retirer un"
      >
        −
      </button>
      <output aria-live="polite" className="min-w-8 text-center text-[1.1rem] font-bold tabular-nums">
        {value}
      </output>
      <button
        type="button"
        className={button}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Ajouter un"
      >
        +
      </button>
    </div>
  );
}
