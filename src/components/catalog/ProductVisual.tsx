import Image from "next/image";
import type { Accent, CatalogProduct } from "@/lib/catalog-types";
import { cn } from "@/lib/cn";

const plate: Record<Accent, string> = {
  caramel: "bg-caramel",
  chocolate: "bg-chocolat",
  orange: "bg-orange",
  rose: "bg-rose",
};

const ink: Record<Accent, string> = {
  caramel: "text-cacao",
  chocolate: "text-creme",
  orange: "text-cacao",
  rose: "text-cacao",
};

/**
 * Visuel produit. Utilise exclusivement les vraies photos détourées fournies.
 * Sans photo, une composition typographique (cercle de l'affiche + nom) prend
 * la place : aucune image générée n'est présentée comme un vrai produit.
 */
export function ProductVisual({
  product,
  priority = false,
  sizes = "(min-width: 1024px) 40vw, 90vw",
  className,
}: {
  product: Pick<CatalogProduct, "name" | "images" | "accent" | "unitLabelPlural">;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  const image = product.images.find((i) => i.role === "cutout") ?? product.images[0];
  return (
    <div className={cn("relative isolate grid aspect-square place-items-center", className)}>
      <div aria-hidden className={cn("absolute inset-[6%] -z-10 rounded-full", plate[product.accent])} />
      {image ? (
        <Image
          src={image.url}
          alt={image.alt}
          width={image.width}
          height={image.height}
          sizes={sizes}
          priority={priority}
          className="absolute inset-[3%] h-[94%] w-[94%] object-contain drop-shadow-[0_18px_18px_rgb(36_20_13/0.28)]"
        />
      ) : (
        <span
          aria-hidden
          className={cn(
            "max-w-[70%] -rotate-6 text-center font-display text-[clamp(1.5rem,5vw,3.2rem)] leading-[0.95]",
            ink[product.accent],
          )}
        >
          {product.name}
        </span>
      )}
    </div>
  );
}
