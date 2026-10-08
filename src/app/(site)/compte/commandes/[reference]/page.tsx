import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RecomposeBox } from "@/components/account/RecomposeBox";
import { DeliveryFeeNotice } from "@/components/checkout/DeliveryFeeNotice";
import { ButtonLink } from "@/components/ui/Button";
import { brand } from "@/config/brand";
import { getMyOrder } from "@/lib/account/data";
import { requireUser } from "@/lib/auth/session";
import { formatShortDay, formatSlot, formatTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { isAwaitingPayment, paymentStatusLabel, statusHeadline } from "@/lib/order-status";
import { providerLabel } from "@/lib/payments/labels";

export const metadata: Metadata = { title: "Détail de commande" };

export default async function CommandeDetail({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const user = await requireUser(`/compte/commandes/${reference}`);
  const order = await getMyOrder(user.id, decodeURIComponent(reference));
  if (!order) notFound();
  const storage = Array.from(new Map(order.items.flatMap((i) => (i.storage ? [[i.productName, i.storage] as const] : []))));

  return (
    <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
      <div className="flex flex-col gap-6">
        <header>
          <p className="font-bold tabular-nums">{order.reference}</p>
          <h1 className="font-display text-[clamp(1.8rem,5vw,2.4rem)] leading-tight">{statusHeadline[order.status]}</h1>
          <p className="text-encre-douce">
            Passée le {formatShortDay(order.createdAt)} · {order.isCustom ? "Sur-mesure" : `Fournée n°${order.cycleNumber}`}
          </p>
        </header>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={order.trackingPath}>{isAwaitingPayment(order.status, order.paymentStatus) ? "Reprendre le paiement" : "Suivi en direct"}</ButtonLink>
        </div>

        <section aria-labelledby="produits" className="ohm-ticket px-5 py-5">
          <h2 id="produits" className="font-display text-[1.4rem]">
            Produits
          </h2>
          <ul className="mt-3 divide-y divide-dashed divide-chocolat/25">
            {order.items.map((item, index) => (
              <li key={index} className="flex justify-between gap-3 py-2 tabular-nums">
                <span>
                  {item.quantity} × {item.productName} <span className="text-encre-douce">— {item.variantLabel}{item.flavorName ? `, ${item.flavorName}` : ""}</span>
                </span>
                <span>{formatFcfa(item.lineTotalFcfa)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex justify-between border-t-2 border-chocolat pt-2 font-bold tabular-nums">
            <span>{order.paymentStatus === "paid" ? "Total payé" : "Total"}</span>
            <span>{formatFcfa(order.totalFcfa)}</span>
          </p>
          {order.fulfillment === "delivery" && <DeliveryFeeNotice className="mt-3" />}
        </section>

        {!order.isCustom && (
          <RecomposeBox
            items={order.items.map((i) => ({ variantId: i.variantId, flavorId: i.flavorId, quantity: i.quantity, productName: i.productName, variantLabel: i.variantLabel }))}
          />
        )}

        {storage.length > 0 && (
          <section aria-labelledby="conservation">
            <h2 id="conservation" className="font-display text-[1.4rem]">
              Conservation
            </h2>
            <ul className="mt-2 flex flex-col gap-1">
              {storage.map(([name, advice]) => (
                <li key={name}>
                  <strong>{name}</strong> : {advice}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <aside className="flex flex-col gap-6">
        <section aria-labelledby="reception">
          <h2 id="reception" className="font-display text-[1.4rem]">
            {order.fulfillment === "pickup" ? "Retrait" : "Livraison"}
          </h2>
          {order.slot && <p>{formatSlot(order.slot.startsAt, order.slot.endsAt)}</p>}
          {order.fulfillment === "pickup" ? (
            <p>{brand.pickupAddress} — gratuit</p>
          ) : (
            <p>
              {[order.address.line, order.address.district].filter(Boolean).join(", ")}
              {order.address.landmark ? ` · Repère : ${order.address.landmark}` : ""}
            </p>
          )}
          {order.pickupCode && (
            <p className="mt-3 rounded-[10px] border-2 border-chocolat p-3 text-center">
              Code de retrait <span className="block font-display text-[1.8rem] tracking-[0.25em]">{order.pickupCode}</span>
            </p>
          )}
        </section>
        <section aria-labelledby="paiements">
          <h2 id="paiements" className="font-display text-[1.4rem]">
            Paiements
          </h2>
          {order.payments.length === 0 ? (
            <p className="text-encre-douce">Aucun paiement enregistré.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1">
              {order.payments.map((p, index) => (
                <li key={index} className="flex justify-between gap-3 tabular-nums">
                  <span>
                    {providerLabel(p.provider)} · {formatShortDay(p.createdAt)}
                  </span>
                  <span>
                    {formatFcfa(p.amountFcfa)} · {paymentStatusLabel[p.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="historique">
          <h2 id="historique" className="font-display text-[1.4rem]">
            Historique
          </h2>
          <ol className="mt-2 flex flex-col gap-1">
            {order.history.map((h, index) => (
              <li key={index}>
                <span className="tabular-nums text-encre-douce">
                  {formatShortDay(h.createdAt)} {formatTime(h.createdAt)}
                </span>{" "}
                — {statusHeadline[h.status]}
                {h.note ? ` · ${h.note}` : ""}
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </div>
  );
}
