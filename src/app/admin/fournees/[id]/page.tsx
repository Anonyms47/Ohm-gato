import { notFound } from "next/navigation";
import { CycleForm, CycleProductsEditor, CycleStatusActions, SlotsEditor } from "@/components/admin/CycleEditors";
import { getCycle, getCycleSetup, listFlavors, listProducts } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/session";
import { cyclePhase, cyclePhaseLabel } from "@/lib/cycle-status";

export const metadata = { title: "Fournée" };

export default async function FourneeAdmin({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const cycle = await getCycle(id);
  if (!cycle) notFound();
  const [products, flavors, setup] = await Promise.all([listProducts(), listFlavors(), getCycleSetup(id)]);
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">
          Fournée n°{cycle.number} · {cycle.status === "draft" ? "Brouillon" : cyclePhaseLabel[cyclePhase(cycle)]}
        </h1>
        <CycleStatusActions cycle={cycle} />
      </header>
      <section aria-labelledby="infos" className="max-w-3xl">
        <h2 id="infos" className="mb-4 font-display text-[1.6rem]">
          Dates, message et produit vedette
        </h2>
        <CycleForm cycle={cycle} products={products} nextNumber={cycle.number} />
      </section>
      <section aria-labelledby="produits">
        <h2 id="produits" className="mb-4 font-display text-[1.6rem]">
          Produits, formats et stock
        </h2>
        <CycleProductsEditor cycleId={cycle.id} products={products} flavors={flavors} setup={setup} />
      </section>
      <section aria-labelledby="creneaux">
        <h2 id="creneaux" className="mb-4 font-display text-[1.6rem]">
          Créneaux de livraison et de retrait
        </h2>
        <SlotsEditor cycleId={cycle.id} slots={setup.slots} fulfillmentDate={cycle.fulfillmentDate} />
      </section>
    </div>
  );
}
