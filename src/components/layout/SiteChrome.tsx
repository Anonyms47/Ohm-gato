"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Drawer } from "vaul";
import { isMemberActive, MEMBER_NAV } from "@/components/account/MemberNav";
import { Logo } from "@/components/brand/Logo";
import { useCart } from "@/components/cart/CartProvider";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatFcfa } from "@/lib/money";

/** Pages publiées. */
const NAV = [
  { href: "/", label: "La fournée", short: "Fournée" },
  { href: "/carte", label: "Toute la carte", short: "Carte" },
  { href: "/fournees", label: "Nos fournées", short: "Fournées" },
  { href: "/sur-mesure", label: "Sur-mesure", short: "Sur-mesure" },
  { href: "/notre-histoire", label: "Notre histoire", short: "Histoire" },
] as const;

/** Barre du bas sur téléphone : les deux rubriques les plus utilisées, Ma boîte et le menu. */
const MOBILE_NAV = NAV.slice(0, 2);

export interface AccountSummary {
  name: string;
}

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
function CountBadge({ count, bumpKey, inline = false }: { count: number; bumpKey: number | undefined; inline?: boolean }) {
  if (count === 0) return null;
  return (
    <span
      key={bumpKey}
      className={cn(
        "grid place-items-center rounded-full bg-rose font-bold text-cacao animate-[ohm-ajout_360ms_var(--ohm-courbe)]",
        // Dans la barre mobile, la pastille suit le mot sans jamais le recouvrir.
        inline ? "min-w-5 px-1 text-[0.75rem] leading-5" : "absolute -right-1.5 -top-1.5 min-w-6 px-1.5 text-[0.8rem] leading-6",
      )}
    >
      {count}
    </span>
  );
}

export function SiteHeader({ account }: { account: AccountSummary | null }) {
  const pathname = usePathname();
  const { resolved, setDrawerOpen, lastAdded, hydrated } = useCart();
  const count = hydrated ? resolved.itemCount : 0;
  return (
    <header className="sticky top-0 z-40 print:hidden border-b-2 border-chocolat/15 bg-creme/95 backdrop-blur-[2px]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
        <Logo />
        <nav aria-label="Navigation principale" className="hidden lg:block">
          <ul className="flex items-center gap-0.5">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className="inline-flex min-h-11 items-center rounded-full px-3 font-bold text-chocolat decoration-caramel decoration-[3px] underline-offset-[6px] hover:underline aria-[current=page]:underline xl:px-4"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
        <Link
          href={account ? "/compte" : "/connexion"}
          aria-current={pathname.startsWith("/compte") ? "page" : undefined}
          className="hidden min-h-11 items-center rounded-full px-3 font-bold underline decoration-caramel decoration-2 underline-offset-4 sm:inline-flex"
        >
          {account ? "Mon carnet" : "Se connecter"}
        </Link>
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
      </div>
    </header>
  );
}

const mobileLink =
  "flex min-h-14 flex-col items-center justify-center px-1 text-center font-bold leading-tight text-encre-douce aria-[current=page]:text-chocolat aria-[current=page]:underline aria-[current=page]:decoration-caramel aria-[current=page]:decoration-[3px] aria-[current=page]:underline-offset-[6px]";

/** Menu complet sur téléphone, en feuille depuis le bas. */
function MobileMenu({ account }: { account: AccountSummary | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fermeture après navigation
    setOpen(false);
  }, [pathname]);
  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger className={cn(mobileLink, "w-full")} aria-label="Menu : toutes les rubriques">
        Menu
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-cacao/45" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-[18px] border-t-2 border-chocolat bg-creme pb-[env(safe-area-inset-bottom)] outline-none">
          <div aria-hidden className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-chocolat/30" />
          <Drawer.Title className="px-5 pt-3 font-display text-[1.5rem]">OHMEGATO</Drawer.Title>
          <Drawer.Description className="sr-only">Toutes les rubriques du site</Drawer.Description>
          <ul className="overflow-y-auto px-3 py-3">
            {[...NAV, { href: account ? "/compte" : "/connexion", label: account ? "Mon carnet" : "Se connecter", short: "" }].map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className="flex min-h-12 items-center rounded-[10px] px-3 text-[1.15rem] font-bold aria-[current=page]:bg-blanc-casse aria-[current=page]:underline aria-[current=page]:decoration-caramel aria-[current=page]:decoration-[3px] aria-[current=page]:underline-offset-[6px]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/**
 * Barre mobile : Fournée, Carte, Ma boîte, Menu — avec la bande compacte du total.
 * Dans le carnet : Accueil, Commandes, Ma boîte, Profil.
 */
export function MobileNav({ account }: { account: AccountSummary | null }) {
  const pathname = usePathname();
  const { resolved, setDrawerOpen, hydrated, lastAdded } = useCart();
  const count = hydrated ? resolved.itemCount : 0;
  const inAccount = pathname.startsWith("/compte");
  const hideBand = pathname.startsWith("/commande") || pathname.startsWith("/ma-boite") || inAccount;
  const boxButton = (
    <button
      type="button"
      onClick={() => setDrawerOpen(true)}
      className={cn(mobileLink, "w-full")}
      aria-label={`Ma boîte (panier), ${count} article${count > 1 ? "s" : ""}`}
    >
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        Ma boîte
        <CountBadge count={count} bumpKey={lastAdded?.at} inline />
      </span>
    </button>
  );
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 print:hidden md:hidden">
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
      <nav aria-label={inAccount ? "Navigation du carnet" : "Navigation mobile"} className="border-t-2 border-chocolat/15 bg-creme pb-[env(safe-area-inset-bottom)]">
        <ul className="grid grid-cols-4">
          {inAccount ? (
            <>
              {MEMBER_NAV.filter((item) => item.href !== "/compte/sur-mesure").slice(0, 2).map((item) => (
                <li key={item.href}>
                  <Link href={item.href} aria-current={isMemberActive(pathname, item.href) ? "page" : undefined} className={mobileLink}>
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>{boxButton}</li>
              <li>
                <Link href="/compte/profil" aria-current={isMemberActive(pathname, "/compte/profil") ? "page" : undefined} className={mobileLink}>
                  Profil
                </Link>
              </li>
            </>
          ) : (
            <>
              {MOBILE_NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} aria-current={isActive(pathname, item.href) ? "page" : undefined} className={mobileLink}>
                    {item.short}
                  </Link>
                </li>
              ))}
              <li>{boxButton}</li>
              <li>
                <MobileMenu account={account} />
              </li>
            </>
          )}
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
    <aside aria-label="Boîte en attente" className="print:hidden border-b-2 border-chocolat/15 bg-blanc-casse">
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
