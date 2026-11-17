import Image from "next/image";
import { brand } from "@/config/brand";
import { cn } from "@/lib/cn";

/**
 * Écran de chargement OHMEGATO : le logotype officiel se dessine de gauche à droite, reste affiché, puis s'efface.
 * Animation en CSS sur le SVG fourni par l'agence (jamais retapé). Sans animation si la personne a demandé d'en réduire
 * (le logotype reste affiché). Annoncé aux lecteurs d'écran par un message, l'image elle-même est décorative.
 *
 * - « page » : occupe la zone de contenu (changement de page, première ouverture).
 * - « section » : plus petit, pour un bloc qui se charge dans une page (carte, boîte, bon de fournée).
 */
export function LoadingScreen({
  label = "Chargement…",
  size = "page",
  className,
}: {
  label?: string;
  size?: "page" | "section";
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "grid place-items-center px-4",
        size === "page" ? "min-h-[60dvh] py-16" : "min-h-[14rem] py-10",
        className,
      )}
    >
      <span className="sr-only">{label}</span>
      <span aria-hidden className={cn("ohm-chargement", size === "page" ? "w-[min(68vw,22rem)]" : "w-[min(56vw,14rem)]")}>
        <Image src={brand.logotype.src} width={brand.logotype.width} height={brand.logotype.height} alt="" priority unoptimized className="block h-auto w-full" />
      </span>
    </div>
  );
}
