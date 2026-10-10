import Link from "next/link";
import { AllergenSummaryText } from "@/components/catalog/AllergenSummaryText";
import { LegalPage, legalMetadata } from "@/components/legal/LegalPage";
import { flavorsWithOwnInfo, summarizeAllergens } from "@/lib/allergens";
import { getCatalog } from "@/lib/catalog";
import { storageAdvice } from "@/lib/storage";

export const metadata = legalMetadata("allergenes-conservation");

/**
 * Le tableau est calculé à partir des mêmes données que les fiches produits (statuts
 * d'allergènes, informations de recette, conservation) : aucune divergence possible.
 */
export default async function Page() {
  const catalog = await getCatalog();
  return (
    <LegalPage
      slug="allergenes-conservation"
      after={
        <section aria-labelledby="par-produit" data-testid="allergenes-par-produit">
          <h2 id="par-produit" className="scroll-mt-28 font-display text-[clamp(1.45rem,3.4vw,1.8rem)]">
            Produit par produit
          </h2>
          <ul className="mt-4 flex flex-col gap-4">
            {catalog.products.map((product) => {
              const perFlavor = product.flavors.length > 0 && flavorsWithOwnInfo(product.allergenInfo).size > 0;
              return (
                <li key={product.id} className="rounded-[14px] border-2 border-chocolat/20 bg-blanc-casse p-4 print:break-inside-avoid">
                  <h3 className="text-[1.2rem] font-bold">
                    <Link href={`/carte/${product.slug}`} className="underline decoration-caramel decoration-2 underline-offset-4">
                      {product.name}
                    </Link>
                  </h3>
                  <div className="mt-2">
                    {perFlavor ? (
                      <dl className="flex flex-col gap-2">
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
                      <AllergenSummaryText
                        summary={summarizeAllergens(product.allergenInfo, catalog.allergenDefs, [], catalog.workshopTraces)}
                        empty="Informations en cours de vérification : contactez-nous avant de commander."
                      />
                    )}
                  </div>
                  {product.storage && (
                    <p className="mt-3">
                      <strong>Conservation :</strong> {storageAdvice(product.storage.rule, product.storage.note)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      }
    />
  );
}
