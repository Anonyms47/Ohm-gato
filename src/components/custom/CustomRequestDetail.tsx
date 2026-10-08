import Link from "next/link";
import { DeliveryFeeNotice } from "@/components/checkout/DeliveryFeeNotice";
import { MessageComposer, ProposalResponse, RequestEditor, type CustomAccessProp } from "@/components/custom/CustomRequestActions";
import { ButtonLink } from "@/components/ui/Button";
import { brand } from "@/config/brand";
import { cn } from "@/lib/cn";
import type { CustomRequestView } from "@/lib/custom/data";
import { customKindLabel, customRequestEditable, customRequestOpen, customStatusLabel } from "@/lib/custom/status";
import { formatDay, formatShortDay, formatTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { paymentStatusLabel, statusHeadline } from "@/lib/order-status";

/** Fil d'une demande sur-mesure, côté client (invité par lien personnel ou membre). */
export function CustomRequestDetail({
  request,
  access,
  justSent,
  limited = false,
}: {
  request: CustomRequestView;
  access: CustomAccessProp;
  justSent?: boolean;
  /** Lien ouvert ailleurs que sur le navigateur d'origine : échanges et coordonnées masqués. */
  limited?: boolean;
}) {
  const openProposal = request.proposals.find((p) => p.status === "sent");
  const dakarDate = request.eventAt.slice(0, 10);
  const dakarTime = request.eventAt.slice(11, 16);
  const thread = [
    ...request.messages.map((m) => ({ ...m, kind: "message" as const })),
  ];

  return (
    <div className="flex flex-col gap-8">
      {justSent && (
        <p role="status" className="rounded-[12px] border-2 border-succes bg-blanc-casse p-4 font-bold text-succes">
          Demande envoyée. OHMEGATO l&apos;étudie et vous répond ici avec une proposition. Gardez ce lien pour suivre votre demande.
        </p>
      )}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-script text-[1.3rem] text-caramel-encre">demande {request.reference}</p>
          <h1 className="font-display text-[clamp(1.9rem,5vw,2.8rem)] leading-[1.02]">{request.occasion}</h1>
          <p className="mt-1 text-[1.1rem]">
            {formatDay(request.eventAt)}, {formatTime(request.eventAt)} · {request.guests ?? "?"} personne{(request.guests ?? 0) > 1 ? "s" : ""}
          </p>
        </div>
        <p className={cn("ohm-tampon text-[1.1rem]", request.status === "declined" ? "text-erreur" : request.status === "paid" || request.status === "done" ? "text-succes" : "text-chocolat")}>
          {customStatusLabel[request.status]}
        </p>
      </header>

      {limited && (
        <p className="rounded-[12px] border-2 border-chocolat/30 bg-blanc-casse p-4">
          Pour protéger vos informations, les échanges, la proposition et l&apos;adresse ne s&apos;affichent que sur le navigateur qui a envoyé la
          demande.{" "}
          <a
            href={`/connexion?suite=${encodeURIComponent(`/compte/sur-mesure/${request.reference}`)}`}
            className="font-bold underline decoration-caramel decoration-2 underline-offset-4"
          >
            Se connecter avec le numéro de la demande
          </a>{" "}
          pour tout retrouver.
        </p>
      )}

      <p className="rounded-[10px] bg-creme p-3">
        Une demande n&apos;est pas une commande confirmée : elle le devient quand vous acceptez la proposition d&apos;OHMEGATO et que le paiement
        est confirmé.
      </p>

      {/* Proposition en attente */}
      {openProposal && !limited && (
        <section aria-labelledby="proposition" className="rounded-[14px] border-2 border-chocolat bg-blanc-casse p-5 shadow-[0_4px_0_var(--ohm-chocolat)]">
          <h2 id="proposition" className="font-display text-[1.7rem]">
            Proposition n°{openProposal.version}
          </h2>
          <p className="mt-2 whitespace-pre-line">{openProposal.body}</p>
          {openProposal.lines.length > 0 && (
            <ul className="mt-4 divide-y divide-dashed divide-chocolat/25">
              {openProposal.lines.map((line, index) => (
                <li key={index} className="flex justify-between gap-3 py-2 tabular-nums">
                  <span>
                    {line.quantity} × {line.label}
                    {line.detail ? <span className="text-encre-douce"> — {line.detail}</span> : null}
                  </span>
                  <span>{formatFcfa(line.quantity * line.unit_price_fcfa)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 flex justify-between border-t-2 border-chocolat pt-3 text-[1.2rem] font-bold tabular-nums">
            <span>Total proposé</span>
            <span>{formatFcfa(openProposal.totalFcfa)}</span>
          </p>
          {request.fulfillment === "delivery" && <DeliveryFeeNotice className="mt-3" />}
          {openProposal.validUntil && <p className="mt-2 text-encre-douce">Valable jusqu&apos;au {formatDay(openProposal.validUntil)}.</p>}
          <div className="mt-5">
            <ProposalResponse access={access} proposalId={openProposal.id} totalFcfa={openProposal.totalFcfa} />
          </div>
        </section>
      )}

      {/* Commande issue de la proposition acceptée */}
      {request.order && !limited && (
        <section aria-labelledby="paiement-sm" className="rounded-[14px] border-2 border-chocolat/30 bg-blanc-casse p-5">
          <h2 id="paiement-sm" className="font-display text-[1.6rem]">
            Commande {request.order.reference}
          </h2>
          <p className="mt-1">
            {statusHeadline[request.order.status]} · paiement {paymentStatusLabel[request.order.paymentStatus].toLowerCase()}
          </p>
          <ButtonLink href={request.order.trackingPath} className="mt-4">
            {request.order.paymentStatus === "paid" ? "Suivre ma commande" : "Payer ou suivre ma commande"}
          </ButtonLink>
        </section>
      )}

      <div className={cn("grid gap-8", !limited && "lg:grid-cols-[1fr_22rem]")}>
        {/* Échanges */}
        <section aria-labelledby="echanges" className={cn("min-w-0", limited && "hidden")}>
          <h2 id="echanges" className="font-display text-[1.6rem]">
            Nos échanges
          </h2>
          {thread.length === 0 ? (
            <p className="mt-3 text-encre-douce">Aucun message pour l&apos;instant. OHMEGATO vous écrit ici si une précision est nécessaire.</p>
          ) : (
            <ol className="mt-4 flex flex-col gap-3">
              {thread.map((message) => {
                const files = request.attachments.filter((a) => a.messageId === message.id);
                return (
                  <li
                    key={message.id}
                    className={cn(
                      "max-w-[85%] rounded-[12px] p-3",
                      message.fromStaff ? "self-start border-2 border-chocolat/20 bg-blanc-casse" : "self-end bg-chocolat text-creme",
                    )}
                  >
                    <p className="text-[0.85rem] font-bold opacity-80">
                      {message.fromStaff ? "OHMEGATO" : "Vous"} · {formatShortDay(message.createdAt)} {formatTime(message.createdAt)}
                    </p>
                    <p className="whitespace-pre-line break-words">{message.body}</p>
                    {files.map((f) =>
                      f.url ? (
                        <a key={f.id} href={f.url} className="mt-1 block font-bold underline underline-offset-4" target="_blank" rel="noreferrer">
                          📎 {f.name}
                        </a>
                      ) : null,
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          {customRequestOpen(request.status) ? (
            <div className="mt-6">
              <MessageComposer access={access} />
            </div>
          ) : (
            <p className="mt-6">
              Cette demande est close.{" "}
              <a href={brand.whatsappUrl} className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
                Écrire à OHMEGATO sur WhatsApp
              </a>
            </p>
          )}
        </section>

        {/* Récapitulatif */}
        <aside aria-labelledby="recap" className="flex flex-col gap-4">
          <h2 id="recap" className="font-display text-[1.4rem]">
            Votre demande
          </h2>
          <ul className="flex flex-col gap-2">
            {request.items.map((item) => (
              <li key={item.id} className="rounded-[10px] bg-blanc-casse p-3">
                <p className="font-bold">
                  {customKindLabel(item.kind)} × {item.quantity ?? "?"}
                </p>
                {item.format && <p>Format : {item.format}</p>}
                {item.flavors && <p>Parfums : {item.flavors}</p>}
                {item.description && item.description !== item.kind && <p className="text-encre-douce">{item.description}</p>}
              </li>
            ))}
          </ul>
          {(request.ambiance || request.personalization) && (
            <div>
              {request.ambiance && <p>Ambiance : {request.ambiance}</p>}
              {request.personalization && <p>Personnalisation : {request.personalization}</p>}
            </div>
          )}
          {request.budgetFcfa !== null && <p>Budget indicatif : {formatFcfa(request.budgetFcfa)}</p>}
          <p>
            {request.fulfillment === "pickup"
              ? `Retrait gratuit — ${brand.pickupAddress}`
              : limited
                ? "Livraison dans Dakar"
                : `Livraison — ${request.addressLine ?? ""}${request.district ? `, ${request.district}` : ""}`}
          </p>
          {!limited && request.attachments.filter((a) => !a.messageId).length > 0 && (
            <div>
              <p className="font-bold">Inspirations</p>
              <ul>
                {request.attachments
                  .filter((a) => !a.messageId)
                  .map((a) =>
                    a.url ? (
                      <li key={a.id}>
                        <a href={a.url} target="_blank" rel="noreferrer" className="underline decoration-caramel decoration-2 underline-offset-4">
                          {a.name}
                        </a>
                      </li>
                    ) : null,
                  )}
              </ul>
            </div>
          )}
          {!limited && customRequestEditable(request.status) && (
            <RequestEditor
              access={access}
              initial={{
                eventDate: dakarDate,
                eventTime: dakarTime,
                guests: request.guests,
                ambiance: request.ambiance ?? "",
                personalization: request.personalization ?? "",
                budgetFcfa: request.budgetFcfa,
                notes: request.notes ?? "",
              }}
            />
          )}
          <div>
            <p className="font-bold">Historique</p>
            <ol className="mt-1 flex flex-col gap-1 text-[0.95rem]">
              {request.events.map((event, index) => (
                <li key={index}>
                  <span className="tabular-nums text-encre-douce">{formatShortDay(event.createdAt)}</span> — {customStatusLabel[event.status]}
                  {event.note ? ` · ${event.note}` : ""}
                </li>
              ))}
            </ol>
          </div>
          {request.proposals.filter((p) => p.status !== "sent").length > 0 && (
            <div>
              <p className="font-bold">Propositions précédentes</p>
              <ul className="text-[0.95rem]">
                {request.proposals
                  .filter((p) => p.status !== "sent")
                  .map((p) => (
                    <li key={p.id}>
                      n°{p.version} — {formatFcfa(p.totalFcfa)} ·{" "}
                      {{ accepted: "acceptée", declined: "déclinée", superseded: "remplacée", withdrawn: "retirée", sent: "en attente" }[p.status]}
                    </li>
                  ))}
              </ul>
            </div>
          )}
          <Link href="/sur-mesure" className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
            Faire une autre demande
          </Link>
        </aside>
      </div>
    </div>
  );
}
