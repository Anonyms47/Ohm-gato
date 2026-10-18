import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminMap } from "@/components/admin/AdminMap";
import { RefundForm } from "@/components/admin/LegalEditors";
import { OrderStatusActions } from "@/components/admin/OrderActions";
import { OrderLifeline } from "@/components/admin/OrderLifeline";
import { OrderNoteForm } from "@/components/admin/OrderNotes";
import { PositionLinks } from "@/components/admin/PositionLinks";
import { RecordPayment } from "@/components/admin/RecordPayment";
import { DELIVERY_FEE_NOTICE } from "@/components/checkout/DeliveryFeeNotice";
import { brand } from "@/config/brand";
import { getOrderDetail, listOrderNotes } from "@/lib/admin/data";
import { orderAcceptance, orderRefunds } from "@/lib/admin/legal";
import { nextActionLabel, stageLabel } from "@/lib/admin/order-stage";
import { telLink, whatsappLink, whatsappMessage, type WhatsappTemplate } from "@/lib/admin/whatsapp";
import { requireAdmin } from "@/lib/auth/session";
import { formatShortDay, formatSlot, formatTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { paymentStatusLabel, statusHeadline } from "@/lib/order-status";
import { generateTrackingToken } from "@/lib/orders/tracking";
import { providerLabel } from "@/lib/payments/labels";
import { formatSenegalPhone } from "@/lib/phone";

export const metadata = { title: "Commande" };

const card = "rounded-[12px] border-2 border-chocolat/10 bg-blanc-casse p-5";
const h2 = "font-display text-[1.4rem]";
const summary = "flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-display text-[1.25rem] after:content-['+'] after:font-sans after:text-[1.4rem] group-open:after:content-['−']";
const linkButton = "inline-flex min-h-11 items-center rounded-[10px] border-2 border-chocolat px-4 font-bold hover:bg-creme";

export default async function AdminCommande({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const order = await getOrderDetail(id);
  if (!order) notFound();
  const [acceptance, refunds, notesMap] = await Promise.all([orderAcceptance(order.id), orderRefunds(order.id), listOrderNotes([order.id])]);
  const notes = notesMap.get(order.id) ?? [];
  const lastNotFound = notes.find((n) => n.kind === "payment_not_found");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dakar" }).format(new Date());
  const waveToVerify = order.paymentStatus === "pending" && !["pending_payment", "cancelled", "expired", "refunded"].includes(order.status);
  const next = nextActionLabel(order.status, order.paymentStatus, order.fulfillment);
  const missingLandmark = order.fulfillment === "delivery" && !order.landmark && order.latitude === null;

  // Message WhatsApp le plus utile à cette étape (relu et envoyé par Alima).
  const template: WhatsappTemplate = waveToVerify
    ? "payment_check"
    : missingLandmark && !["delivered", "cancelled", "expired", "refunded"].includes(order.status)
      ? "landmark"
      : order.status === "ready" && order.fulfillment === "pickup"
        ? "ready_pickup"
        : order.status === "out_for_delivery"
          ? "out_for_delivery"
          : order.status === "confirmed" && order.paymentStatus === "paid"
            ? "payment_received"
            : "general";
  const message = whatsappMessage(template, { ...order, pickupAddress: brand.pickupAddress });
  const templateLabel: Record<WhatsappTemplate, string> = {
    payment_check: "Demander la preuve de paiement",
    payment_reminder: "Relancer le paiement Wave",
    payment_received: "Confirmer la réception du paiement",
    ready_pickup: "Prévenir : commande prête",
    out_for_delivery: "Prévenir : en route",
    landmark: "Demander un point de repère",
    general: "Écrire à la cliente",
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      {/* Barre collante : étape, prochaine action, contact. Ne masque rien (elle prend sa place dans le flux). */}
      <div className="sticky top-[3.6rem] z-20 -mx-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-chocolat/10 bg-creme/95 px-4 py-2 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:px-10">
        <p className="font-bold tabular-nums">{order.reference}</p>
        <p className="rounded-full bg-rose/60 px-3 py-0.5 text-[0.92rem] font-bold">{stageLabel(order.status, order.paymentStatus, order.fulfillment)}</p>
        <div className="ml-auto flex flex-wrap gap-2">
          {next && (
            <a href={waveToVerify ? "#paiement" : "#etat"} className="inline-flex min-h-11 items-center rounded-[10px] bg-chocolat px-4 font-bold text-creme">
              {next}
            </a>
          )}
          <a href={whatsappLink(order.customerPhone, message)} target="_blank" rel="noopener noreferrer" className={linkButton}>
            WhatsApp
          </a>
        </div>
      </div>

      <header className="flex flex-col gap-1">
        <p className="text-encre-douce">
          {order.isCustom ? "Sur mesure" : `Fournée n°${order.cycleNumber}`} · reçue le {formatShortDay(order.createdAt)} à {formatTime(order.createdAt)}
        </p>
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)] leading-tight">
          {order.customerName} · {formatFcfa(order.totalFcfa)}
        </h1>
      </header>

      {/* 1. État et prochaine action */}
      <section id="etat" aria-labelledby="titre-etat" className={`${card} flex scroll-mt-32 flex-col gap-4 border-chocolat`}>
        <h2 id="titre-etat" className={h2}>
          État et prochaine action
        </h2>
        <OrderLifeline status={order.status} paymentStatus={order.paymentStatus} fulfillment={order.fulfillment} />
        {next && <p className="font-bold text-caramel-encre">Prochaine action : {next}</p>}
        <OrderStatusActions orderId={order.id} status={order.status} fulfillment={order.fulfillment} paymentStatus={order.paymentStatus} />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* 2. Produits */}
        <section aria-labelledby="produits" className={card}>
          <h2 id="produits" className={h2}>
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
          {order.notes && <p className="mt-3 rounded-[8px] bg-creme p-3">Note de la cliente : {order.notes}</p>}
        </section>

        {/* 3. Paiement */}
        <section id="paiement" aria-labelledby="paiements" className={`${card} flex scroll-mt-32 flex-col gap-3`}>
          <h2 id="paiements" className={h2}>
            Paiement · {paymentStatusLabel[order.paymentStatus]}
          </h2>
          {order.paymentStatus === "paid" && (
            <p className="flex flex-wrap items-center gap-3">
              <span className="ohm-tampon text-succes">Paiement vérifié</span>
              {order.paidAt && (
                <span className="text-encre-douce">
                  le {formatShortDay(order.paidAt)} à {formatTime(order.paidAt)}
                </span>
              )}
            </p>
          )}
          {waveToVerify && (
            <RecordPayment
              orderId={order.id}
              reference={order.reference}
              amountFcfa={order.totalFcfa}
              customerName={order.customerName}
              notFoundAt={lastNotFound ? `${formatShortDay(lastNotFound.createdAt)} à ${formatTime(lastNotFound.createdAt)}` : null}
            />
          )}
          {order.payments.length === 0 ? (
            <p className="text-encre-douce">Aucune tentative de paiement.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {order.payments.map((p) => (
                <li key={p.id} className="tabular-nums">
                  {providerLabel(p.provider)} · {formatFcfa(p.amountFcfa)} · {paymentStatusLabel[p.status]} · {formatShortDay(p.createdAt)} {formatTime(p.createdAt)}
                  {p.providerReference ? ` · réf. ${p.providerReference}` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 4. Client */}
        <section aria-labelledby="client" className={card}>
          <h2 id="client" className={h2}>
            Cliente
          </h2>
          <p className="mt-2">
            <Link href={`/admin/clients/${encodeURIComponent(order.customerPhone)}`} className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
              {order.customerName}
            </Link>
          </p>
          <p>{formatSenegalPhone(order.customerPhone)}</p>
          {order.customerEmail ? (
            <p className="break-words">{order.customerEmail}</p>
          ) : (
            <p className="text-encre-douce" data-testid="sans-email">
              Aucun e-mail fourni : pas d&apos;e-mail automatique. La cliente garde son lien personnel de suivi ; contactez-la par téléphone ou WhatsApp.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={telLink(order.customerPhone)} className={linkButton}>
              Appeler
            </a>
            <a href={whatsappLink(order.customerPhone, message)} target="_blank" rel="noopener noreferrer" className={linkButton}>
              {templateLabel[template]}
            </a>
          </div>
          <p className="mt-2 text-[0.9rem] text-encre-douce">Le message s&apos;ouvre dans WhatsApp : relisez-le, puis appuyez sur Envoyer. Rien n&apos;est envoyé automatiquement.</p>
        </section>

        {/* 5. Livraison ou retrait */}
        <section aria-labelledby="reception" className={card}>
          <h2 id="reception" className={h2}>
            {order.fulfillment === "pickup" ? "Retrait" : "Livraison"}
          </h2>
          <p className="mt-2 font-bold">{order.fulfillment === "pickup" ? `Retrait gratuit — ${brand.pickupAddress}` : "Livraison dans Dakar"}</p>
          {order.slot ? <p>{formatSlot(order.slot.startsAt, order.slot.endsAt)}</p> : <p className="font-bold text-erreur">Aucun créneau choisi.</p>}
          {order.pickupCode && (
            <p>
              Code de retrait : <strong className="tracking-[0.2em]">{order.pickupCode}</strong>
            </p>
          )}
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
                <dd className={missingLandmark ? "font-bold text-erreur" : undefined}>{order.landmark ?? (missingLandmark ? "Non précisé — à demander à la cliente" : "—")}</dd>
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
          <h2 id="position" className={h2}>
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
        {/* 6. Historique */}
        <section aria-labelledby="historique" className={card}>
          <h2 id="historique" className={h2}>
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
                {h.actor ? ` · par ${h.actor}` : ""}
              </li>
            ))}
          </ol>
        </section>

        {/* 7. Reçu */}
        <details className={`${card} group`}>
          <summary className={summary}>Reçu</summary>
          {order.paymentStatus === "paid" ? (
            <p className="mt-2 text-encre-douce">Disponible pour la cliente depuis la vérification du paiement.</p>
          ) : (
            <p className="mt-2 text-encre-douce">Le reçu payé n&apos;existe qu&apos;une fois le paiement vérifié.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/admin/commandes/${order.id}/recu`} className={linkButton}>
              Reçu imprimable
            </Link>
            {order.paymentStatus === "paid" && (
              <a href={`/admin/commandes/${order.id}/recu/pdf`} download className={linkButton}>
                Reçu PDF
              </a>
            )}
            <Link href={`/suivi/${generateTrackingToken(order.idempotencyKey).token}`} className="inline-flex min-h-11 items-center font-bold underline decoration-caramel decoration-2 underline-offset-4">
              Page de suivi client
            </Link>
          </div>
        </details>

        {/* 8. Notes internes */}
        <details className={`${card} group flex flex-col gap-3`}>
          <summary className={summary}>{`Notes internes${notes.length ? ` (${notes.length})` : ""}`}</summary>
          {notes.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {notes.map((n) => (
                <li key={n.id} className="rounded-[8px] bg-creme p-3">
                  <p>{n.body}</p>
                  <p className="text-[0.9rem] text-encre-douce">
                    {formatShortDay(n.createdAt)} {formatTime(n.createdAt)}
                    {n.author ? ` · ${n.author}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-encre-douce">Aucune note pour cette commande.</p>
          )}
          <OrderNoteForm orderId={order.id} />
        </details>

        {/* 9. Remboursement */}
        <details className={`${card} group flex flex-col gap-3`}>
          <summary className={summary}>{`Remboursements${refunds.length ? ` (${refunds.length})` : ""}`}</summary>
          {refunds.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {refunds.map((r) => (
                <li key={r.id}>
                  <span className="tabular-nums">{formatFcfa(r.amountFcfa)}</span> · {r.method} · {formatShortDay(r.refundedAt)} · {r.reason}
                  {r.recordedBy ? ` · par ${r.recordedBy}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-encre-douce">Aucun remboursement enregistré.</p>
          )}
          {order.paymentStatus === "paid" || order.paymentStatus === "refunded" ? (
            <details>
              <summary className="min-h-11 cursor-pointer font-bold underline decoration-caramel decoration-2 underline-offset-4">Enregistrer un remboursement</summary>
              <div className="mt-3">
                <RefundForm orderId={order.id} today={today} />
              </div>
            </details>
          ) : (
            <p className="text-encre-douce">Un remboursement s&apos;enregistre une fois le paiement reçu.</p>
          )}
        </details>
      </div>

      <details className={`${card} group`} data-testid="acceptation-commande">
          <summary className={summary}>Conditions acceptées</summary>
        {acceptance ? (
          <p className="mt-2">
            {acceptance.terms ? `Conditions générales v${acceptance.terms.version}` : "Conditions générales"} ·{" "}
            {acceptance.cancellation ? `Annulation et remboursement v${acceptance.cancellation.version}` : "Annulation et remboursement"} · le{" "}
            {formatShortDay(acceptance.acceptedAt)} {formatTime(acceptance.acceptedAt)} · site web
          </p>
        ) : (
          <p className="mt-2 text-encre-douce">Aucune acceptation enregistrée (commande antérieure aux conditions versionnées ou sur mesure).</p>
        )}
      </details>
    </div>
  );
}
