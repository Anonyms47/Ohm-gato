import type { Metadata } from "next";
import { OrderTicket } from "@/components/account/OrderTicket";
import { getMyOrders, isActiveOrder } from "@/lib/account/data";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Mes commandes" };

export default async function MesCommandes() {
  const user = await requireUser("/compte/commandes");
  const orders = await getMyOrders(user.id);
  const active = orders.filter(isActiveOrder);
  const past = orders.filter((o) => !isActiveOrder(o));
  return (
    <div className="flex flex-col gap-10">
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
