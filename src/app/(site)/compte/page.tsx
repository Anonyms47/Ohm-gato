import Link from "next/link";
import { LocalDrafts } from "@/components/account/LocalDrafts";
import { OrderProgress } from "@/components/account/OrderProgress";
import { OrderTicket } from "@/components/account/OrderTicket";
import { RecomposeBox } from "@/components/account/RecomposeBox";
import { StampBook } from "@/components/account/StampBook";
import { ButtonLink } from "@/components/ui/Button";
import { getMyFavorites, getMyOrders, getMyProfile, isActiveOrder } from "@/lib/account/data";
import { computeInsights, plural } from "@/lib/account/insights";
import { requireUser } from "@/lib/auth/session";
import { getCatalog } from "@/lib/catalog";
import { getMyCustomRequests } from "@/lib/custom/data";
import { customStatusLabel } from "@/lib/custom/status";
import { cycleStatusLine, phaseAction, phaseNow } from "@/lib/cycle-status";
import { formatDay, formatShortDay } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { isAwaitingPayment, statusHeadline } from "@/lib/order-status";

const LINK = "font-bold underline decoration-caramel decoration-2 underline-offset-4 hover:decoration-chocolat";

function Card({ id, title, children, className = "" }: { id: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={`rounded-[14px] border-2 border-chocolat/15 bg-blanc-casse p-5 ${className}`}>
      <h2 id={id} className="font-display text-[1.4rem] leading-tight">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function CompteAccueil() {
  const user = await requireUser("/compte");
  const [orders, requests, profile, favoriteIds, catalog] = await Promise.all([
    getMyOrders(user.id),
    getMyCustomRequests(user.id),
    getMyProfile(user.id),
    getMyFavorites(user.id),
    getCatalog(),
  ]);
  const active = orders.filter(isActiveOrder);
  const priority = active[0] ?? null;
  const proposals = requests.filter((r) => r.hasOpenProposal);
  const insights = computeInsights(orders);
  const slugOf = (productId: string | null) => catalog.products.find((p) => p.id === productId)?.slug ?? null;
  const favorites = catalog.products.filter((p) => favoriteIds.includes(p.id));
  const cycle = catalog.cycle;
  const phase = cycle ? phaseNow(cycle) : null;
  const action = cycle && phase ? phaseAction(phase, cycle.number) : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.45fr_1fr]">
      <div className="flex min-w-0 flex-col gap-8">
        {/* Commande en cours : le cœur du carnet. */}
        <section aria-labelledby="active">
          <h1 id="active" className="font-display text-[1.8rem]">
            {priority ? "Commande en cours" : "Aucune commande en cours"}
          </h1>
          {priority ? (
            <div className="mt-4 flex flex-col gap-5 rounded-[14px] border-2 border-chocolat bg-blanc-casse p-5 shadow-[0_4px_0_var(--ohm-chocolat)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold tabular-nums">{priority.reference}</p>
                  <p className="font-display text-[1.6rem] leading-tight">{statusHeadline[priority.status]}</p>
                  {priority.slot && (
                    <p className="text-encre-douce">
                      {priority.fulfillment === "pickup" ? "Retrait" : "Livraison"} le {formatDay(priority.slot.startsAt)}
                    </p>
                  )}
                </div>
                {priority.paymentStatus === "paid" && <span className="ohm-tampon text-succes">Payée</span>}
              </div>
              <OrderProgress status={priority.status} fulfillment={priority.fulfillment} />
              {priority.pickupCode && priority.fulfillment === "pickup" && (
                <p className="rounded-[10px] bg-creme p-3">
                  Code de retrait : <strong className="font-display text-[1.3rem] tracking-widest tabular-nums">{priority.pickupCode}</strong>
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <ButtonLink href={priority.trackingPath}>
                  {isAwaitingPayment(priority.status, priority.paymentStatus) ? "Reprendre le paiement" : "Suivre la commande"}
                </ButtonLink>
                <ButtonLink href={`/compte/commandes/${priority.reference}`} variant="secondary">
                  Détail
                </ButtonLink>
              </div>
              {active.length > 1 && (
                <p className="text-encre-douce">
                  + {plural(active.length - 1, "autre commande", "autres commandes")} en cours.{" "}
                  <Link href="/compte/commandes" className={LINK}>
                    Tout voir
                  </Link>
                </p>
              )}
            </div>
          ) : (
            <div className="mt-3 flex flex-col items-start gap-3">
              <p>
                {insights.orderCount > 0 ? "Tout est livré. " : "Votre carnet attend sa première page. "}
                La prochaine fournée vous attend dans le journal du four.
              </p>
              <ButtonLink href="/fournees" variant="secondary">
                Voir le journal du four
              </ButtonLink>
            </div>
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
                  <Link href={`/compte/sur-mesure/${r.reference}`} className={LINK}>
                    {r.occasion} — {formatDay(r.eventAt)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Prochaine fournée, telle que décidée par Alima. */}
        <Card id="prochaine" title={cycle ? `Fournée n°${cycle.number}` : "Prochaine fournée"}>
          {cycle ? (
            <div className="flex flex-col items-start gap-3">
              <p>{cycleStatusLine(cycle)}</p>
              {action && (
                <ButtonLink href={action.href} variant={phase === "open" ? "primary" : "secondary"}>
                  {action.label}
                </ButtonLink>
              )}
            </div>
          ) : (
            <p className="text-encre-douce">Aucune fournée annoncée pour le moment. Activez l&apos;alerte pour recevoir l&apos;annonce dès l&apos;ouverture.</p>
          )}
        </Card>

        {insights.lastBox && (
          <Card id="derniere-boite" title="Votre dernière boîte">
            <p className="text-encre-douce">
              {insights.lastBox.reference} · {formatShortDay(insights.lastBox.createdAt)} · {formatFcfa(insights.lastBox.totalFcfa)}
            </p>
            <ul className="mt-2 mb-4 list-disc pl-5">
              {insights.lastBox.items.slice(0, 5).map((i, n) => (
                <li key={n}>
                  {i.quantity} × {i.productName} <span className="text-encre-douce">— {i.variantLabel}</span>
                </li>
              ))}
              {insights.lastBox.items.length > 5 && <li className="text-encre-douce">+ {insights.lastBox.items.length - 5} autres</li>}
            </ul>
            <RecomposeBox
              items={insights.lastBox.items.map((i) => ({ variantId: i.variantId, flavorId: i.flavorId, quantity: i.quantity, productName: i.productName, variantLabel: i.variantLabel }))}
            />
          </Card>
        )}

        <section aria-labelledby="dernieres">
          <div className="flex items-end justify-between gap-3">
            <h2 id="dernieres" className="font-display text-[1.5rem]">
              Derniers tickets
            </h2>
            <Link href="/compte/commandes" className={`inline-flex min-h-11 items-center ${LINK}`}>
              Tout l&apos;historique
            </Link>
          </div>
          {orders.length === 0 ? (
            <p className="mt-3 text-encre-douce">Vos commandes apparaîtront ici, comme des tickets de caisse.</p>
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

      <div className="flex min-w-0 flex-col gap-8">
        <Card id="tampons" title="Mon carnet de fournées">
          <StampBook cycleNumbers={insights.cycleNumbers} />
          {insights.orderCount > 0 && (
            <p className="mt-3 text-encre-douce">
              {plural(insights.orderCount, "commande")} · {plural(insights.cycleNumbers.length, "fournée goûtée", "fournées goûtées")}
            </p>
          )}
        </Card>

        {insights.habits.length > 0 && (
          <Card id="habitudes" title="Vos habitudes">
            <ol className="flex flex-col gap-2">
              {insights.habits.map((h, index) => {
                const slug = slugOf(h.productId);
                return (
                  <li key={h.productId ?? h.productName} className="flex items-center gap-3">
                    <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-caramel font-display text-[0.95rem]">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      {slug ? (
                        <Link href={`/carte/${slug}`} className={LINK}>
                          {h.productName}
                        </Link>
                      ) : (
                        <span className="font-bold">{h.productName}</span>
                      )}
                      <span className="block text-encre-douce">{plural(h.quantity, "pièce")} commandée{h.quantity > 1 ? "s" : ""}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </Card>
        )}

        {favorites.length > 0 && (
          <Card id="coups-de-coeur" title="Vos coups de cœur">
            <ul className="flex flex-wrap gap-2">
              {favorites.map((p) => (
                <li key={p.id}>
                  <Link href={`/carte/${p.slug}`} className="inline-flex min-h-11 items-center rounded-full border-2 border-chocolat/25 px-4 font-bold hover:border-chocolat">
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

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
              <Link href="/sur-mesure" className={LINK}>
                Préparer un événement
              </Link>
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {requests.slice(0, 4).map((r) => (
                <li key={r.id} className="rounded-[10px] bg-blanc-casse p-3">
                  <Link href={`/compte/sur-mesure/${r.reference}`} className={LINK}>
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
            {profile.preferences.newCycle ? "Vous recevrez une alerte à l'ouverture des prochaines fournées." : "Pas d'alerte pour les nouvelles fournées."}{" "}
            <Link href="/compte/profil#alertes" className={LINK}>
              Modifier
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
