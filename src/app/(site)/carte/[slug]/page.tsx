import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandHeading } from "@/components/brand/BrandHeading";
import { FavoriteButton } from "@/components/account/FavoriteButton";
import { AddToBox } from "@/components/catalog/AddToBox";
import { getMyFavorites } from "@/lib/account/data";
import { getCurrentUser } from "@/lib/auth/session";
import { AllergenSummaryText } from "@/components/catalog/AllergenSummaryText";
import { AllergyNotice } from "@/components/catalog/AllergyNotice";
import { AvailabilityBadge } from "@/components/catalog/AvailabilityBadge";
import { ProductStaging } from "@/components/catalog/ProductStaging";
import { ProductVisual } from "@/components/catalog/ProductVisual";
import { brand } from "@/config/brand";
import { flavorsWithOwnInfo, summarizeAllergens } from "@/lib/allergens";
import { getCatalog } from "@/lib/catalog";
import type { CatalogProduct } from "@/lib/catalog-types";
import { formatFcfa } from "@/lib/money";
import { storageAdvice } from "@/lib/storage";

async function findProduct(slug: string) {
  const catalog = await getCatalog();
  const product = catalog.products.find((p) => p.slug === slug);
  return product ? { product, catalog } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const found = await findProduct(slug);
  if (!found) return {};
  const image = found.product.images[0];
  return {
    title: found.product.name,
    description: found.product.description,
    openGraph: image ? { images: [{ url: image.url, width: image.width, height: image.height, alt: image.alt }] } : undefined,
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await findProduct(slug);
  if (!found) notFound();
  const { product, catalog } = found;
  const user = await getCurrentUser();
  const favorites = user ? await getMyFavorites(user.id) : [];
  const perFlavor = product.flavors.length > 0 && flavorsWithOwnInfo(product.allergenInfo).size > 0;
  const pairings = product.pairingSlugs
    .map((s) => catalog.products.find((p) => p.slug === s))
    .filter((p): p is CatalogProduct => Boolean(p))
    .slice(0, 2);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    brand: { "@type": "Brand", name: brand.name },
    ...(product.images[0] ? { image: product.images.map((i) => i.url) } : {}),
    offers: product.variants.map((v) => ({
      "@type": "Offer",
      name: v.label,
      price: v.priceFcfa,
      priceCurrency: "XOF",
      availability:
        product.availability === "available" || product.availability === "low"
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    })),
  };

  return (
    <article aria-labelledby="produit" className="pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="ohm-grille">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-8 sm:px-6 md:grid-cols-2 md:py-14">
          <div className="order-2 flex flex-col gap-5 md:order-1">
            <nav aria-label="Fil d'Ariane">
              <Link href="/carte" className="inline-flex min-h-11 items-center font-bold underline decoration-caramel decoration-2 underline-offset-4">
                La carte
              </Link>
            </nav>
            <div className="flex flex-wrap items-center gap-3">
              <BrandHeading as="h1" size="titre" id="produit">
                {product.name}
              </BrandHeading>
              <AvailabilityBadge state={product.availability} />
            </div>
            <p className="max-w-prose text-[1.15rem]">{product.description}</p>
            <AddToBox product={product} />
            <FavoriteButton productId={product.id} productName={product.name} slug={product.slug} signedIn={user !== null} initial={favorites.includes(product.id)} />
          </div>
          <ProductVisual product={product} priority sizes="(min-width: 768px) 45vw, 90vw" className="order-1 mx-auto w-full max-w-[32rem] md:order-2" />
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 md:grid-cols-2">
        <section aria-labelledby="coupe">
          <BrandHeading id="coupe" size="section">
            Coupe gourmande
          </BrandHeading>
          <div className="mt-6">
            <ProductStaging product={product} />
          </div>
        </section>

        <div className="flex flex-col gap-10">
          <section aria-labelledby="formats">
            <h2 id="formats" className="font-display text-[1.6rem]">
              Formats
            </h2>
            <table className="mt-3 w-full border-collapse">
              <caption className="sr-only">Formats et prix de {product.name}</caption>
              <tbody>
                {product.variants.map((v) => (
                  <tr key={v.id} className="border-b-2 border-dashed border-chocolat/20">
                    <th scope="row" className="py-3 text-left font-bold">
                      {v.label}
                    </th>
                    <td className="py-3 text-right tabular-nums">{formatFcfa(v.priceFcfa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {product.tips && (
            <section aria-labelledby="conseils">
              <h2 id="conseils" className="font-display text-[1.6rem]">
                Conseil
              </h2>
              <p className="mt-2">{product.tips}</p>
            </section>
          )}

          {product.storage && (
            <section aria-labelledby="conservation">
              <h2 id="conservation" className="font-display text-[1.6rem]">
                Conservation
              </h2>
              <p className="mt-2">{storageAdvice(product.storage.rule, product.storage.note)}</p>
            </section>
          )}

          <section aria-labelledby="allergenes" data-testid="allergenes">
            <h2 id="allergenes" className="font-display text-[1.6rem]">
              Allergènes
            </h2>
            {perFlavor ? (
              <dl className="mt-2 flex flex-col gap-3">
                {product.flavors.map((f) => (
                  <div key={f.id}>
                    <dt className="font-bold">Parfum {f.name.toLocaleLowerCase("fr")}</dt>
                    <dd>
                      <AllergenSummaryText summary={summarizeAllergens(product.allergenInfo, catalog.allergenDefs, [f.id], catalog.workshopTraces)} />
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="mt-2">
                <AllergenSummaryText summary={summarizeAllergens(product.allergenInfo, catalog.allergenDefs, [], catalog.workshopTraces)} />
              </div>
            )}
            <AllergyNotice className="mt-4" />
          </section>
        </div>
      </div>

      {pairings.length > 0 && (
        <section aria-labelledby="avec" className="bg-blanc-casse">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
            <h2 id="avec" className="font-display text-[1.8rem]">
              Dans la même boîte
            </h2>
            <ul className="mt-6 grid grid-cols-2 gap-6 md:max-w-2xl">
              {pairings.map((p) => (
                <li key={p.id}>
                  <Link href={`/carte/${p.slug}`} className="flex flex-col gap-2">
                    <ProductVisual product={p} sizes="(min-width: 768px) 20vw, 45vw" />
                    <span className="font-display text-[1.25rem]">{p.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </article>
  );
}
