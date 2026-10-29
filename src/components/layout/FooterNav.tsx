"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { cn } from "@/lib/cn";

export interface FooterLink {
  href: string;
  label: string;
  external?: boolean;
}

export interface FooterGroup {
  title: string;
  links: FooterLink[];
}

const linkClass = "inline-flex min-h-11 items-center underline decoration-caramel decoration-2 underline-offset-4 hover:decoration-[3px]";
const chipClass =
  "inline-flex min-h-11 items-center rounded-full border border-creme/35 px-4 font-bold hover:border-creme hover:bg-creme/10 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-rose";

function FooterAnchor({ link, className }: { link: FooterLink; className: string }) {
  return link.external ? (
    <a href={link.href} className={className} target="_blank" rel="noopener noreferrer">
      {link.label}
      <span className="sr-only"> (nouvel onglet)</span>
    </a>
  ) : (
    <Link href={link.href} className={className}>
      {link.label}
    </Link>
  );
}

/** Groupe de liens : accordéon replié sur téléphone, liste toujours visible à partir de la tablette. */
function Group({ group, mobileOnly = false }: { group: FooterGroup; mobileOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  return (
    <div className={cn("border-b border-creme/20", mobileOnly ? "sm:hidden" : "sm:border-0")}>
      <h2 className="font-bold">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((o) => !o)}
          className={cn("flex min-h-11 w-full items-center justify-between gap-3 text-left", !mobileOnly && "sm:hidden")}
        >
          {group.title}
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className={cn("size-5 transition-transform duration-[var(--ohm-duree-courte)] ease-[var(--ohm-courbe)]", open && "rotate-180")}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {!mobileOnly && <span className="hidden sm:block">{group.title}</span>}
      </h2>
      <ul id={listId} className={cn("pb-2", !mobileOnly && "sm:mt-2 sm:block sm:pb-0", open ? "block" : "hidden")}>
        {group.links.map((link) => (
          <li key={link.href}>
            <FooterAnchor link={link} className={linkClass} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Pied de page.
 * Téléphone : accès rapide en pastilles (carte, fournées, sur-mesure, suivi, histoire, réseaux, WhatsApp), puis un seul
 * accordéon replié pour les informations (livraison, allergènes, conditions…). Tablette et ordinateur : trois colonnes.
 */
export function FooterNav({ groups, quick, more }: { groups: FooterGroup[]; quick: FooterLink[]; more: FooterGroup }) {
  return (
    <nav aria-label="Pied de page" className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-2 sm:hidden" data-testid="acces-rapide-pied">
        {quick.map((link) => (
          <li key={link.href}>
            <FooterAnchor link={link} className={chipClass} />
          </li>
        ))}
      </ul>
      <Group group={more} mobileOnly />
      <div className="hidden gap-0 sm:grid sm:grid-cols-3 sm:gap-8">
        {groups.map((group) => (
          <Group key={group.title} group={group} />
        ))}
      </div>
    </nav>
  );
}
