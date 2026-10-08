import Image from "next/image";
import Link from "next/link";
import { brand } from "@/config/brand";
import { cn } from "@/lib/cn";

/**
 * Logo officiel (image ou vecteur fourni par la marque, jamais retapé).
 * En attendant le fichier, le nom apparaît en texte simple.
 */
export function Logo({ className, tone = "chocolat" }: { className?: string; tone?: "chocolat" | "creme" }) {
  return (
    <Link
      href="/"
      aria-label={`${brand.name} — accueil`}
      className={cn("inline-flex min-h-11 items-center", className)}
    >
      {brand.logo ? (
        <Image src={brand.logo.src} width={brand.logo.width} height={brand.logo.height} alt="" priority className="h-10 w-auto" />
      ) : (
        <span
          className={cn(
            "font-text text-lg font-bold tracking-[0.18em]",
            tone === "creme" ? "text-creme" : "text-chocolat",
          )}
        >
          {brand.name}
        </span>
      )}
    </Link>
  );
}
