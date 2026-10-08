import Link from "next/link";
import { NewProductForm } from "@/components/admin/ProductEditors";
import { listProducts } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/session";
import { formatFcfa } from "@/lib/money";

export const metadata = { title: "Produits" };

export default async function AdminProduits() {
  await requireAdmin();
  const products = await listProducts();
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
      <section aria-labelledby="nouveau" className="max-w-xl">
        <h2 id="nouveau" className="mb-3 font-display text-[1.5rem]">
          Nouveau produit
        </h2>
        <NewProductForm />
      </section>
    </div>
  );
}
