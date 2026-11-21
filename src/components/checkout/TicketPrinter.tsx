"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const PRINTED_KEY = "ohmegato.ticket-imprime";
/** Durée de l'animation (ms) ; au-delà, le ticket est affiché tel quel. */
const PRINT_MS = 1800;
/** Sans démarrage d'animation dans ce délai (ms), le ticket est affiché immédiatement. */
const START_GRACE_MS = 600;

/**
 * Petite imprimante OHMEGATO : le récapitulatif descend comme un ticket.
 * L'animation est purement décorative : le ticket est un contenu normal qui reste visible si elle échoue,
 * s'affiche tout de suite si l'on préfère réduire les animations, ne se rejoue pas pour une même boîte
 * et ne bloque jamais la commande. Le ticket est aussi présent à l'impression du navigateur.
 */
export function TicketPrinter({ signature, children }: { signature: string; children: ReactNode }) {
  const [phase, setPhase] = useState<"ready" | "printing" | "printed">("ready");
  const ticketRef = useRef<HTMLDivElement>(null);
  const animationStarted = useRef(false);
  const requested = useRef(false);

  // Boîte déjà imprimée dans cette session, ou animations réduites : récapitulatif statique tout de suite.
  useEffect(() => {
    let already = false;
    try {
      already = window.sessionStorage.getItem(PRINTED_KEY) === signature;
    } catch {
      already = false;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- état lu depuis la session et les préférences du navigateur
    if (already || reduce) setPhase("printed");
  }, [signature]);

  useEffect(() => {
    if (phase !== "printing") return;
    animationStarted.current = false;
    const end = window.setTimeout(() => setPhase("printed"), PRINT_MS);
    // Animation qui ne démarre pas (navigateur, mode économie d'énergie) : on affiche le ticket sans attendre.
    const grace = window.setTimeout(() => {
      if (!animationStarted.current) setPhase("printed");
    }, START_GRACE_MS);
    return () => {
      window.clearTimeout(end);
      window.clearTimeout(grace);
    };
  }, [phase]);

  // Après un appui sur « Imprimer » : le ticket est ramené dans l'écran (au-dessus de la barre fixe du bas).
  useEffect(() => {
    if (phase === "ready" || !requested.current) return;
    requested.current = false;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ticketRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [phase]);

  const print = () => {
    try {
      window.sessionStorage.setItem(PRINTED_KEY, signature);
    } catch {
      // sans stockage, l'impression se rejouera simplement
    }
    requested.current = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPhase(reduce ? "printed" : "printing");
  };

  return (
    <div className="flex flex-col items-center">
      {/* Imprimante chocolat, crème et rose, marquée Ω */}
      <div aria-hidden className="relative z-10 w-[min(22rem,100%)] print:hidden">
        <div className="relative rounded-t-[22px] rounded-b-[10px] bg-chocolat px-5 pb-6 pt-4 shadow-[0_4px_0_var(--ohm-cacao)]">
          <div className="flex items-center justify-between">
            <span className="grid size-9 place-items-center rounded-full bg-rose font-display text-[1.3rem] text-cacao">Ω</span>
            <span className={cn("size-3 rounded-full", phase === "printing" ? "bg-rose" : "bg-creme/40")} />
          </div>
          <div className="mt-4 h-3 rounded-full bg-cacao" />
        </div>
      </div>

      {/* Le rognage n'existe que pendant l'animation : le ticket n'est jamais coupé une fois imprimé. */}
      <div className={cn("-mt-3 w-[min(20rem,92%)] print:mt-0 print:w-full", phase === "printing" && "overflow-hidden")}>
        {phase === "ready" && <div className="h-4 print:hidden" />}
        <div
          ref={ticketRef}
          data-testid="ticket-recapitulatif"
          data-phase={phase}
          onAnimationStart={() => {
            animationStarted.current = true;
          }}
          className={cn(
            "bg-blanc-casse px-5 pb-6 pt-6 ring-1 ring-chocolat/15 shadow-[0_6px_14px_-8px_rgb(36_20_13/0.4)]",
            phase === "ready" && "hidden print:block",
            phase === "printing" && "animate-[ohm-impression_1800ms_cubic-bezier(0.3,0.1,0.3,1)_backwards]",
          )}
        >
          {children}
          {/* Bord dentelé */}
          <svg aria-hidden viewBox="0 0 100 4" preserveAspectRatio="none" className="-mx-5 -mb-6 mt-5 block h-3 w-[calc(100%+2.5rem)] translate-y-[2px] text-creme">
            <path d="M0 4 L5 0 L10 4 L15 0 L20 4 L25 0 L30 4 L35 0 L40 4 L45 0 L50 4 L55 0 L60 4 L65 0 L70 4 L75 0 L80 4 L85 0 L90 4 L95 0 L100 4 Z" fill="currentColor" />
          </svg>
        </div>
      </div>

      <div className="mt-4 flex flex-col items-center gap-2 print:hidden">
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
