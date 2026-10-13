import type { SVGProps } from "react";

/** Pictogrammes de l'atelier : trait épais arrondi, comme dessinés au feutre. Décoratifs (aria-hidden). */
type IconName =
  | "jour"
  | "liste"
  | "fournee"
  | "fiche"
  | "produit"
  | "stock"
  | "commande"
  | "paiement"
  | "livraison"
  | "surmesure"
  | "client"
  | "document"
  | "reglage"
  | "equipe"
  | "journal"
  | "plus"
  | "recherche"
  | "cloche"
  | "aide"
  | "chiffres";

const paths: Record<IconName, string> = {
  jour: "M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M8 12a4 4 0 1 0 8 0a4 4 0 1 0-8 0",
  liste: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2",
  fournee: "M4 10h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 10l2-5h12l2 5M9 14h6",
  fiche: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5",
  produit: "M6 12c0-4 2.5-7 6-7s6 3 6 7M5 12h14l-2 8H7zM9 9h.01M13 8h.01",
  stock: "M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8",
  commande: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3",
  paiement: "M3 7h18v10H3zM3 11h18M7 15h3",
  livraison: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-.01M17 19a2 2 0 1 0 0-.01",
  surmesure: "M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.6 7.1 18.2l.9-5.5-4-3.9 5.5-.8z",
  client: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6",
  document: "M6 3h9l3 3v15H6zM9 9h6M9 13h6M9 17h4",
  reglage: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.1-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2.1 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.1 1.2L10 21h4l.5-2.6a7 7 0 0 0 2.1-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z",
  equipe: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c.7-3 3-5 6-5s5.3 2 6 5M16 5a3 3 0 0 1 0 6M17 15c2 .4 3.5 2.2 4 5",
  journal: "M5 4h13v16H5zM5 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2M9 8h6M9 12h6M9 16h4",
  chiffres: "M4 20h16M7 16v-5M12 16V6M17 16v-8",
  plus: "M5 12h.01M12 12h.01M19 12h.01",
  recherche: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  cloche: "M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 21h4",
  aide: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01",
};

export function AtelierIcon({ name, className, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className ?? "size-5 shrink-0"} {...props}>
      <path d={paths[name]} />
    </svg>
  );
}

export type { IconName };
