"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AtelierIcon } from "@/components/admin/AtelierIcons";
import { CommandPalette } from "@/components/admin/CommandPalette";
import { MOBILE_TABS, NAV_GROUPS, isActive } from "@/components/admin/nav";
import { cn } from "@/lib/cn";

const STORAGE_KEY = "ohm-atelier-groupes-replies";

function readCollapsed(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/** Administration d'Alima : l'atelier, séparé du site client (aucun panier, aucune navigation client). */
export function AdminShell({ name, badges, children }: { name: string; badges?: Record<string, number>; children: ReactNode }) {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const [palette, setPalette] = useState(false);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const moreRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    document.documentElement.dataset.hydrated = "true"; // repère pour les tests de bout en bout
    // eslint-disable-next-line react-hooks/set-state-in-effect -- préférence locale lue après hydratation
    setCollapsed(readCollapsed());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fermeture des panneaux après navigation
    setMore(false);
    setPalette(false);
  }, [pathname]);

  useEffect(() => {
    const dialog = moreRef.current;
    if (!dialog) return;
    if (more && !dialog.open) dialog.showModal();
    if (!more && dialog.open) dialog.close();
  }, [more]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleGroup = useCallback((id: string) => {
    setCollapsed((current) => {
      const next = current.includes(id) ? current.filter((g) => g !== id) : [...current, id];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* préférence non enregistrée : sans conséquence */
      }
      return next;
    });
  }, []);

  const badge = (href: string) => {
    const n = badges?.[href] ?? 0;
    return n > 0 ? (
      <span className="ml-auto min-w-6 rounded-full bg-rose px-1.5 text-center text-[0.8rem] font-bold leading-6 text-cacao tabular-nums" aria-label={`${n} à traiter`}>
        {n}
      </span>
    ) : null;
  };

  const groups = (variant: "side" | "sheet") => (
    <div className="flex flex-col gap-3">
      {NAV_GROUPS.map((group) => {
        const closed = variant === "side" && collapsed.includes(group.id) && !group.items.some((i) => isActive(pathname, i.href));
        return (
          <div key={group.id}>
            <button
              type="button"
              aria-expanded={!closed}
              aria-controls={`groupe-${variant}-${group.id}`}
              onClick={() => variant === "side" && toggleGroup(group.id)}
              className={cn(
                "flex min-h-9 w-full items-center justify-between rounded-[6px] px-3 text-left text-[0.8rem] font-bold uppercase tracking-[0.12em]",
                variant === "side" ? "text-caramel hover:bg-creme/5" : "pointer-events-none text-caramel-encre",
              )}
            >
              {group.label}
              {variant === "side" && (
                <span aria-hidden className={cn("transition-transform duration-[var(--ohm-duree-courte)]", closed && "-rotate-90")}>
                  ⌄
                </span>
              )}
            </button>
            <ul id={`groupe-${variant}-${group.id}`} hidden={closed} className="mt-1 flex flex-col gap-0.5">
              {group.items.map((item) => {
                const current = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-[8px] px-3 font-bold",
                        variant === "side"
                          ? "text-creme/85 hover:bg-creme/10 aria-[current=page]:bg-creme aria-[current=page]:text-cacao"
                          : "text-chocolat hover:bg-chocolat/5 aria-[current=page]:bg-rose/60",
                      )}
                    >
                      <AtelierIcon name={item.icon} />
                      <span>{item.label}</span>
                      {badge(item.href)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-dvh bg-creme lg:grid lg:grid-cols-[16rem_1fr]">
      <a href="#admin-contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-[8px] focus:bg-chocolat focus:px-4 focus:py-3 focus:text-creme">
        Aller au contenu
      </a>

      {/* Téléphone et tablette : en-tête compact. */}
      <header className="ohm-cacao sticky top-0 z-40 flex items-center justify-between gap-3 px-4 py-2 print:hidden lg:hidden">
        <p className="font-display text-[1.25rem]">
          OHMEGATO <span className="atelier-annotation text-[1.05rem] text-rose">l&apos;atelier</span>
        </p>
        <button type="button" onClick={() => setPalette(true)} className="flex min-h-11 items-center gap-2 rounded-[8px] border-2 border-creme/40 px-3 font-bold">
          <AtelierIcon name="recherche" />
          <span>Rechercher</span>
        </button>
      </header>

      {/* Ordinateur : navigation latérale groupée et repliable. */}
      <nav aria-label="Administration" className="ohm-cacao hidden px-3 py-5 print:hidden lg:sticky lg:top-0 lg:block lg:h-dvh lg:overflow-y-auto">
        <p className="px-3 font-display text-[1.6rem] leading-none">OHMEGATO</p>
        <p className="atelier-annotation mb-1 px-3 text-[1.2rem] text-rose">l&apos;atelier d&apos;Alima</p>
        <p className="mb-4 px-3 text-[0.9rem] text-creme/60">Connectée : {name}</p>
        <button
          type="button"
          onClick={() => setPalette(true)}
          className="mb-5 flex min-h-11 w-full items-center gap-2 rounded-[8px] border-2 border-creme/25 px-3 text-left font-bold text-creme/85 hover:border-creme/50"
        >
          <AtelierIcon name="recherche" />
          <span>Rechercher</span>
          <kbd className="ml-auto rounded border border-creme/30 px-1.5 text-[0.75rem] text-creme/70">Ctrl K</kbd>
        </button>
        {groups("side")}
        <div className="mt-6 border-t border-creme/20 pt-4">
          <Link href="/" className="flex min-h-11 items-center px-3 font-bold text-creme/80 underline decoration-caramel decoration-2 underline-offset-4">
            Voir le site client
          </Link>
        </div>
      </nav>

      <main id="admin-contenu" className="min-w-0 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12">
        {children}
      </main>

      {/* Téléphone : barre du bas, atteignable au pouce. */}
      <nav aria-label="Accès rapides" className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-chocolat/15 bg-blanc-casse pb-[env(safe-area-inset-bottom)] print:hidden lg:hidden">
        <ul className="grid grid-cols-5">
          {MOBILE_TABS.map((tab) => (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={isActive(pathname, tab.href) ? "page" : undefined}
                className="relative flex min-h-16 flex-col items-center justify-center gap-0.5 text-[0.78rem] font-bold text-encre-douce aria-[current=page]:text-chocolat"
              >
                <AtelierIcon name={tab.icon} className="size-6" />
                {tab.label}
                {(badges?.[tab.href] ?? 0) > 0 && <span aria-hidden className="absolute right-[calc(50%-1.1rem)] top-2 size-2.5 rounded-full bg-rose-encre" />}
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={more}
              onClick={() => setMore(true)}
              className="flex min-h-16 w-full flex-col items-center justify-center gap-0.5 text-[0.78rem] font-bold text-encre-douce"
            >
              <AtelierIcon name="plus" className="size-6" />
              Plus
            </button>
          </li>
        </ul>
      </nav>

      <dialog
        ref={moreRef}
        aria-label="Toutes les rubriques"
        onClose={() => setMore(false)}
        className="m-0 h-dvh max-h-dvh w-full max-w-none bg-creme p-0 backdrop:bg-cacao/50 lg:hidden"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b-2 border-dashed border-chocolat/20 px-4 py-3">
            <p className="font-display text-[1.4rem]">Toutes les rubriques</p>
            <button type="button" onClick={() => setMore(false)} className="min-h-11 rounded-[8px] border-2 border-chocolat px-4 font-bold">
              Fermer
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
            {groups("sheet")}
            <Link href="/" className="mt-6 flex min-h-11 items-center px-3 font-bold underline decoration-caramel decoration-2 underline-offset-4">
              Voir le site client
            </Link>
          </div>
        </div>
      </dialog>

      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}
