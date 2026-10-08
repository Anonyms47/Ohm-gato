import { CycleForm } from "@/components/admin/CycleEditors";
import { listCycles, listProducts } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/session";

export const metadata = { title: "Nouvelle fournée" };

export default async function NouvelleFournee() {
  await requireAdmin();
  const [cycles, products] = await Promise.all([listCycles(), listProducts()]);
  const nextNumber = Math.max(0, ...cycles.map((c) => c.number)) + 1;
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">Nouvelle fournée</h1>
      <p className="text-encre-douce">La fournée est créée en brouillon, invisible des clients. Ajoutez ensuite produits, stock et créneaux.</p>
      <CycleForm cycle={null} products={products} nextNumber={nextNumber} />
    </div>
  );
}
