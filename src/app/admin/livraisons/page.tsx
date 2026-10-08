import { QueryFilters } from "@/components/admin/OrderFilters";
import { DeliveryBoard } from "@/components/admin/DeliveryBoard";
import { activeCycle, listCycles, listDeliveries } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/session";

export const metadata = { title: "Livraisons" };

export default async function AdminLivraisons({ searchParams }: { searchParams: Promise<{ fournee?: string }> }) {
  await requireAdmin();
  const { fournee } = await searchParams;
  const [cycles, current] = await Promise.all([listCycles(), activeCycle()]);
  const cycleId = fournee ?? current?.id ?? null;
  const stops = await listDeliveries(cycleId);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">Positions de livraison</h1>
      <QueryFilters withSearch={false} filters={[{ name: "fournee", label: "Fournée", options: cycles.map((c) => ({ value: c.id, label: `n°${c.number}` })) }]} />
      <DeliveryBoard key={cycleId ?? "aucune"} stops={stops} />
    </div>
  );
}
