import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AllergensEditor, FlavorsEditor, ImagesEditor, ProductForm, VariantsEditor } from "@/components/admin/ProductEditors";
import { listAllergens, listFlavors, listProducts } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";

export const metadata = { title: "Produit" };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t-2 border-dashed border-chocolat/20 pt-6">
      <h2 className="font-display text-[1.5rem]">{title}</h2>
      {children}
    </section>
  );
}

export default async function ProduitAdmin({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [products, flavors, allergens] = await Promise.all([listProducts(), listFlavors(), listAllergens()]);
  const product = products.find((p) => p.id === id);
  if (!product) notFound();
  const base = `${serverEnv().NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/products/`;
  const imageUrl = Object.fromEntries(product.images.map((img) => [img.id, img.path.startsWith("/") ? img.path : `${base}${img.path}`]));
  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">{product.name}</h1>
      <ProductForm product={product} categories={[...new Set(products.map((p) => p.category))]} />
      <Section title="Formats et prix">
        <VariantsEditor product={product} />
      </Section>
      <Section title="Parfums">
        <FlavorsEditor product={product} flavors={flavors} />
      </Section>
      <Section title="Allergènes">
        <AllergensEditor product={product} allergens={allergens} />
      </Section>
      <Section title="Photos">
        <ImagesEditor product={product} imageUrl={imageUrl} />
      </Section>
    </div>
  );
}
