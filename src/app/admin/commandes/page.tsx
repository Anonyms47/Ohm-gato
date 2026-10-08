import Link from "next/link";
import { QueryFilters } from "@/components/admin/OrderFilters";
import { listCycles, listOrders } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/session";
import { formatShortDay, formatTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { ORDER_STATUSES, paymentStatusLabel, PAYMENT_STATUSES, statusHeadline } from "@/lib/order-status";
import { formatSenegalPhone } from "@/lib/phone";

export const metadata = { title: "Commandes" };

export default async function AdminCommandes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [orders, cycles] = await Promise.all([
    listOrders({ q: sp.q, status: sp.statut, payment: sp.paiement, fulfillment: sp.mode, cycle: sp.fournee, today: sp.jour === "aujourdhui" }),
    listCycles(),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">Commandes</h1>
      <QueryFilters
        filters={[
          { name: "statut", label: "Statut", options: ORDER_STATUSES.map((s) => ({ value: s, label: statusHeadline[s] })) },
          { name: "paiement", label: "Paiement", options: PAYMENT_STATUSES.map((s) => ({ value: s, label: paymentStatusLabel[s] })) },
          { name: "mode", label: "Réception", options: [{ value: "delivery", label: "Livraison" }, { value: "pickup", label: "Retrait" }] },
          { name: "fournee", label: "Fournée", options: cycles.map((c) => ({ value: c.id, label: `n°${c.number}` })) },
        ]}
      />
      <p className="text-encre-douce" role="status">
        {orders.length} commande{orders.length > 1 ? "s" : ""} {orders.length === 200 ? "(200 plus récentes)" : ""}
      </p>
      {orders.length === 0 ? (
        <p>Aucune commande ne correspond.</p>
      ) : (
        <div className="overflow-x-auto rounded-[12px] border-2 border-chocolat/20 bg-blanc-casse">
          <table className="w-full min-w-[44rem] text-left">
            <caption className="sr-only">Liste des commandes</caption>
            <thead>
              <tr className="border-b-2 border-chocolat/20">
                <th className="p-3">Référence</th>
                <th className="p-3">Client</th>
                <th className="p-3">Réception</th>
                <th className="p-3">Statut</th>
                <th className="p-3 text-right">Produits</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-dashed border-chocolat/15 align-top">
                  <td className="p-3">
                    <Link href={`/admin/commandes/${o.id}`} className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
                      {o.reference}
                    </Link>
                    <span className="block text-[0.9rem] text-encre-douce">
                      {formatShortDay(o.createdAt)} {formatTime(o.createdAt)}
                    </span>
                  </td>
                  <td className="p-3">
                    {o.customerName}
                    <span className="block text-[0.9rem] text-encre-douce">{formatSenegalPhone(o.customerPhone)}</span>
                  </td>
                  <td className="p-3">
                    {o.fulfillment === "delivery" ? `Livraison${o.district ? ` · ${o.district}` : ""}` : "Retrait"}
                    {o.slotStartsAt && <span className="block text-[0.9rem] text-encre-douce">{formatShortDay(o.slotStartsAt)} {formatTime(o.slotStartsAt)}</span>}
                  </td>
                  <td className="p-3">
                    {statusHeadline[o.status]}
                    <span className="block text-[0.9rem] text-encre-douce">Paiement : {paymentStatusLabel[o.paymentStatus].toLowerCase()}</span>
                  </td>
                  <td className="p-3 text-right tabular-nums">{formatFcfa(o.totalFcfa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
