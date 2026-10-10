"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { cn } from "@/lib/cn";

export interface FooterGroup {
  title: string;
  links: { href: string; label: string; external?: boolean }[];
}

const linkClass = "inline-flex min-h-11 items-center underline decoration-caramel decoration-2 underline-offset-4 hover:decoration-[3px]";

/** Groupe de liens : accordéon sur téléphone, liste toujours visible à partir de la tablette. */
function Group({ group }: { group: FooterGroup }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  return (
    <div className="border-b border-creme/20 sm:border-0">
      <h2 className="font-bold">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-12 w-full items-center justify-between gap-3 text-left sm:hidden"
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
        <span className="hidden sm:block">{group.title}</span>
      </h2>
      <ul id={listId} className={cn("pb-3 sm:mt-2 sm:block sm:pb-0", open ? "block" : "hidden")}>
        {group.links.map((link) => (
          <li key={link.href}>
            {link.external ? (
              <a href={link.href} className={linkClass}>
                {link.label}
              </a>
            ) : (
              <Link href={link.href} className={linkClass}>
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FooterNav({ groups }: { groups: FooterGroup[] }) {
  return (
    <nav aria-label="Pied de page" className="grid gap-0 sm:grid-cols-3 sm:gap-8">
      {groups.map((group) => (
        <Group key={group.title} group={group} />
      ))}
    </nav>
  );
}
