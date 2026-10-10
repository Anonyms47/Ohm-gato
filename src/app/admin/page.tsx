import Link from "next/link";
import { StatCard } from "@/components/admin/AdminUi";
import { dashboard } from "@/lib/admin/data";
import { IDENTITY_ALERT, getLegalSettings, missingIdentityFields } from "@/lib/admin/legal";
import { requireAdmin } from "@/lib/auth/session";
import { cyclePhase, cyclePhaseLabel } from "@/lib/cycle-status";
import { formatDay, formatTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { statusHeadline } from "@/lib/order-status";

export default async function AdminDashboard() {
  await requireAdmin();
  const [d, legal] = await Promise.all([dashboard(), getLegalSettings()]);
  const identityMissing = missingIdentityFields(legal.identity).length > 0;
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">Tableau de bord</h1>
        <p className="text-encre-douce">Chiffres des produits uniquement : les frais de livraison sont réglés au livreur et n&apos;en font jamais partie.</p>
      </header>

      {identityMissing && (
        <section className="rounded-[12px] border-2 border-caramel-encre bg-blanc-casse p-4" data-testid="alerte-identite">
          <p className="font-bold">{IDENTITY_ALERT}</p>
          <Link href="/admin/documents" className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
            Documents et règles
          </Link>
        </section>
      )}

      {d.attention.length > 0 && (
        <section className="rounded-[12px] border-2 border-erreur bg-blanc-casse p-4">
          <h2 className="font-bold text-erreur">À vérifier d&apos;urgence</h2>
          <ul className="mt-2">
            {d.attention.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/commandes/${o.id}`} className="font-bold underline underline-offset-4">
                  {o.reference}
                </Link>{" "}
                — {o.customer_name} : paiement reçu, commande à arbitrer (stock ou montant).
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.toVerify.length > 0 && (
        <section className="rounded-[12px] border-2 border-wave-encre bg-blanc-casse p-4">
          <h2 className="font-bold">Paiements Wave à vérifier ({d.toVerify.length})</h2>
          <p className="text-encre-douce">Commandes confirmées : vérifiez la réception dans l&apos;application Wave, puis enregistrez-la ou annulez la commande.</p>
          <ul className="mt-2">
            {d.toVerify.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/commandes/${o.id}`} className="font-bold underline underline-offset-4">
                  {o.reference}
                </Link>{" "}
                — {o.customer_name} · {formatFcfa(o.total_fcfa)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Commandes du jour" value={d.todayCount} hint={`${d.todayPaid} payée${d.todayPaid > 1 ? "s" : ""}`} />
        <StatCard label="Encaissé aujourd'hui (produits)" value={formatFcfa(d.revenueTodayFcfa)} />
        <StatCard label="Paiements en attente" value={d.pendingPayments} />
        <StatCard label="Demandes sur-mesure à traiter" value={d.openRequests} hint={`${d.acceptedRequests} en cours de réalisation`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="fournee" className="rounded-[12px] border-2 border-chocolat/20 bg-blanc-casse p-5">
          <h2 id="fournee" className="font-display text-[1.5rem]">
            Fournée active
          </h2>
          {d.cycle ? (
            <>
              <p className="mt-1">
                <Link href={`/admin/fournees/${d.cycle.id}`} className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
                  n°{d.cycle.number} — {d.cycle.title}
                </Link>{" "}
                · {cyclePhaseLabel[cyclePhase(d.cycle)]}
              </p>
              <p className="text-encre-douce">
                Clôture {formatDay(d.cycle.closesAt)}, {formatTime(d.cycle.closesAt)} · livraison {formatDay(d.cycle.fulfillmentDate)}
              </p>
              {d.inventory.length > 0 && (
                <table className="mt-4 w-full text-left tabular-nums">
                  <caption className="sr-only">Stock de la fournée</caption>
                  <thead>
                    <tr className="border-b-2 border-chocolat/20">
                      <th className="py-1">Produit</th>
                      <th className="py-1 text-right">Dispo</th>
                      <th className="py-1 text-right">Réservé</th>
                      <th className="py-1 text-right">Vendu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.inventory.map((i) => (
                      <tr key={i.product_id} className="border-b border-dashed border-chocolat/15">
                        <td className="py-1">{i.product_name}</td>
                        <td className={`py-1 text-right ${d.lowStock.some((l) => l.product_id === i.product_id) ? "font-bold text-erreur" : ""}`}>
                          {d.cycle?.status === "surplus" ? `${i.available_units}/${i.total_units}` : "Sans limite"}
                        </td>
                        <td className="py-1 text-right">{i.reserved_units}</td>
                        <td className="py-1 text-right">{i.sold_units}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : (
            <p className="mt-2">
              Aucune fournée en cours.{" "}
              <Link href="/admin/fournees/nouvelle" className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
                Créer une fournée
              </Link>
            </p>
          )}
        </section>

        <section aria-labelledby="preparer" className="rounded-[12px] border-2 border-chocolat/20 bg-blanc-casse p-5">
          <h2 id="preparer" className="font-display text-[1.5rem]">
            À préparer ({d.toPrepare.length})
          </h2>
          <p className="text-encre-douce">
            {d.deliveries} livraison{d.deliveries > 1 ? "s" : ""} ·{" "}
            <Link href="/admin/livraisons" className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
              carte des livraisons
            </Link>{" "}
            · {d.pickups} retrait{d.pickups > 1 ? "s" : ""}
          </p>
          {d.toPrepare.length === 0 ? (
            <p className="mt-3">Rien à préparer pour le moment.</p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-dashed divide-chocolat/20">
              {d.toPrepare.slice(0, 12).map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/admin/commandes/${o.id}`} className="font-bold underline underline-offset-4">
                    {o.reference}
                  </Link>
                  <span>{o.customer_name}</span>
                  <span className="text-encre-douce">
                    {o.fulfillment === "delivery" ? "Livraison" : "Retrait"} · {statusHeadline[o.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {d.lowStock.length > 0 && (
        <section aria-labelledby="faible" className="rounded-[12px] border-2 border-orange-encre bg-blanc-casse p-5">
          <h2 id="faible" className="font-display text-[1.4rem]">
            Produits épuisés ou presque
          </h2>
          <ul className="mt-2">
            {d.lowStock.map((i) => (
              <li key={i.product_id}>
                {i.product_name} : {i.available_units} {i.unit_label_plural} disponibles sur {i.total_units}
              </li>
            ))}
          </ul>
          <Link href="/admin/stock" className="mt-2 inline-flex min-h-11 items-center font-bold underline decoration-caramel decoration-2 underline-offset-4">
            Ajuster le stock
          </Link>
        </section>
      )}
    </div>
  );
}
