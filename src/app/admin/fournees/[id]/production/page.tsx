import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/PrintButton";
import { getCycle, getCycleDemand, listProducts } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/session";
import { productionLabel } from "@/lib/cycle-status";
import { formatDay, formatTime } from "@/lib/dates";

export const metadata = { title: "Fiche de production" };

/** Fiche de production imprimable : demande confirmée, supplément décidé, total à produire. */
export default async function FicheProduction({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const cycle = await getCycle(id);
  if (!cycle) notFound();
  const demand = await getCycleDemand(id, await listProducts());
  return (
    <div className="flex max-w-4xl flex-col gap-6 print:max-w-none">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">Fiche de production · fournée n°{cycle.number}</h1>
          <p className="text-encre-douce">
            {productionLabel(cycle)} Livraison et retrait le {formatDay(cycle.fulfillmentDate)}. Précommandes arrêtées le {formatDay(cycle.closesAt)} à{" "}
            {formatTime(cycle.closesAt)}.
          </p>
          <p className="text-encre-douce">Éditée le {formatDay(new Date())} à {formatTime(new Date())}.</p>
        </div>
        <PrintButton label="Imprimer la fiche" />
      </header>
      <table className="w-full border-collapse text-left tabular-nums" data-testid="fiche-production">
        <caption className="sr-only">Quantités à produire par produit</caption>
        <thead>
          <tr className="border-b-2 border-chocolat">
            <th scope="col" className="p-2">Produit</th>
            <th scope="col" className="p-2">Payé et confirmé</th>
            <th scope="col" className="p-2">Paiement à vérifier</th>
            <th scope="col" className="p-2">Supplément décidé</th>
            <th scope="col" className="p-2">Total à produire</th>
          </tr>
        </thead>
        <tbody>
          {demand.map((d) => (
            <tr key={d.productId} className="border-b border-dashed border-chocolat/40">
              <th scope="row" className="p-2">
                {d.name} <span className="font-normal text-encre-douce">({d.unitLabelPlural})</span>
              </th>
              <td className="p-2">{d.paid}</td>
              <td className="p-2">{d.toProduce - d.paid}</td>
              <td className="p-2">{d.extra}</td>
              <td className="p-2 font-bold">{d.toProduce + d.extra}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-encre-douce">
        Les commandes dont le paiement est à vérifier sont comptées pour la production, mais ne sont garanties qu&apos;après la vérification du
        paiement Wave par Alima.
      </p>
    </div>
  );
}
