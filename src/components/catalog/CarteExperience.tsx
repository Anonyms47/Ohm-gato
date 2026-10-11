"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
 * Téléphone : une affiche verticale par produit et des raccourcis fixés sous l'en-tête.
 */
export function CarteExperience({ products }: { products: CatalogProduct[] }) {
  const [selectedSlug, setSelectedSlug] = useState(products[0]?.slug ?? null);
  const selected = products.find((p) => p.slug === selectedSlug) ?? products[0];
  // Téléphone : le raccourci du produit visible est mis en évidence pendant le défilement.
  const [visibleSlug, setVisibleSlug] = useState(products[0]?.slug ?? null);
  const chips = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const posters = products.map((p) => document.getElementById(`affiche-${p.slug}`)).filter((el): el is HTMLElement => el !== null);
    if (posters.length === 0 || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting);
        if (hit) setVisibleSlug(hit.target.id.replace("affiche-", ""));
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    posters.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [products]);
  useEffect(() => {
    const chip = chips.current?.querySelector<HTMLElement>(`[data-slug="${visibleSlug}"]`);
    const bar = chips.current;
    if (!chip || !bar) return;
    // Défilement de la barre seule (jamais de la page).
    bar.scrollTo({ left: chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2, behavior: "smooth" });
  }, [visibleSlug]);

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
        {/* Raccourcis toujours visibles sous l'en-tête : rien ne recouvre le texte des produits. */}
        <nav aria-label="Aller à un produit" className="sticky top-16 z-30 border-y-2 border-chocolat/15 bg-creme/95 backdrop-blur-[2px]">
          <ul ref={chips} className="relative flex gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none]">
            {products.map((product) => (
              <li key={product.id} className="shrink-0">
                <a
                  href={`#affiche-${product.slug}`}
                  data-slug={product.slug}
                  aria-current={visibleSlug === product.slug ? "true" : undefined}
                  className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full border-2 border-chocolat/35 bg-blanc-casse px-4 font-bold aria-[current=true]:border-chocolat aria-[current=true]:bg-chocolat aria-[current=true]:text-creme"
                >
                  {product.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <ol className="flex flex-col">
          {products.map((product, index) => (
            <li
              key={product.id}
              id={`affiche-${product.slug}`}
              className={cn("scroll-mt-32 px-4 py-10", index % 2 === 0 ? "ohm-grille" : "bg-blanc-casse")}
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

      </div>
    </>
  );
}
