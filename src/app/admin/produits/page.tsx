import Link from "next/link";
import { NewProductForm } from "@/components/admin/ProductEditors";
import { REVIEW_FILTERS, reviewFilterLabels, reviewItems, toVerifyCount, type ReviewFilter } from "@/lib/admin/allergen-review";
import { listAllergens, listFlavors, listProducts } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { formatFcfa } from "@/lib/money";

export const metadata = { title: "Produits" };

const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Dakar" });

export default async function AdminProduits({ searchParams }: { searchParams: Promise<{ verification?: string }> }) {
  await requireAdmin();
  const [products, allergens, flavors, params] = await Promise.all([listProducts(), listAllergens(), listFlavors(), searchParams]);
  const items = reviewItems(products, allergens, flavors);
  const filter = (REVIEW_FILTERS as readonly string[]).includes(params.verification ?? "") ? (params.verification as ReviewFilter) : null;
  const shown = filter ? items.filter((i) => i.filter === filter) : [];
  const toVerify = toVerifyCount(products);
  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">Produits</h1>
      <ul className="grid gap-3 md:grid-cols-2">
        {products.map((p) => (
          <li key={p.id} className="rounded-[12px] border-2 border-chocolat/20 bg-blanc-casse p-4">
            <Link href={`/admin/produits/${p.id}`} className="font-display text-[1.35rem] underline decoration-caramel decoration-2 underline-offset-4">
              {p.name}
            </Link>
            <p className="text-encre-douce">
              {p.category} · {p.isActive ? "publié" : "non publié"} · {p.storageConfirmed ? "conservation confirmée" : "conservation à renseigner"}
            </p>
            <p className="text-[0.95rem]">{p.variants.map((v) => `${v.label} ${formatFcfa(v.priceFcfa)}`).join(" · ")}</p>
          </li>
        ))}
      </ul>

      <section aria-labelledby="verification" className="flex flex-col gap-4" data-testid="verification-allergenes">
        <h2 id="verification" className="font-display text-[1.5rem]">
          Vérification des allergènes
        </h2>
        <p data-testid="compteur-a-verifier">
          <strong>{toVerify}</strong> information{toVerify > 1 ? "s" : ""} « à vérifier » (emballages, traces) : jamais affichée{toVerify > 1 ? "s" : ""} aux clients.
        </p>
        <nav aria-label="Filtrer par état de vérification" className="flex flex-wrap gap-2">
          {REVIEW_FILTERS.map((f) => {
            const count = items.filter((i) => i.filter === f).length;
            return (
              <Link
                key={f}
                href={filter === f ? "/admin/produits" : `/admin/produits?verification=${f}#verification`}
                aria-current={filter === f ? "true" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full border-2 border-chocolat px-4 font-bold",
                  filter === f ? "bg-chocolat text-creme" : "bg-blanc-casse",
                )}
              >
                {reviewFilterLabels[f]} ({count})
              </Link>
            );
          })}
        </nav>
        {filter && (
          <ul className="flex flex-col gap-2" data-testid="liste-verification">
            {shown.length === 0 && <li className="text-encre-douce">Aucune information dans cette catégorie.</li>}
            {shown.map((i, index) => (
              <li key={`${i.productId}-${index}`} className="flex flex-wrap items-baseline justify-between gap-2 rounded-[10px] bg-blanc-casse p-3">
                <span className="min-w-0">
                  <Link href={`/admin/produits/${i.productId}`} className="font-bold underline underline-offset-4">
                    {i.productName}
                  </Link>{" "}
                  · {i.scope} · {i.label}
                  {i.status && ` : ${i.status}`}
                </span>
                {i.verifiedAt && <span className="text-[0.95rem] text-encre-douce">validé le {dateFormat.format(new Date(i.verifiedAt))}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="nouveau" className="max-w-xl">
        <h2 id="nouveau" className="mb-3 font-display text-[1.5rem]">
          Nouveau produit
        </h2>
        <NewProductForm />
      </section>
    </div>
  );
}
