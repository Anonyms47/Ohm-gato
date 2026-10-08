import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminMap } from "@/components/admin/AdminMap";
import { OrderStatusActions } from "@/components/admin/OrderActions";
import { PositionLinks } from "@/components/admin/PositionLinks";
import { RecordPayment } from "@/components/admin/RecordPayment";
import { DELIVERY_FEE_NOTICE } from "@/components/checkout/DeliveryFeeNotice";
import { brand } from "@/config/brand";
import { getOrderDetail } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/session";
import { formatShortDay, formatSlot, formatTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { paymentStatusLabel, statusHeadline } from "@/lib/order-status";
import { generateTrackingToken } from "@/lib/orders/tracking";
import { providerLabel } from "@/lib/payments/labels";
import { formatSenegalPhone } from "@/lib/phone";

export const metadata = { title: "Commande" };

export default async function AdminCommande({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const order = await getOrderDetail(id);
  if (!order) notFound();
  const whatsapp = `https://wa.me/${order.customerPhone.replace(/^\+/, "")}?text=${encodeURIComponent(`Bonjour ${order.customerName}, c'est OHMEGATO au sujet de votre commande ${order.reference}.`)}`;
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-bold tabular-nums">{order.reference}</p>
          <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)] leading-tight">{statusHeadline[order.status]}</h1>
          <p className="text-encre-douce">
            {order.isCustom ? "Sur-mesure" : `Fournée n°${order.cycleNumber}`} · passée le {formatShortDay(order.createdAt)} {formatTime(order.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href={whatsapp} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-[10px] border-2 border-chocolat px-4 font-bold">
            Écrire au client sur WhatsApp
          </a>
          <Link href={`/admin/commandes/${order.id}/recu`} className="inline-flex min-h-11 items-center rounded-[10px] border-2 border-chocolat px-4 font-bold">
            Reçu
          </Link>
          <Link href={`/suivi/${generateTrackingToken(order.idempotencyKey).token}`} className="inline-flex min-h-11 items-center font-bold underline decoration-caramel decoration-2 underline-offset-4">
            Page de suivi client
          </Link>
        </div>
      </header>

      {order.paymentStatus === "pending" && !["pending_payment", "cancelled", "expired", "refunded"].includes(order.status) && (
        <RecordPayment orderId={order.id} reference={order.reference} amountFcfa={order.totalFcfa} />
      )}

      <section aria-labelledby="statut" className="rounded-[12px] border-2 border-chocolat bg-blanc-casse p-5">
        <h2 id="statut" className="mb-3 font-display text-[1.4rem]">
          Mettre à jour le statut
        </h2>
        <OrderStatusActions orderId={order.id} status={order.status} fulfillment={order.fulfillment} paymentStatus={order.paymentStatus} />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="produits" className="rounded-[12px] bg-blanc-casse p-5">
          <h2 id="produits" className="font-display text-[1.4rem]">
            Produits
          </h2>
          <ul className="mt-3 divide-y divide-dashed divide-chocolat/25">
            {order.items.map((i, index) => (
              <li key={index} className="flex justify-between gap-3 py-2 tabular-nums">
                <span>
                  {i.quantity} × {i.productName} — {i.variantLabel}
                  {i.flavorName ? `, ${i.flavorName}` : ""}
                  <span className="block text-[0.9rem] text-encre-douce">{i.quantity * i.unitsPerItem} unités</span>
                </span>
                <span>{formatFcfa(i.lineTotalFcfa)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex justify-between border-t-2 border-chocolat pt-2 font-bold tabular-nums">
            <span>Total produits</span>
            <span>{formatFcfa(order.totalFcfa)}</span>
          </p>
          {order.fulfillment === "delivery" && <p className="mt-2 text-[0.95rem]">{DELIVERY_FEE_NOTICE}</p>}
          {order.notes && <p className="mt-3 rounded-[8px] bg-creme p-3">Note du client : {order.notes}</p>}
        </section>

        <section aria-labelledby="client" className="rounded-[12px] bg-blanc-casse p-5">
          <h2 id="client" className="font-display text-[1.4rem]">
            Client et réception
          </h2>
          <p className="mt-2">
            <Link href={`/admin/clients/${encodeURIComponent(order.customerPhone)}`} className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
              {order.customerName}
            </Link>{" "}
            · {formatSenegalPhone(order.customerPhone)}
            {order.customerEmail ? ` · ${order.customerEmail}` : ""}
          </p>
          <p className="mt-3 font-bold">{order.fulfillment === "pickup" ? `Retrait gratuit — ${brand.pickupAddress}` : "Livraison"}</p>
          {order.slot && <p>{formatSlot(order.slot.startsAt, order.slot.endsAt)}</p>}
          {order.pickupCode && <p>Code de retrait : <strong className="tracking-[0.2em]">{order.pickupCode}</strong></p>}
          {order.fulfillment === "delivery" && (
            <dl className="mt-3 grid gap-2">
              <div>
                <dt className="font-bold">Adresse</dt>
                <dd>
                  {order.addressLine}
                  {order.floorDoor ? ` (${order.floorDoor})` : ""}
                  {order.district ? `, ${order.district}` : ""}
                </dd>
              </div>
              <div>
                <dt className="font-bold">Point de repère</dt>
                <dd>{order.landmark ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-bold">Destinataire</dt>
                <dd>
                  {order.recipientName} · {order.recipientPhone ? formatSenegalPhone(order.recipientPhone) : "—"}
                </dd>
              </div>
              {order.instructions && (
                <div>
                  <dt className="font-bold">Instructions</dt>
                  <dd>{order.instructions}</dd>
                </div>
              )}
              {order.courierName && (
                <div>
                  <dt className="font-bold">Livreur</dt>
                  <dd>
                    {order.courierName}
                    {order.courierPhone ? ` · ${formatSenegalPhone(order.courierPhone)}` : ""}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </section>
      </div>

      {order.fulfillment === "delivery" && order.latitude !== null && order.longitude !== null && (
        <section aria-labelledby="position" className="flex flex-col gap-3">
          <h2 id="position" className="font-display text-[1.4rem]">
            Position exacte
          </h2>
          <AdminMap stops={[{ id: order.id, label: order.reference, latitude: order.latitude, longitude: order.longitude, tone: "todo" }]} selectedId={order.id} label={`Position de livraison de ${order.reference}`} />
          <PositionLinks
            reference={order.reference}
            latitude={order.latitude}
            longitude={order.longitude}
            address={[order.addressLine, order.district].filter(Boolean).join(", ")}
            landmark={order.landmark}
            recipient={`${order.recipientName ?? order.customerName} ${order.recipientPhone ? formatSenegalPhone(order.recipientPhone) : ""}`}
          />
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="paiements" className="rounded-[12px] bg-blanc-casse p-5">
          <h2 id="paiements" className="font-display text-[1.4rem]">
            Paiement · {paymentStatusLabel[order.paymentStatus]}
          </h2>
          {order.payments.length === 0 ? (
            <p className="mt-2 text-encre-douce">Aucune tentative de paiement.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1">
              {order.payments.map((p) => (
                <li key={p.id} className="tabular-nums">
                  {providerLabel(p.provider)} · {formatFcfa(p.amountFcfa)} · {paymentStatusLabel[p.status]} · {formatShortDay(p.createdAt)} {formatTime(p.createdAt)}
                  {p.providerReference ? ` · réf. ${p.providerReference}` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="historique" className="rounded-[12px] bg-blanc-casse p-5">
          <h2 id="historique" className="font-display text-[1.4rem]">
            Historique des modifications
          </h2>
          <ol className="mt-2 flex flex-col gap-1">
            {order.history.map((h, index) => (
              <li key={index}>
                <span className="tabular-nums text-encre-douce">
                  {formatShortDay(h.createdAt)} {formatTime(h.createdAt)}
                </span>{" "}
                — {statusHeadline[h.status]}
                {h.note ? ` · ${h.note}` : ""}
                {h.actor ? ` · par ${h.actor}` : ""}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
