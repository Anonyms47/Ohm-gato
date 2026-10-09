"use client";

import { useCart } from "@/components/cart/CartProvider";
import { AllergenSummaryText } from "@/components/catalog/AllergenSummaryText";
import { AllergyNotice } from "@/components/catalog/AllergyNotice";
import { summarizeAllergens } from "@/lib/allergens";
import type { CatalogProduct } from "@/lib/catalog-types";

/**
 * Allergènes de la boîte, produit par produit. Si une boîte mélange plusieurs parfums d'un même
 * produit, l'information affichée est l'union de ces parfums. Toujours suivi de l'avertissement.
 */
export function BoxAllergens({ className }: { className?: string }) {
  const { resolved, catalog } = useCart();
  const byProduct = new Map<string, { product: CatalogProduct; flavorIds: Set<string> }>();
  for (const line of resolved.lines) {
    if (!line.product) continue;
    const entry = byProduct.get(line.product.id) ?? { product: line.product, flavorIds: new Set<string>() };
    if (line.flavor) entry.flavorIds.add(line.flavor.id);
    byProduct.set(line.product.id, entry);
  }
  return (
    <section aria-labelledby="allergenes-boite" className={className} data-testid="allergenes-boite">
      {byProduct.size > 0 && (
        <>
          <h2 id="allergenes-boite" className="font-display text-[1.4rem]">
            Allergènes de votre boîte
          </h2>
          <dl className="mt-2 flex flex-col gap-3">
            {[...byProduct.values()].map(({ product, flavorIds }) => (
              <div key={product.id}>
                <dt className="font-bold">
                  {product.name}
                  {flavorIds.size > 0 &&
                    ` (${product.flavors
                      .filter((f) => flavorIds.has(f.id))
                      .map((f) => f.name.toLocaleLowerCase("fr"))
                      .join(", ")})`}
                </dt>
                <dd>
                  <AllergenSummaryText
                    summary={summarizeAllergens(product.allergenInfo, catalog.allergenDefs, [...flavorIds], catalog.workshopTraces)}
                  />
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
      <AllergyNotice className={byProduct.size > 0 ? "mt-4" : undefined} />
    </section>
  );
}
