"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Bouton d'action collé en bas de l'écran du téléphone, seulement quand le bouton de la page n'est plus visible.
 * Il n'existe que pour les pointeurs : le bouton d'origine reste le contrôle accessible (clavier, lecteur d'écran),
 * donc la copie est masquée des technologies d'assistance et n'entre pas dans l'ordre de tabulation.
 */
export interface StickyCta {
  key: string;
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}

interface Registry {
  cta: StickyCta | null;
  set: (cta: StickyCta | null) => void;
}

const Ctx = createContext<Registry>({ cta: null, set: () => undefined });

export function StickyCtaProvider({ children }: { children: ReactNode }) {
  const [cta, setCta] = useState<StickyCta | null>(null);
  const value = useMemo<Registry>(() => ({ cta, set: setCta }), [cta]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStickyCtaState(): StickyCta | null {
  return useContext(Ctx).cta;
}

/** Enregistre l'action de la page tant qu'elle est `active` ; le clic appelle toujours la version la plus récente. */
export function useStickyCta(cta: StickyCta | null, active: boolean) {
  const { set } = useContext(Ctx);
  const latest = useRef(cta);
  useEffect(() => {
    latest.current = cta;
  });
  const key = cta?.key;
  const label = cta?.label;
  const href = cta?.href;
  const disabled = cta?.disabled;
  const trigger = useCallback(() => latest.current?.onClick?.(), []);
  useEffect(() => {
    if (!active || !key || !label) return;
    set({ key, label, href, disabled, onClick: trigger });
    return () => set(null);
  }, [active, key, label, href, disabled, trigger, set]);
}

const TYPING = 'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="file"]), textarea, [contenteditable="true"]';

/** Vrai pendant la saisie : le clavier est ouvert, rien ne doit recouvrir les champs ni les messages. */
export function useTyping(): boolean {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    let timer: number | undefined;
    const onIn = (event: FocusEvent) => {
      window.clearTimeout(timer);
      if (event.target instanceof Element && event.target.matches(TYPING)) setTyping(true);
    };
    const onOut = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setTyping(false), 150);
    };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);
  return typing;
}

const barClass =
  "flex min-h-12 w-full items-center justify-center rounded-[12px] bg-chocolat px-4 text-center font-bold text-creme shadow-[0_4px_0_var(--ohm-cacao)] active:translate-y-px aria-disabled:opacity-60";

/** Rendue dans la barre mobile, au-dessus de la navigation. */
export function StickyCtaBar() {
  const cta = useStickyCtaState();
  const typing = useTyping();
  if (!cta || typing) return null;
  return (
    <div className="mx-3 mb-2" data-testid="cta-collant">
      {cta.href && !cta.disabled ? (
        <Link href={cta.href} aria-hidden tabIndex={-1} className={barClass}>
          {cta.label}
        </Link>
      ) : (
        <button type="button" aria-hidden tabIndex={-1} disabled={cta.disabled} onClick={cta.onClick} className={cn(barClass, "disabled:cursor-not-allowed")}>
          {cta.label}
        </button>
      )}
    </div>
  );
}
