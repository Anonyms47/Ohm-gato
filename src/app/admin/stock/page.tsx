import { QueryFilters } from "@/components/admin/OrderFilters";
import { StockRow } from "@/components/admin/StockEditor";
import { activeCycle, getCycleSetup, listActiveReservations, listCycles, listMovements, listProducts } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/session";
import { formatShortDay, formatTime } from "@/lib/dates";

export const metadata = { title: "Stock" };

const KIND: Record<string, string> = {
  initial: "Stock initial",
  adjustment: "Ajustement",
  reserve: "Réservation",
  release: "Libération",
  sell: "Vente",
  cancel_sale: "Annulation de vente",
};

export default async function AdminStock({ searchParams }: { searchParams: Promise<{ fournee?: string }> }) {
  await requireAdmin();
  const { fournee } = await searchParams;
  const [cycles, current, products] = await Promise.all([listCycles(), activeCycle(), listProducts()]);
  const cycleId = fournee ?? current?.id ?? null;
  const cycle = cycles.find((c) => c.id === cycleId) ?? null;
  const name = (id: string) => products.find((p) => p.id === id)?.name ?? "Produit";
  const unit = (id: string) => products.find((p) => p.id === id)?.unitLabelPlural ?? "unités";
  if (!cycle) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">Stock</h1>
        <p>Aucune fournée.</p>
      </div>
    );
  }
  const [setup, movements, reservations] = await Promise.all([getCycleSetup(cycle.id), listMovements(cycle.id), listActiveReservations(cycle.id)]);
  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">Stock · fournée n°{cycle.number}</h1>
      <QueryFilters withSearch={false} filters={[{ name: "fournee", label: "Fournée", options: cycles.map((c) => ({ value: c.id, label: `n°${c.number}` })) }]} />
      <p className="text-encre-douce">
        Stock en unités réelles : une box de 6 consomme 6 unités. Disponible = total − réservé (paiements en cours) − vendu. La base refuse toute survente.
      </p>
      {setup.inventory.length === 0 ? (
        <p>Aucun stock défini : composez la fournée dans « Fournées ».</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {setup.inventory.map((i) => (
            <li key={i.productId} className="flex flex-col gap-3 rounded-[12px] bg-blanc-casse p-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="font-bold">{name(i.productId)}</p>
                <p className="tabular-nums">
                  Disponible <strong>{Math.max(0, i.totalUnits - i.reservedUnits - i.soldUnits)}</strong> · réservé {i.reservedUnits} · vendu {i.soldUnits} · total {i.totalUnits}{" "}
                  {unit(i.productId)}
                </p>
              </div>
              <StockRow cycleId={cycle.id} productId={i.productId} total={i.totalUnits} label={name(i.productId)} />
            </li>
          ))}
        </ul>
      )}
      <section aria-labelledby="reservations">
        <h2 id="reservations" className="font-display text-[1.5rem]">
          Réservations en cours ({reservations.length})
        </h2>
        <p className="text-encre-douce">Libérées automatiquement à l&apos;échec ou à l&apos;expiration du paiement.</p>
        <ul className="mt-2">
          {reservations.map((r) => (
            <li key={r.id} className="tabular-nums">
              {r.orders?.reference} · {name(r.product_id)} · {r.units} u. · expire {formatTime(r.expires_at)}
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="mouvements">
        <h2 id="mouvements" className="font-display text-[1.5rem]">
          Historique des mouvements
        </h2>
        <div className="mt-3 overflow-x-auto rounded-[12px] bg-blanc-casse">
          <table className="w-full min-w-[36rem] text-left tabular-nums">
            <caption className="sr-only">Mouvements de stock</caption>
            <thead>
              <tr className="border-b-2 border-chocolat/20">
                <th className="p-2">Date</th>
                <th className="p-2">Produit</th>
                <th className="p-2">Mouvement</th>
                <th className="p-2 text-right">Unités</th>
                <th className="p-2">Détail</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-b border-dashed border-chocolat/15">
                  <td className="p-2">
                    {formatShortDay(m.created_at)} {formatTime(m.created_at)}
                  </td>
                  <td className="p-2">{name(m.product_id)}</td>
                  <td className="p-2">{KIND[m.kind] ?? m.kind}</td>
                  <td className="p-2 text-right">{m.units > 0 && m.kind === "adjustment" ? `+${m.units}` : m.units}</td>
                  <td className="p-2">
                    {m.orders?.reference ?? ""} {m.reason ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
