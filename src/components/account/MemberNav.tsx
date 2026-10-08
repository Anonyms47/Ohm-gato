"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const MEMBER_NAV = [
  { href: "/compte", label: "Accueil" },
  { href: "/compte/commandes", label: "Commandes" },
  { href: "/compte/sur-mesure", label: "Sur-mesure" },
  { href: "/compte/profil", label: "Profil" },
] as const;

export function isMemberActive(pathname: string, href: string) {
  return href === "/compte" ? pathname === "/compte" : pathname.startsWith(href);
}

/** Onglets du carnet (tablette et ordinateur ; le téléphone utilise la barre du bas). */
export function MemberTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Mon carnet" className="hidden md:block">
      <ul className="flex flex-wrap gap-2">
        {MEMBER_NAV.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isMemberActive(pathname, item.href) ? "page" : undefined}
              className="inline-flex min-h-11 items-center rounded-full border-2 border-chocolat/25 px-4 font-bold aria-[current=page]:border-chocolat aria-[current=page]:bg-chocolat aria-[current=page]:text-creme"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
