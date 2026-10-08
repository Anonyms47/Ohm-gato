"use client";

import Link from "next/link";
import { useState } from "react";
import { Drawer } from "vaul";
import { BrandHeading } from "@/components/brand/BrandHeading";
import { AddToBox } from "@/components/catalog/AddToBox";
import { AvailabilityBadge } from "@/components/catalog/AvailabilityBadge";
import { ProductVisual } from "@/components/catalog/ProductVisual";
import type { CatalogProduct } from "@/lib/catalog-types";
import { cn } from "@/lib/cn";
import { formatFcfa } from "@/lib/money";

function priceRange(product: CatalogProduct) {
  const prices = product.variants.map((v) => v.priceFcfa);
  if (prices.length === 0) return "";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatFcfa(min) : `${formatFcfa(min)} – ${formatFcfa(max)}`;
}

/**
 * La Carte. Tablette et ordinateur : menu typographique à gauche, scène fixe à droite.
 * Téléphone : une affiche verticale par produit et un index ouvrable depuis le bas.
 */
export function CarteExperience({ products }: { products: CatalogProduct[] }) {
  const [selectedSlug, setSelectedSlug] = useState(products[0]?.slug ?? null);
  const selected = products.find((p) => p.slug === selectedSlug) ?? products[0];

  if (!selected) {
    return <p className="mx-auto max-w-7xl px-4 py-12 text-[1.1rem] sm:px-6">Aucun produit dans cette vue pour le moment.</p>;
  }

  return (
    <>
      {/* Tablette / ordinateur */}
      <div className="mx-auto hidden max-w-7xl gap-8 px-6 pb-20 md:grid md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
        <nav aria-label="Produits de la carte">
          <ul className="flex flex-col">
            {products.map((product) => {
              const active = product.slug === selected.slug;
              return (
                <li key={product.id} className="border-b-2 border-dashed border-chocolat/20">
                  <button
                    type="button"
                    onClick={() => setSelectedSlug(product.slug)}
                    aria-pressed={active}
                    aria-controls="scene-produit"
                    className={cn(
                      "group flex w-full flex-col items-start gap-1 py-4 text-left transition-colors",
                      active ? "text-chocolat" : "text-chocolat/70 hover:text-chocolat",
                    )}
                  >
                    <span className="flex w-full items-baseline justify-between gap-3">
                      <span
                        className={cn(
                          "font-display text-[clamp(1.5rem,2.6vw,2.4rem)] leading-[1.02]",
                          active && "underline decoration-caramel decoration-[3px] underline-offset-[7px]",
                        )}
                      >
                        {product.name}
                      </span>
                      {product.availability !== "available" && <AvailabilityBadge state={product.availability} className="shrink-0" />}
                    </span>
                    <span className="tabular-nums text-encre-douce">{priceRange(product)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <section id="scene-produit" aria-live="polite" aria-labelledby={`scene-${selected.slug}`} className="md:sticky md:top-20 md:self-start">
          <div key={selected.slug} className="flex flex-col gap-5 animate-[ohm-entree_var(--ohm-duree-moyenne)_var(--ohm-courbe)_both]">
            <ProductVisual product={selected} sizes="(min-width: 1024px) 30vw, 45vw" className="mx-auto w-full max-w-[22rem]" />
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <BrandHeading as="h2" size="produit" id={`scene-${selected.slug}`}>
                {selected.name}
              </BrandHeading>
              <Link
                href={`/carte/${selected.slug}`}
                className="inline-flex min-h-11 items-center font-bold underline decoration-caramel decoration-2 underline-offset-4"
              >
                Toute la fiche<span className="sr-only"> {selected.name}</span>
              </Link>
            </div>
            <p className="max-w-prose text-[1.1rem]">{selected.description}</p>
            <AddToBox key={selected.id} product={selected} />
          </div>
        </section>
      </div>

      {/* Téléphone */}
      <div className="md:hidden">
        <ol className="flex flex-col">
          {products.map((product, index) => (
            <li
              key={product.id}
              id={`affiche-${product.slug}`}
              className={cn("scroll-mt-20 px-4 py-10", index % 2 === 0 ? "ohm-grille" : "bg-blanc-casse")}
            >
              <article aria-labelledby={`titre-${product.slug}`} className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <BrandHeading as="h2" size="produit" id={`titre-${product.slug}`}>
                    <Link href={`/carte/${product.slug}`}>{product.name}</Link>
                  </BrandHeading>
                  {product.availability !== "available" && <AvailabilityBadge state={product.availability} className="mt-1 shrink-0" />}
                </div>
                <ProductVisual product={product} sizes="80vw" className="mx-auto w-full max-w-[17rem]" />
                <p>{product.description}</p>
                <AddToBox product={product} compact />
              </article>
            </li>
          ))}
        </ol>

        <Drawer.Root>
          <Drawer.Trigger className="fixed bottom-[8.5rem] right-3 z-30 min-h-12 rounded-full border-2 border-chocolat bg-creme px-5 font-bold shadow-[0_3px_0_var(--ohm-chocolat)]">
            Index de la carte
          </Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 z-50 bg-cacao/45" />
            <Drawer.Content
              aria-describedby={undefined}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80dvh] flex-col rounded-t-[18px] border-t-2 border-chocolat bg-blanc-casse pb-[env(safe-area-inset-bottom)] outline-none"
            >
              <div aria-hidden className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-chocolat/25" />
              <div className="flex items-center justify-between px-4 pb-2 pt-3">
                <Drawer.Title className="font-display text-[1.4rem]">Aller à…</Drawer.Title>
                <Drawer.Close className="min-h-11 px-3 font-bold underline decoration-caramel decoration-2 underline-offset-4">Fermer</Drawer.Close>
              </div>
              <ul className="overflow-y-auto px-2 pb-4">
                {products.map((product) => (
                  <li key={product.id}>
                    <Drawer.Close asChild>
                      <a
                        href={`#affiche-${product.slug}`}
                        className="flex min-h-12 items-center justify-between gap-3 rounded-[8px] px-3 text-[1.1rem] font-bold hover:bg-grille/60"
                      >
                        {product.name}
                        <span className="text-[0.95rem] font-normal text-encre-douce tabular-nums">{priceRange(product)}</span>
                      </a>
                    </Drawer.Close>
                  </li>
                ))}
              </ul>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      </div>
    </>
  );
}
