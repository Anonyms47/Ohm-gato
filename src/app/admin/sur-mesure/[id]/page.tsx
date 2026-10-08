import Link from "next/link";
import { notFound } from "next/navigation";
import { InternalNote, ProposalForm, RequestStatusActions, StaffMessageForm } from "@/components/admin/CustomAdmin";
import { DELIVERY_FEE_NOTICE } from "@/components/checkout/DeliveryFeeNotice";
import { brand } from "@/config/brand";
import { requireAdmin } from "@/lib/auth/session";
import { getCustomRequestForAdmin } from "@/lib/custom/data";
import { customKindLabel, customStatusLabel } from "@/lib/custom/status";
import { formatDay, formatShortDay, formatTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { paymentStatusLabel, statusHeadline } from "@/lib/order-status";
import { formatSenegalPhone } from "@/lib/phone";

export const metadata = { title: "Demande sur-mesure" };

export default async function AdminDemande({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const r = await getCustomRequestForAdmin(id);
  if (!r) notFound();
  const locked = ["awaiting_payment", "paid", "preparing", "done"].includes(r.status);
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p className="font-bold tabular-nums">{r.reference}</p>
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)] leading-tight">
          {r.occasion} · {customStatusLabel[r.status]}
        </h1>
        <p>
          {formatDay(r.eventAt)}, {formatTime(r.eventAt)} · {r.guests ?? "?"} personnes · envoyée le {formatShortDay(r.createdAt)}
        </p>
        <RequestStatusActions requestId={r.id} status={r.status} />
      </header>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[12px] bg-blanc-casse p-5">
          <h2 className="font-display text-[1.4rem]">Demande</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {r.items.map((i) => (
              <li key={i.id}>
                <strong>
                  {customKindLabel(i.kind)} × {i.quantity ?? "?"}
                </strong>
                {i.format ? ` · ${i.format}` : ""}
                {i.flavors ? ` · ${i.flavors}` : ""}
                {i.description && i.description !== i.kind ? <span className="block text-encre-douce">{i.description}</span> : null}
              </li>
            ))}
          </ul>
          {r.ambiance && <p className="mt-3">Ambiance : {r.ambiance}</p>}
          {r.personalization && <p>Personnalisation : {r.personalization}</p>}
          {r.budgetFcfa !== null && <p>Budget indicatif : {formatFcfa(r.budgetFcfa)}</p>}
          {r.notes && <p>Précisions : {r.notes}</p>}
          {r.attachments.filter((a) => !a.messageId).length > 0 && (
            <p className="mt-2">
              Inspirations :{" "}
              {r.attachments
                .filter((a) => !a.messageId && a.url)
                .map((a) => (
                  <a key={a.id} href={a.url!} target="_blank" rel="noreferrer" className="mr-2 font-bold underline underline-offset-4">
                    {a.name}
                  </a>
                ))}
            </p>
          )}
        </section>
        <section className="rounded-[12px] bg-blanc-casse p-5">
          <h2 className="font-display text-[1.4rem]">Client et réception</h2>
          <p className="mt-2">
            <Link href={`/admin/clients/${encodeURIComponent(r.customerPhone)}`} className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
              {r.customerName}
            </Link>{" "}
            · {formatSenegalPhone(r.customerPhone)} {r.customerEmail ? `· ${r.customerEmail}` : ""}
          </p>
          <a
            href={`https://wa.me/${r.customerPhone.replace(/^\+/, "")}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex min-h-11 items-center font-bold underline decoration-caramel decoration-2 underline-offset-4"
          >
            Écrire sur WhatsApp
          </a>
          <p className="mt-3">
            {r.fulfillment === "pickup"
              ? `Retrait gratuit — ${brand.pickupAddress}`
              : `Livraison — ${r.addressLine ?? ""}${r.district ? `, ${r.district}` : ""}${r.landmark ? ` · repère : ${r.landmark}` : ""}`}
          </p>
          {r.fulfillment === "delivery" && r.latitude !== null && r.longitude !== null && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center font-bold underline decoration-caramel decoration-2 underline-offset-4"
            >
              Voir la position
            </a>
          )}
          {r.fulfillment === "delivery" && <p className="text-[0.95rem] text-encre-douce">{DELIVERY_FEE_NOTICE}</p>}
          {r.order && (
            <p className="mt-3 rounded-[8px] bg-creme p-3">
              Commande {r.order.reference} : {statusHeadline[r.order.status]} · paiement {paymentStatusLabel[r.order.paymentStatus].toLowerCase()}
            </p>
          )}
        </section>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-[1.5rem]">Échanges</h2>
        <ol className="flex flex-col gap-3">
          {r.messages.map((m) => (
            <li key={m.id} className={m.fromStaff ? "self-end max-w-[85%] rounded-[12px] bg-chocolat p-3 text-creme" : "self-start max-w-[85%] rounded-[12px] border-2 border-chocolat/20 bg-blanc-casse p-3"}>
              <p className="text-[0.85rem] font-bold opacity-80">
                {m.fromStaff ? "OHMEGATO" : r.customerName} · {formatShortDay(m.createdAt)} {formatTime(m.createdAt)}
              </p>
              <p className="whitespace-pre-line break-words">{m.body}</p>
              {r.attachments
                .filter((a) => a.messageId === m.id && a.url)
                .map((a) => (
                  <a key={a.id} href={a.url!} target="_blank" rel="noreferrer" className="block font-bold underline underline-offset-4">
                    📎 {a.name}
                  </a>
                ))}
            </li>
          ))}
        </ol>
        <StaffMessageForm requestId={r.id} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-[1.5rem]">Propositions</h2>
        {r.proposals.map((p) => (
          <div key={p.id} className="rounded-[12px] bg-blanc-casse p-4">
            <p className="font-bold">
              n°{p.version} · {formatFcfa(p.totalFcfa)} · {{ sent: "en attente du client", accepted: "acceptée", declined: "déclinée", superseded: "remplacée", withdrawn: "retirée" }[p.status]}
            </p>
            <p className="whitespace-pre-line">{p.body}</p>
          </div>
        ))}
        <ProposalForm requestId={r.id} disabled={locked || r.status === "declined" || r.status === "done"} />
      </section>

      <section className="max-w-2xl">
        <InternalNote requestId={r.id} initial={r.internalNote ?? ""} />
      </section>

      <section>
        <h2 className="font-display text-[1.4rem]">Historique</h2>
        <ol className="mt-2">
          {r.events.map((e, i) => (
            <li key={i}>
              {formatShortDay(e.createdAt)} {formatTime(e.createdAt)} — {customStatusLabel[e.status]}
              {e.note ? ` · ${e.note}` : ""}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
