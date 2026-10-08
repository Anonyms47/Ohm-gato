"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { useCart } from "@/components/cart/CartProvider";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatFcfa } from "@/lib/money";

/** Pages publiées. Les autres rubriques s'ajoutent ici quand elles existent. */
const NAV = [
  { href: "/", label: "La fournée", short: "Fournée" },
  { href: "/carte", label: "Toute la carte", short: "Carte" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function BoxIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={cn("size-6", className)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M3 9h18l-1.5 11h-15z" />
      <path d="M8 9V7a4 4 0 0 1 8 0v2" strokeLinecap="round" />
    </svg>
  );
}

/** Pastille du nombre d'articles, avec un léger rebond à chaque ajout. */
function CountBadge({ count, bumpKey }: { count: number; bumpKey: number | undefined }) {
  if (count === 0) return null;
  return (
    <span
      key={bumpKey}
      className="absolute -right-1.5 -top-1.5 grid min-w-6 place-items-center rounded-full bg-rose px-1.5 text-[0.8rem] font-bold leading-6 text-cacao animate-[ohm-ajout_360ms_var(--ohm-courbe)]"
    >
      {count}
    </span>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const { resolved, setDrawerOpen, lastAdded, hydrated } = useCart();
  const count = hydrated ? resolved.itemCount : 0;
  return (
    <header className="sticky top-0 z-40 border-b-2 border-chocolat/15 bg-creme/95 backdrop-blur-[2px]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
        <Logo />
        <nav aria-label="Navigation principale" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className="inline-flex min-h-11 items-center rounded-full px-4 font-bold text-chocolat decoration-caramel decoration-[3px] underline-offset-[6px] hover:underline aria-[current=page]:underline"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <Button
          variant="secondary"
          onClick={() => setDrawerOpen(true)}
          className="min-h-11 gap-2 px-4"
          aria-label={`Ma boîte (panier), ${count} article${count > 1 ? "s" : ""}`}
        >
          <span className="relative">
            <BoxIcon />
            <CountBadge count={count} bumpKey={lastAdded?.at} />
          </span>
          <span className="hidden sm:inline">Ma boîte</span>
        </Button>
      </div>
    </header>
  );
}

/** Barre mobile : Fournée, Carte, Ma boîte — avec la bande compacte du total. */
export function MobileNav() {
  const pathname = usePathname();
  const { resolved, setDrawerOpen, hydrated, lastAdded } = useCart();
  const count = hydrated ? resolved.itemCount : 0;
  const hideBand = pathname.startsWith("/commande") || pathname.startsWith("/ma-boite");
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
      {count > 0 && !hideBand && (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="mx-3 mb-2 flex min-h-12 w-[calc(100%-1.5rem)] items-center justify-between rounded-[12px] bg-chocolat px-4 text-creme shadow-[0_4px_0_var(--ohm-cacao)]"
        >
          <span className="font-bold">
            Ma boîte · {count} article{count > 1 ? "s" : ""}
          </span>
          <span className="font-bold tabular-nums">{formatFcfa(resolved.subtotal)}</span>
        </button>
      )}
      <nav aria-label="Navigation mobile" className="border-t-2 border-chocolat/15 bg-creme pb-[env(safe-area-inset-bottom)]">
        <ul className="grid grid-cols-3">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className="flex min-h-14 flex-col items-center justify-center font-bold text-encre-douce aria-[current=page]:text-chocolat aria-[current=page]:underline aria-[current=page]:decoration-caramel aria-[current=page]:decoration-[3px] aria-[current=page]:underline-offset-[6px]"
              >
                {item.short}
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex min-h-14 w-full flex-col items-center justify-center font-bold text-encre-douce"
              aria-label={`Ma boîte (panier), ${count} article${count > 1 ? "s" : ""}`}
            >
              <span className="relative">
                Ma boîte
                <CountBadge count={count} bumpKey={lastAdded?.at} />
              </span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}

/** Annonce les ajouts à Ma boîte aux lecteurs d'écran. */
export function CartAnnouncer() {
  const { lastAdded } = useCart();
  const [message, setMessage] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- annonce déclenchée par un événement externe
    if (lastAdded) setMessage(`Ajouté à Ma boîte : ${lastAdded.label}.`);
  }, [lastAdded]);
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {message}
    </p>
  );
}

/** « Une boîte vous attendait. » — reprise d'une boîte laissée lors d'une visite précédente. */
export function ResumeBanner() {
  const { resumePending, resolveResume, resolved } = useCart();
  if (!resumePending || resolved.lines.length === 0) return null;
  return (
    <aside aria-label="Boîte en attente" className="border-b-2 border-chocolat/15 bg-blanc-casse">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          <span className="font-display text-[1.25rem]">Une boîte vous attendait.</span>{" "}
          <span className="text-encre-douce">
            {resolved.itemCount} article{resolved.itemCount > 1 ? "s" : ""}
            {resolved.hasIssues ? " — certains ne sont plus disponibles, nous vous les signalons." : ". Prix et disponibilités sont à jour."}
          </span>
        </p>
        <div className="flex gap-2">
          <Button onClick={() => resolveResume(true)} className="min-h-11">
            Reprendre ma boîte
          </Button>
          <Button variant="text" onClick={() => resolveResume(false)}>
            Repartir de zéro
          </Button>
        </div>
      </div>
    </aside>
  );
}
