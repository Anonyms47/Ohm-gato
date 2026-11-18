import type { Metadata } from "next";
import { OrderTicket } from "@/components/account/OrderTicket";
import { getMyOrders, isActiveOrder } from "@/lib/account/data";
import { computeInsights, plural } from "@/lib/account/insights";
import { formatFcfa } from "@/lib/money";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Mes commandes" };

export default async function MesCommandes() {
  const user = await requireUser("/compte/commandes");
  const orders = await getMyOrders(user.id);
  const active = orders.filter(isActiveOrder);
  const past = orders.filter((o) => !isActiveOrder(o));
  const insights = computeInsights(orders);
  const paidTotal = orders.filter((o) => o.paymentStatus === "paid" && o.status !== "refunded").reduce((sum, o) => sum + o.totalFcfa, 0);
  return (
    <div className="flex flex-col gap-10">
      {insights.orderCount > 0 && (
        <dl className="grid grid-cols-3 gap-3 rounded-[14px] border-2 border-chocolat/15 bg-blanc-casse p-4 text-center">
          <div>
            <dt className="text-encre-douce">Commandes</dt>
            <dd className="font-display text-[1.6rem] tabular-nums">{insights.orderCount}</dd>
          </div>
          <div>
            <dt className="text-encre-douce">{plural(insights.cycleNumbers.length, "fournée", "fournées").replace(/^\d+ /, "")}</dt>
            <dd className="font-display text-[1.6rem] tabular-nums">{insights.cycleNumbers.length}</dd>
          </div>
          <div>
            <dt className="text-encre-douce">Total payé</dt>
            <dd className="font-display text-[1.2rem] leading-[2.1rem] tabular-nums sm:text-[1.6rem] sm:leading-normal">{formatFcfa(paidTotal)}</dd>
          </div>
        </dl>
      )}
      <section aria-labelledby="en-cours">
        <h1 id="en-cours" className="font-display text-[1.8rem]">
          En cours
        </h1>
        {active.length === 0 ? (
          <p className="mt-3 text-encre-douce">Aucune commande en cours.</p>
        ) : (
          <ul className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((order) => (
              <li key={order.id}>
                <OrderTicket order={order} highlight />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="historique">
        <h2 id="historique" className="font-display text-[1.8rem]">
          Historique
        </h2>
        {past.length === 0 ? (
          <p className="mt-3 text-encre-douce">Vos commandes terminées s&apos;afficheront ici, comme des tickets.</p>
        ) : (
          <ul className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((order) => (
              <li key={order.id}>
                <OrderTicket order={order} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
