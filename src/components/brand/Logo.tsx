import Image from "next/image";
import Link from "next/link";
import { brand } from "@/config/brand";
import { cn } from "@/lib/cn";

/**
 * Logotype officiel (SVG fourni par l'agence, jamais retapé), à placer sur fond clair.
 * Le lien ramène à l'accueil ; le nom accessible remplace l'image pour les lecteurs d'écran.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label={`${brand.name} — accueil`} className={cn("inline-flex min-h-11 items-center", className)}>
      <Image src={brand.logotype.src} width={brand.logotype.width} height={brand.logotype.height} alt="" priority unoptimized className="h-8 w-auto sm:h-9" />
    </Link>
  );
}

/** Symbole officiel (muffin / Ω et losange rose), décoratif : proportions d'origine conservées. */
export function BrandSymbol({ className }: { className?: string }) {
  return <Image src={brand.symbol.src} width={brand.symbol.width} height={brand.symbol.height} alt="" unoptimized className={cn("h-auto", className)} />;
}
