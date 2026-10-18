import type { Metadata } from "next";
import Link from "next/link";
import { RecordPayment } from "@/components/admin/RecordPayment";
import { listOrderNotes } from "@/lib/admin/data";
import { hoursSince, humanDuration } from "@/lib/admin/tasks";
import { getAutomationSettings, listVerifiedToday, listWaveToVerify, serverNow } from "@/lib/admin/today";
import { telLink, whatsappLink, whatsappMessage } from "@/lib/admin/whatsapp";
import { requireAdmin } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { formatDay, formatTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";

export const metadata: Metadata = { title: "Paiements Wave à vérifier" };

/** File des paiements Wave : chaque paiement est constaté par Alima dans l'application Wave, jamais automatiquement. */
export default async function WaveQueue() {
  await requireAdmin();
  const [queue, settings, verified] = await Promise.all([listWaveToVerify(), getAutomationSettings(), listVerifiedToday()]);
  const notes = await listOrderNotes(queue.map((o) => o.id));
  const now = serverNow();
  const total = queue.reduce((s, o) => s + o.totalFcfa, 0);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">Paiements Wave à vérifier</h1>
        <p className="max-w-3xl text-encre-douce">
          Ouvrez l&apos;application Wave, retrouvez le montant, puis confirmez. Une commande n&apos;entre dans la production qu&apos;une fois payée. Le reçu PDF
          devient disponible pour la cliente dès la confirmation.
        </p>
        {queue.length > 0 && (
          <p className="font-bold">
            {queue.length} paiement{queue.length > 1 ? "s" : ""} · {formatFcfa(total)} attendus
          </p>
        )}
      </header>

      {queue.length === 0 ? (
        <p className="atelier-ticket flex flex-wrap items-center gap-3 p-5 text-[1.05rem]">
          <span className="ohm-tampon text-succes">À jour</span>
          Aucun paiement Wave n&apos;attend votre vérification.
        </p>
      ) : (
        <ol className="flex flex-col gap-5">
          {queue.map((o) => {
            const waited = hoursSince(o.createdAt, now);
            const late = waited >= settings.paymentAlertHours;
            return (
              <li key={o.id} id={o.reference} className={cn("atelier-ticket atelier-deploie grid gap-4 border-l-[6px] p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]", late ? "border-l-erreur" : "border-l-wave")}>
                <div className="flex flex-col gap-2">
                  <p className="flex flex-wrap items-baseline gap-x-3">
                    <Link href={`/admin/commandes/${o.id}`} className="font-display text-[1.4rem] underline decoration-caramel decoration-2 underline-offset-4">
                      {o.reference}
                    </Link>
                    <span className="font-display text-[1.4rem] tabular-nums">{formatFcfa(o.totalFcfa)}</span>
                  </p>
                  <p className="text-[1.05rem] font-bold">{o.customerName}</p>
                  <p className="text-encre-douce">
                    Commande du {formatDay(o.createdAt)} à {formatTime(o.createdAt)} ·{" "}
                    <span className={cn(late && "font-bold text-erreur")}>en attente depuis {humanDuration(now - Date.parse(o.createdAt))}</span>
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {/* Au-delà du délai d'alerte : relance pré-rédigée (relue et envoyée par Alima, jamais d'annulation automatique). */}
                    <a
                      href={whatsappLink(o.customerPhone, whatsappMessage(late ? "payment_reminder" : "payment_check", o))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "inline-flex min-h-11 items-center rounded-[10px] border-2 px-4 font-bold",
                        late ? "border-erreur bg-erreur text-creme" : "border-chocolat hover:bg-blanc-casse",
                      )}
                    >
                      {late ? "Relancer la cliente (WhatsApp)" : "Contacter la cliente (WhatsApp)"}
                    </a>
                    <a href={telLink(o.customerPhone)} className="inline-flex min-h-11 items-center rounded-[10px] px-3 font-bold underline decoration-caramel decoration-2 underline-offset-4">
                      Appeler {o.customerPhone}
                    </a>
                  </div>
                </div>
                <RecordPayment
                  orderId={o.id}
                  reference={o.reference}
                  amountFcfa={o.totalFcfa}
                  customerName={o.customerName}
                  notFoundAt={(() => {
                    const n = notes.get(o.id)?.find((x) => x.kind === "payment_not_found");
                    return n ? `${formatDay(n.createdAt)} à ${formatTime(n.createdAt)}` : null;
                  })()}
                />
              </li>
            );
          })}
        </ol>
      )}

      <section id="verifies" aria-labelledby="titre-verifies" className="flex scroll-mt-24 flex-col gap-3">
        <h2 id="titre-verifies" className="font-display text-[1.5rem]">
          Vérifiés aujourd&apos;hui
        </h2>
        {verified.length === 0 ? (
          <p className="text-encre-douce">Aucun paiement vérifié aujourd&apos;hui.</p>
        ) : (
          <ul className="flex flex-col divide-y-2 divide-dashed divide-chocolat/15 rounded-[12px] border-2 border-chocolat/15 bg-blanc-casse">
            {verified.map((v) => (
              <li key={`${v.orderId}-${v.verifiedAt}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <span className="ohm-tampon text-[0.8rem] text-succes">Vérifié</span>
                <Link href={`/admin/commandes/${v.orderId}`} className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
                  {v.reference}
                </Link>
                <span>{v.customerName}</span>
                <span className="font-bold tabular-nums">{formatFcfa(v.totalFcfa)}</span>
                <span className="text-encre-douce">
                  à {formatTime(v.verifiedAt)}
                  {v.verifiedBy ? ` par ${v.verifiedBy}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
