"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { readPendingOrders, type PendingOrder } from "@/components/order/pending-orders";

/** Commandes récentes passées depuis cet appareil (mémoire locale de 7 jours). */
export function RememberedOrders() {
  // Lecture de la mémoire locale après hydratation (rien côté serveur).
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const orders = useMemo<PendingOrder[]>(() => (hydrated ? readPendingOrders() : []), [hydrated]);
  if (orders.length === 0) return null;
  return (
    <section aria-labelledby="commandes-appareil" className="mt-8 rounded-[14px] border-2 border-chocolat/20 bg-blanc-casse p-4">
      <h2 id="commandes-appareil" className="font-bold">
        Commandes récentes sur cet appareil
      </h2>
      <ul className="mt-2">
        {orders.map((o) => (
          <li key={o.reference}>
            <Link href={`/suivi/${o.token}`} className="inline-flex min-h-11 items-center font-bold underline decoration-caramel decoration-2 underline-offset-4">
              Commande {o.reference}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
