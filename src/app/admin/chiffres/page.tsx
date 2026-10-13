import type { Metadata } from "next";
import Link from "next/link";
import { PERIODS, monthLabel, parsePeriod } from "@/lib/admin/sales-summary";
import { getSalesOverview } from "@/lib/admin/sales-summary-data";
import { serverNow } from "@/lib/admin/today";
import { requireAdmin } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { formatFcfa } from "@/lib/money";

export const metadata: Metadata = { title: "Chiffres" };

const link = "font-bold underline decoration-caramel decoration-2 underline-offset-4";

function Breakdown({ title, rows }: { title: string; rows: { label: string; orders: number; fcfa: number; href?: string }[] }) {
  if (rows.length === 0) return null;
  return (
    <section aria-label={title} className="atelier-ticket flex flex-col gap-3 p-4 sm:p-5">
      <h2 className="font-display text-[1.3rem]">{title}</h2>
      <table className="w-full text-left">
        <thead className="sr-only">
          <tr>
            <th scope="col">{title}</th>
            <th scope="col">Commandes</th>
            <th scope="col">Montant</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-chocolat/10 first:border-t-0">
              <th scope="row" className="py-2 pr-3 font-normal">
                {r.href ? (
                  <Link href={r.href} className={link}>
                    {r.label}
                  </Link>
                ) : (
                  r.label
                )}
              </th>
              <td className="py-2 pr-3 text-right tabular-nums text-encre-douce">
                {r.orders} cde{r.orders > 1 ? "s" : ""}
              </td>
              <td className="py-2 text-right font-bold tabular-nums">{formatFcfa(r.fcfa)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Résumé chiffré de l'atelier : uniquement des paiements réels, remboursements déduits. */
export default async function Chiffres({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  await requireAdmin();
  const period = parsePeriod((await searchParams).periode);
  const s = await getSalesOverview(period, new Date(serverNow()));
  const periodLabel = PERIODS.find((p) => p.key === period)!.label;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">Chiffres</h1>
        <p className="max-w-3xl text-encre-douce">
          Seules les commandes réellement payées comptent, à la date du paiement. Les remboursements enregistrés sont déduits. Les frais de livraison, réglés
          directement au livreur, n&apos;y figurent pas.
        </p>
      </header>

      <nav aria-label="Période" className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`/admin/chiffres?periode=${p.key}`}
            aria-current={p.key === period ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border-2 px-4 font-bold",
              p.key === period ? "border-chocolat bg-chocolat text-creme" : "border-chocolat/30 bg-blanc-casse",
            )}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      <section aria-label={`Résumé : ${periodLabel}`} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="atelier-ticket flex flex-col gap-1 p-4 sm:col-span-2">
          <p className="text-[0.82rem] font-bold uppercase tracking-[0.1em] text-encre-douce">Net encaissé · {periodLabel}</p>
          <p className="font-display text-[clamp(2rem,6vw,2.8rem)] tabular-nums" data-testid="chiffres-net">
            {formatFcfa(s.netFcfa)}
          </p>
          <p className="text-encre-douce">
            {formatFcfa(s.paidFcfa)} payés
            {s.refundedFcfa > 0 ? ` − ${formatFcfa(s.refundedFcfa)} remboursés` : ""}
          </p>
        </div>
        <div className="atelier-ticket flex flex-col gap-1 p-4">
          <p className="text-[0.82rem] font-bold uppercase tracking-[0.1em] text-encre-douce">Commandes payées</p>
          <p className="font-display text-[2rem] tabular-nums">{s.paidOrders}</p>
        </div>
        <div className="atelier-ticket flex flex-col gap-1 p-4">
          <p className="text-[0.82rem] font-bold uppercase tracking-[0.1em] text-encre-douce">Panier moyen</p>
          <p className="font-display text-[2rem] tabular-nums">{s.paidOrders ? formatFcfa(s.averageFcfa) : "—"}</p>
        </div>
      </section>

      {s.waveToVerify.orders > 0 && (
        <p className="atelier-ticket border-l-[6px] border-l-wave p-4">
          En plus : {s.waveToVerify.orders} paiement
          {s.waveToVerify.orders > 1 ? "s" : ""} Wave à vérifier, soit {formatFcfa(s.waveToVerify.fcfa)} pas encore comptés.{" "}
          <Link href="/admin/paiements" className={link}>
            Les vérifier
          </Link>
        </p>
      )}

      {s.paidOrders === 0 ? (
        <p className="atelier-ticket p-5">Aucune commande payée sur cette période.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Breakdown title="Par moyen de paiement" rows={s.byProvider} />
          <Breakdown title="Par mode de remise" rows={s.byFulfillment} />
          <Breakdown
            title="Par fournée"
            rows={s.byCycle.map((c) => ({
              label: `Fournée n°${c.number}`,
              orders: c.orders,
              fcfa: c.fcfa,
            }))}
          />
          {s.byMonth.length > 1 && (
            <Breakdown
              title="Par mois"
              rows={s.byMonth.map((m) => ({
                label: monthLabel(m.month),
                orders: m.orders,
                fcfa: m.fcfa,
              }))}
            />
          )}
          <section aria-label="Par produit" className="atelier-ticket flex flex-col gap-3 p-4 sm:p-5 md:col-span-2">
            <h2 className="font-display text-[1.3rem]">Par produit</h2>
            <table className="w-full text-left">
              <thead>
                <tr className="text-[0.82rem] uppercase tracking-[0.1em] text-encre-douce">
                  <th scope="col" className="pb-2 font-bold">
                    Produit
                  </th>
                  <th scope="col" className="pb-2 text-right font-bold">
                    Pièces
                  </th>
                  <th scope="col" className="pb-2 text-right font-bold">
                    Montant
                  </th>
                </tr>
              </thead>
              <tbody>
                {s.products.map((p) => (
                  <tr key={p.name} className="border-t border-chocolat/10">
                    <th scope="row" className="py-2 pr-3 font-normal">
                      {p.name}
                    </th>
                    <td className="py-2 pr-3 text-right tabular-nums">{p.units}</td>
                    <td className="py-2 text-right font-bold tabular-nums">{formatFcfa(p.fcfa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  );
}
