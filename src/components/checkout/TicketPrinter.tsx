"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const PRINTED_KEY = "ohmegato.ticket-imprime";

/**
 * Petite imprimante OHMEGATO : le récapitulatif descend comme un ticket.
 * L'animation ne se rejoue pas pour une même boîte, peut être ignorée, et
 * disparaît si l'utilisateur préfère réduire les animations.
 */
export function TicketPrinter({ signature, children }: { signature: string; children: ReactNode }) {
  const [phase, setPhase] = useState<"ready" | "printing" | "printed">("ready");

  useEffect(() => {
    let already = false;
    try {
      already = window.sessionStorage.getItem(PRINTED_KEY) === signature;
    } catch {
      already = false;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- état lu depuis la session du navigateur
    if (already) setPhase("printed");
  }, [signature]);

  useEffect(() => {
    if (phase !== "printing") return;
    const timer = window.setTimeout(() => setPhase("printed"), 1800);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const print = () => {
    try {
      window.sessionStorage.setItem(PRINTED_KEY, signature);
    } catch {
      // sans stockage, l'impression se rejouera simplement
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPhase(reduce ? "printed" : "printing");
  };

  return (
    <div className="flex flex-col items-center">
      {/* Imprimante chocolat, crème et rose, marquée Ω */}
      <div aria-hidden className="relative z-10 w-[min(22rem,100%)]">
        <div className="relative rounded-t-[22px] rounded-b-[10px] bg-chocolat px-5 pb-6 pt-4 shadow-[0_4px_0_var(--ohm-cacao)]">
          <div className="flex items-center justify-between">
            <span className="grid size-9 place-items-center rounded-full bg-rose font-display text-[1.3rem] text-cacao">Ω</span>
            <span className={cn("size-3 rounded-full", phase === "printing" ? "bg-rose" : "bg-creme/40")} />
          </div>
          <div className="mt-4 h-3 rounded-full bg-cacao" />
        </div>
      </div>

      <div className="-mt-3 w-[min(20rem,92%)] overflow-hidden">
        {phase === "ready" ? (
          <div className="h-4" />
        ) : (
          <div
            className={cn(
              "bg-blanc-casse px-5 pb-6 pt-6 shadow-[0_6px_14px_-8px_rgb(36_20_13/0.4)]",
              phase === "printing" && "animate-[ohm-impression_1800ms_cubic-bezier(0.3,0.1,0.3,1)_both]",
            )}
          >
            {children}
            {/* Bord dentelé */}
            <svg aria-hidden viewBox="0 0 100 4" preserveAspectRatio="none" className="-mx-5 -mb-6 mt-5 block h-3 w-[calc(100%+2.5rem)] translate-y-[2px] text-creme">
              <path d="M0 4 L5 0 L10 4 L15 0 L20 4 L25 0 L30 4 L35 0 L40 4 L45 0 L50 4 L55 0 L60 4 L65 0 L70 4 L75 0 L80 4 L85 0 L90 4 L95 0 L100 4 Z" fill="currentColor" />
            </svg>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col items-center gap-2">
        {phase === "ready" && (
          <button
            type="button"
            onClick={print}
            className="min-h-12 rounded-[10px] border-2 border-chocolat bg-creme px-6 font-bold hover:bg-blanc-casse"
          >
            Imprimer mon récapitulatif
          </button>
        )}
        {phase === "printing" && (
          <button type="button" onClick={() => setPhase("printed")} className="min-h-11 font-bold underline decoration-caramel decoration-2 underline-offset-4">
            Passer l&apos;animation
          </button>
        )}
      </div>
    </div>
  );
}
