import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Point d'entrée unique de la typographie de marque.
 * Le niveau sémantique (as) est indépendant de la taille visuelle (size) :
 * la hiérarchie des titres reste correcte quelle que soit la composition.
 * Quand OhmegatoDisplay sera livrée, seuls les tokens changeront.
 */
type Size = "affiche" | "titre" | "section" | "produit" | "carte";
type Tone = "chocolat" | "caramel" | "orange" | "rose" | "creme";

const sizes: Record<Size, string> = {
  affiche: "text-[clamp(2.75rem,11vw,7.5rem)] leading-[0.9] tracking-[-0.02em]",
  titre: "text-[clamp(2.25rem,7vw,4.5rem)] leading-[0.95] tracking-[-0.015em]",
  section: "text-[clamp(1.75rem,4.5vw,3rem)] leading-[1]",
  produit: "text-[clamp(1.6rem,4vw,2.5rem)] leading-[1.02]",
  carte: "text-[1.35rem] leading-[1.1]",
};

const tones: Record<Tone, string> = {
  chocolat: "text-chocolat",
  caramel: "text-caramel-encre",
  orange: "text-orange-encre",
  rose: "text-rose-encre",
  creme: "text-creme",
};

export function BrandHeading({
  as: Tag = "h2",
  size = "section",
  tone = "chocolat",
  className,
  children,
  id,
}: {
  as?: ElementType;
  size?: Size;
  tone?: Tone;
  className?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <Tag id={id} className={cn("font-display font-normal text-balance", sizes[size], tones[tone], className)}>
      {children}
    </Tag>
  );
}

/** Annotation manuscrite (flèches, petites notes sur les affiches). */
export function Annotation({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-script text-[1.35rem] leading-tight text-caramel-encre", className)}>{children}</span>;
}
