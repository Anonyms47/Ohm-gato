"use client";

import { useEffect, useState } from "react";
import { useTyping } from "@/components/layout/StickyCta";

/**
 * Retour en haut de page sur téléphone : apparaît après deux écrans de défilement, au-dessus de la barre du bas
 * (sa hauteur est publiée par la barre mobile), et se retire pendant la saisie. Respecte la préférence « animations réduites ».
 */
export function BackToTop() {
  const [visible, setVisible] = useState(false);
  const typing = useTyping();
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 1.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!visible || typing) return null;
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}
      aria-label="Revenir en haut de la page"
      data-testid="retour-haut"
      className="fixed right-3 z-30 grid size-12 place-items-center rounded-full border-2 border-chocolat bg-creme text-chocolat shadow-[0_3px_0_var(--ohm-cacao)] print:hidden md:hidden"
      style={{ bottom: "calc(var(--mobile-bottom, 4rem) + 0.75rem)" }}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m6 15 6-6 6 6" />
      </svg>
    </button>
  );
}
