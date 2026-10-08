import Link from "next/link";
import { LocalDrafts } from "@/components/account/LocalDrafts";
import { OrderTicket } from "@/components/account/OrderTicket";
import { ButtonLink } from "@/components/ui/Button";
import { getMyOrders, getMyProfile, isActiveOrder } from "@/lib/account/data";
import { requireUser } from "@/lib/auth/session";
import { getMyCustomRequests } from "@/lib/custom/data";
import { customStatusLabel } from "@/lib/custom/status";
import { formatDay } from "@/lib/dates";
import { isAwaitingPayment, statusHeadline } from "@/lib/order-status";

export default async function CompteAccueil() {
  const user = await requireUser("/compte");
  const [orders, requests, profile] = await Promise.all([getMyOrders(user.id), getMyCustomRequests(user.id), getMyProfile(user.id)]);
  const active = orders.filter(isActiveOrder);
  const priority = active[0] ?? null;
  const proposals = requests.filter((r) => r.hasOpenProposal);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-8">
        <section aria-labelledby="active">
          <h1 id="active" className="font-display text-[1.8rem]">
            {priority ? "Commande en cours" : "Aucune commande en cours"}
          </h1>
          {priority ? (
            <div className="mt-4 flex flex-col gap-4 rounded-[14px] border-2 border-chocolat bg-blanc-casse p-5 shadow-[0_4px_0_var(--ohm-chocolat)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold tabular-nums">{priority.reference}</p>
                  <p className="font-display text-[1.6rem] leading-tight">{statusHeadline[priority.status]}</p>
                  {priority.slot && <p className="text-encre-douce">{formatDay(priority.slot.startsAt)}</p>}
                </div>
                {priority.paymentStatus === "paid" && <span className="ohm-tampon text-succes">Payée</span>}
              </div>
              <div className="flex flex-wrap gap-3">
                <ButtonLink href={priority.trackingPath}>
                  {isAwaitingPayment(priority.status, priority.paymentStatus) ? "Reprendre le paiement" : "Suivre la commande"}
                </ButtonLink>
                <ButtonLink href={`/compte/commandes/${priority.reference}`} variant="secondary">
                  Détail
                </ButtonLink>
              </div>
              {active.length > 1 && <p className="text-encre-douce">+ {active.length - 1} autre{active.length > 2 ? "s" : ""} commande{active.length > 2 ? "s" : ""} en cours.</p>}
            </div>
          ) : (
            <p className="mt-3">
              La prochaine fournée vous attend :{" "}
              <Link href="/fournees" className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
                voir le journal du four
              </Link>
              .
            </p>
          )}
        </section>

        {proposals.length > 0 && (
          <section aria-labelledby="propositions" className="rounded-[14px] border-2 border-rose-encre bg-blanc-casse p-5">
            <h2 id="propositions" className="font-display text-[1.5rem]">
              Proposition{proposals.length > 1 ? "s" : ""} reçue{proposals.length > 1 ? "s" : ""}
            </h2>
            <ul className="mt-3 flex flex-col gap-2">
              {proposals.map((r) => (
                <li key={r.id}>
                  <Link href={`/compte/sur-mesure/${r.reference}`} className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
                    {r.occasion} — {formatDay(r.eventAt)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="dernieres">
          <div className="flex items-end justify-between gap-3">
            <h2 id="dernieres" className="font-display text-[1.5rem]">
              Derniers tickets
            </h2>
            <Link href="/compte/commandes" className="inline-flex min-h-11 items-center font-bold underline decoration-caramel decoration-2 underline-offset-4">
              Tout l&apos;historique
            </Link>
          </div>
          {orders.length === 0 ? (
            <p className="mt-3 text-encre-douce">Vos commandes apparaîtront ici.</p>
          ) : (
            <ul className="mt-4 grid gap-6 sm:grid-cols-2">
              {orders.slice(0, 4).map((order) => (
                <li key={order.id}>
                  <OrderTicket order={order} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="flex flex-col gap-8">
        <section aria-labelledby="brouillons">
          <h2 id="brouillons" className="font-display text-[1.5rem]">
            Boîte et brouillons
          </h2>
          <div className="mt-3">
            <LocalDrafts />
          </div>
        </section>
        <section aria-labelledby="demandes">
          <h2 id="demandes" className="font-display text-[1.5rem]">
            Demandes sur-mesure
          </h2>
          {requests.length === 0 ? (
            <p className="mt-3">
              Aucune demande.{" "}
              <Link href="/sur-mesure" className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
                Préparer un événement
              </Link>
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {requests.slice(0, 4).map((r) => (
                <li key={r.id} className="rounded-[10px] bg-blanc-casse p-3">
                  <Link href={`/compte/sur-mesure/${r.reference}`} className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
                    {r.occasion}
                  </Link>
                  <p className="text-encre-douce">
                    {formatDay(r.eventAt)} · {customStatusLabel[r.status]}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="alertes">
          <h2 id="alertes" className="font-display text-[1.5rem]">
            Alertes
          </h2>
          <p className="mt-2">
            {profile.preferences.newCycle ? "Vous serez prévenu à l'ouverture des prochaines fournées." : "Pas d'alerte pour les nouvelles fournées."}{" "}
            <Link href="/compte/profil#alertes" className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
              Modifier
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
