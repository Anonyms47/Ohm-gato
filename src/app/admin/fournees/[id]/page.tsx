import Link from "next/link";
import { notFound } from "next/navigation";
import { CycleForm, CycleProductsEditor, CycleStatusActions, SlotsEditor } from "@/components/admin/CycleEditors";
import { ProductionEditor, SurplusPublisher, WithdrawSurplus } from "@/components/admin/CycleProduction";
import { getCycle, getCycleDemand, getCycleSetup, listFlavors, listProducts, type DemandRow } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/session";
import { cyclePhase, cyclePhaseLabel, isUpcoming, productionLabel } from "@/lib/cycle-status";
import { formatDay, formatTime } from "@/lib/dates";

export const metadata = { title: "Fournée" };

const COLUMNS: { key: keyof DemandRow; label: string }[] = [
  { key: "ordered", label: "Commandé" },
  { key: "toVerify", label: "Paiement à vérifier" },
  { key: "paid", label: "Payé et confirmé" },
  { key: "cancelled", label: "Annulé" },
  { key: "toProduce", label: "À produire (confirmées)" },
  { key: "extra", label: "Supplément décidé" },
  { key: "produced", label: "Réellement produit" },
  { key: "lost", label: "Pertes" },
  { key: "reservedForOrders", label: "Réservé aux commandes" },
  { key: "handedOver", label: "Livré ou retiré" },
  { key: "remaining", label: "Restant" },
  { key: "surplusPublished", label: "Publié en surplus" },
  { key: "surplusSold", label: "Vendu en surplus" },
  { key: "available", label: "Disponible à la vente" },
];

function DemandTable({ demand }: { demand: DemandRow[] }) {
  if (demand.length === 0) return <p className="text-encre-douce">Aucun produit dans la fournée.</p>;
  return (
    <div className="overflow-x-auto rounded-[12px] border-2 border-chocolat/20 bg-blanc-casse" tabIndex={0} role="region" aria-label="Synthèse de la demande (défilement horizontal)">
      <table className="w-full min-w-[64rem] border-collapse text-left tabular-nums" data-testid="synthese-demande">
        <caption className="sr-only">Synthèse de la demande par produit, en unités réelles</caption>
        <thead>
          <tr className="border-b-2 border-chocolat/20">
            <th scope="col" className="p-3">
              Produit
            </th>
            {COLUMNS.map((c) => (
              <th key={c.key} scope="col" className="p-3 text-[0.9rem]">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {demand.map((row) => (
            <tr key={row.productId} className="border-b border-dashed border-chocolat/20">
              <th scope="row" className="p-3 font-bold">
                {row.name}
              </th>
              {COLUMNS.map((c) => (
                <td key={c.key} className="p-3">
                  {row[c.key] === null ? "—" : String(row[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function FourneeAdmin({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const cycle = await getCycle(id);
  if (!cycle) notFound();
  const [products, flavors, setup] = await Promise.all([listProducts(), listFlavors(), getCycleSetup(id)]);
  const demand = await getCycleDemand(id, products);
  const phase = cycle.status === "draft" ? null : cyclePhase(cycle);
  const afterClose = ["closed", "preparing", "delivering", "surplus", "done"].includes(cycle.status) || phase === "closed";
  const hasSurplusSlots = setup.slots.some((s) => s.phase === "surplus" && s.isActive && isUpcoming(s.endsAt));

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">
          Fournée n°{cycle.number} · {phase ? cyclePhaseLabel[phase] : "Brouillon"}
        </h1>
        <p className="text-encre-douce">
          Précommandes jusqu&apos;au {formatDay(cycle.closesAt)} à {formatTime(cycle.closesAt)} (heure de Dakar) · {productionLabel(cycle)} · Livraison et
          retrait le {formatDay(cycle.fulfillmentDate)}.
        </p>
        {cycle.status === "open" && phase === "closed" && (
          <p className="font-bold text-orange-encre">
            La date limite est passée : plus aucune précommande n&apos;est acceptée. Clôturez les précommandes pour passer à la suite.
          </p>
        )}
        <p className="flex flex-wrap gap-4">
          {cycle.status !== "draft" && (
            <Link href={`/fournees/${cycle.number}`} className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
              Page publique de la fournée
            </Link>
          )}
          <Link href={`/admin/fournees/${cycle.id}/production`} className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
            Fiche de production (imprimable)
          </Link>
          <Link href={`/admin/commandes?fournee=${cycle.id}`} className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
            Commandes de la fournée
          </Link>
        </p>
        <CycleStatusActions cycle={cycle} />
      </header>

      <section aria-labelledby="demande" className="flex flex-col gap-3">
        <h2 id="demande" className="font-display text-[1.6rem]">
          Synthèse de la demande
        </h2>
        <p className="text-encre-douce">
          Le minimum à réserver vient des commandes payées et confirmées. Les commandes provisoires ou annulées n&apos;augmentent pas la production.
        </p>
        <DemandTable demand={demand} />
      </section>

      <section aria-labelledby="production" className="flex flex-col gap-3">
        <h2 id="production" className="font-display text-[1.6rem]">
          Production
        </h2>
        <ProductionEditor cycleId={cycle.id} cycleStatus={cycle.status} demand={demand} inventory={setup.inventory} />
      </section>

      {afterClose && (
        <section aria-labelledby="surplus" className="flex flex-col gap-3">
          <h2 id="surplus" className="font-display text-[1.6rem]">
            Surplus
          </h2>
          <SurplusPublisher
            cycleId={cycle.id}
            cycleStatus={cycle.status}
            demand={demand}
            inventory={setup.inventory}
            surplusEndsAt={cycle.surplusEndsAt}
            surplusDeliveryAllowed={cycle.surplusDeliveryAllowed}
            hasSurplusSlots={hasSurplusSlots}
          />
          {cycle.status === "surplus" && (
            <ul className="flex flex-col gap-2">
              {demand
                .filter((d) => d.available > 0)
                .map((d) => (
                  <li key={d.productId} className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] bg-blanc-casse p-3">
                    <span>
                      <strong>{d.name}</strong> · {d.available} {d.unitLabelPlural} en vente
                    </span>
                    <WithdrawSurplus cycleId={cycle.id} productId={d.productId} name={d.name} />
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="infos" className="max-w-3xl">
        <h2 id="infos" className="mb-4 font-display text-[1.6rem]">
          Configuration de la fournée
        </h2>
        <CycleForm cycle={cycle} products={products} nextNumber={cycle.number} />
      </section>
      <section aria-labelledby="produits">
        <h2 id="produits" className="mb-4 font-display text-[1.6rem]">
          Produits, formats et capacité de précommande
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
