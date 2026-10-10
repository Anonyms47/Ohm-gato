"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/commandes", label: "Commandes" },
  { href: "/admin/livraisons", label: "Livraisons" },
  { href: "/admin/fournees", label: "Fournées" },
  { href: "/admin/stock", label: "Stock" },
  { href: "/admin/produits", label: "Produits" },
  { href: "/admin/sur-mesure", label: "Sur-mesure" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/documents", label: "Documents et règles" },
  { href: "/admin/reglages", label: "Réglages et rôles" },
  { href: "/admin/journal", label: "Journal d'audit" },
] as const;

function active(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

/** Administration d'Alima : interface séparée du site client (aucun panier, aucune navigation client). */
export function AdminShell({ name, children }: { name: string; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true"; // repère pour les tests de bout en bout
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fermeture du menu après navigation
    setOpen(false);
  }, [pathname]);

  const links = (
    <ul className="flex flex-col gap-1">
      {NAV.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            aria-current={active(pathname, item.href) ? "page" : undefined}
            className="flex min-h-11 items-center rounded-[8px] px-3 font-bold text-creme/85 hover:bg-creme/10 aria-[current=page]:bg-creme aria-[current=page]:text-cacao"
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="min-h-dvh bg-creme lg:grid lg:grid-cols-[15rem_1fr]">
      <a href="#admin-contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-[8px] focus:bg-chocolat focus:px-4 focus:py-3 focus:text-creme">
        Aller au contenu
      </a>
      <header className="ohm-cacao sticky top-0 z-40 flex items-center justify-between gap-3 px-4 py-2 print:hidden lg:hidden">
        <p className="font-display text-[1.3rem]">OHMEGATO · admin</p>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="admin-menu"
          onClick={() => setOpen((o) => !o)}
          className="min-h-11 rounded-[8px] border-2 border-creme/40 px-4 font-bold"
        >
          {open ? "Fermer" : "Menu"}
        </button>
      </header>
      <nav
        id="admin-menu"
        aria-label="Administration"
        className={cn("ohm-cacao px-3 py-4 print:hidden lg:sticky lg:top-0 lg:block lg:h-dvh lg:overflow-y-auto", open ? "block" : "hidden")}
      >
        <p className="hidden px-3 font-display text-[1.5rem] lg:block">OHMEGATO</p>
        <p className="mb-4 hidden px-3 text-creme/70 lg:block">Administration · {name}</p>
        {links}
        <div className="mt-6 border-t border-creme/20 pt-4">
          <Link href="/" className="flex min-h-11 items-center px-3 font-bold text-creme/80 underline decoration-caramel decoration-2 underline-offset-4">
            Voir le site client
          </Link>
        </div>
      </nav>
      <main id="admin-contenu" className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
