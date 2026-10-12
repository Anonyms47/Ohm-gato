"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { bulkSetStatus, type BulkResult } from "@/app/admin/_actions/orders";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BULK_ACTIONS, bulkEligible, lifeline, nextActionLabel, stageLabel, type BulkTarget } from "@/lib/admin/order-stage";
import { cn } from "@/lib/cn";
import { formatShortDay, formatTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import type { Fulfillment, OrderStatus, PaymentStatus } from "@/lib/order-status";

export interface BoardOrder {
  id: string;
  reference: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillment: Fulfillment;
  customerName: string;
  customerPhone: string;
  totalFcfa: number;
  createdAt: string;
  slotStartsAt: string | null;
  district: string | null;
  isCustom: boolean;
}

export interface BoardGroup {
  key: string;
  label: string;
  hint?: string;
  orders: BoardOrder[];
}

const paymentText: Record<PaymentStatus, string> = {
  pending: "Paiement à vérifier",
  paid: "Payée",
  failed: "Paiement échoué",
  cancelled: "Paiement annulé",
  expired: "Paiement expiré",
  refunded: "Remboursée",
};

function MiniLifeline({ o }: { o: BoardOrder }) {
  const steps = lifeline(o.status, o.paymentStatus, o.fulfillment);
  const current = steps.find((s) => s.state === "current");
  return (
    <span className="flex items-center gap-1" aria-label={`Parcours : ${current?.label ?? stageLabel(o.status, o.paymentStatus, o.fulfillment)}`} role="img">
      {steps.map((s) => (
        <span
          key={s.key}
          className={cn(
            "h-1.5 w-4 rounded-full",
            s.state === "done" && "bg-chocolat",
            s.state === "current" && "bg-caramel",
            s.state === "todo" && "bg-chocolat/15",
            s.state === "skipped" && "bg-erreur/25",
          )}
        />
      ))}
    </span>
  );
}

function OrderCard({ o, selected, onToggle }: { o: BoardOrder; selected: boolean; onToggle: () => void }) {
  const next = nextActionLabel(o.status, o.paymentStatus, o.fulfillment);
  return (
    <li className={cn("atelier-ticket flex gap-3 p-3 sm:p-4", selected && "outline outline-[3px] outline-caramel")}>
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        aria-label={`Sélectionner ${o.reference}`}
        className="mt-1 size-5 shrink-0 accent-chocolat"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <Link href={`/admin/commandes/${o.id}`} className="font-display text-[1.2rem] underline decoration-caramel decoration-2 underline-offset-4">
            {o.reference}
          </Link>
          <span className="font-bold tabular-nums">{formatFcfa(o.totalFcfa)}</span>
        </div>
        <p className="font-bold">{o.customerName}</p>
        <p className="text-[0.95rem] text-encre-douce">
          {o.fulfillment === "delivery" ? `Livraison${o.district ? ` · ${o.district}` : ""}` : "Retrait"}
          {o.slotStartsAt ? ` · ${formatShortDay(o.slotStartsAt)} ${formatTime(o.slotStartsAt)}` : ""}
          {o.isCustom ? " · sur mesure" : ""}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <MiniLifeline o={o} />
          <span className="text-[0.92rem] font-bold">{stageLabel(o.status, o.paymentStatus, o.fulfillment)}</span>
          {o.paymentStatus !== "pending" && <span className={cn("text-[0.92rem]", o.paymentStatus === "paid" ? "text-succes" : "text-encre-douce")}>{paymentText[o.paymentStatus]}</span>}
        </div>
        {next && <p className="text-[0.92rem] text-caramel-encre">Prochaine action : {next}</p>}
      </div>
    </li>
  );
}

function OrderTable({ orders, selected, toggle }: { orders: BoardOrder[]; selected: Set<string>; toggle: (id: string) => void }) {
  return (
    <div className="hidden overflow-hidden rounded-[12px] border-2 border-chocolat/15 bg-blanc-casse lg:block">
      <table className="w-full text-left">
        <caption className="sr-only">Liste des commandes</caption>
        <thead>
          <tr className="border-b-2 border-chocolat/20 text-[0.9rem] uppercase tracking-[0.06em] text-encre-douce">
            <th className="w-10 p-3">
              <span className="sr-only">Sélection</span>
            </th>
            <th className="p-3">Commande</th>
            <th className="p-3">Client</th>
            <th className="p-3">Réception</th>
            <th className="p-3">Étape</th>
            <th className="p-3 text-right">Montant</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className={cn("border-b border-dashed border-chocolat/15 align-top", selected.has(o.id) && "bg-rose/25")}>
              <td className="p-3">
                <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} aria-label={`Sélectionner ${o.reference}`} className="size-5 accent-chocolat" />
              </td>
              <td className="p-3">
                <Link href={`/admin/commandes/${o.id}`} className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
                  {o.reference}
                </Link>
                <span className="block text-[0.9rem] text-encre-douce">
                  {formatShortDay(o.createdAt)} {formatTime(o.createdAt)}
                </span>
              </td>
              <td className="p-3">
                {o.customerName}
                <span className="block text-[0.9rem] text-encre-douce">{o.customerPhone}</span>
              </td>
              <td className="p-3">
                {o.fulfillment === "delivery" ? `Livraison${o.district ? ` · ${o.district}` : ""}` : "Retrait"}
                {o.slotStartsAt && (
                  <span className="block text-[0.9rem] text-encre-douce">
                    {formatShortDay(o.slotStartsAt)} {formatTime(o.slotStartsAt)}
                  </span>
                )}
              </td>
              <td className="p-3">
                <span className="font-bold">{stageLabel(o.status, o.paymentStatus, o.fulfillment)}</span>
                <span className="mt-1 block">
                  <MiniLifeline o={o} />
                </span>
              </td>
              <td className="p-3 text-right tabular-nums">{formatFcfa(o.totalFcfa)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Commandes groupées avec sélection et actions groupées confirmées.
 * « dense » : tableau sur ordinateur, cartes sur téléphone ; sinon cartes partout.
 */
export function OrderBoard({ groups, dense = false }: { groups: BoardGroup[]; dense?: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<BulkResult | null>(null);
  const all = useMemo(() => groups.flatMap((g) => g.orders), [groups]);
  const chosen = all.filter((o) => selected.has(o.id));

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const run = async (target: BulkTarget) => {
    const eligible = chosen.filter((o) => bulkEligible(target, o)).map((o) => o.id);
    const res = await bulkSetStatus(eligible, target);
    setResult(res);
    if (res.ok) {
      setSelected(new Set());
      router.refresh();
    }
    return { ok: res.ok, message: res.message };
  };

  return (
    <div className="flex flex-col gap-8">
      {result && (
        <div role={result.ok ? "status" : "alert"} className={cn("atelier-deploie rounded-[12px] border-2 p-4", result.ok ? "border-succes bg-blanc-casse" : "border-erreur bg-blanc-casse")}>
          <p className={cn("font-bold", result.ok ? "text-succes" : "text-erreur")}>{result.message}</p>
          {result.skipped.length > 0 && (
            <ul className="mt-1 text-[0.95rem] text-encre-douce">
              {result.skipped.map((s) => (
                <li key={s.reference}>
                  {s.reference} : {s.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {groups.map((group) => (
        <section key={group.key} id={group.key} aria-labelledby={`titre-${group.key}`} className="flex scroll-mt-24 flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id={`titre-${group.key}`} className="font-display text-[1.45rem]">
              {group.label} <span className="text-encre-douce tabular-nums">({group.orders.length})</span>
            </h2>
            {group.orders.length > 1 && (
              <button
                type="button"
                className="min-h-11 font-bold underline decoration-caramel decoration-2 underline-offset-4"
                onClick={() =>
                  setSelected((current) => {
                    const next = new Set(current);
                    const allIn = group.orders.every((o) => next.has(o.id));
                    for (const o of group.orders) {
                      if (allIn) next.delete(o.id);
                      else next.add(o.id);
                    }
                    return next;
                  })
                }
              >
                {group.orders.every((o) => selected.has(o.id)) ? "Tout désélectionner" : "Tout sélectionner"}
              </button>
            )}
          </div>
          {group.hint && <p className="-mt-2 text-encre-douce">{group.hint}</p>}
          {group.orders.length === 0 ? (
            <p className="text-encre-douce">Aucune commande ici.</p>
          ) : (
            <>
              {dense && <OrderTable orders={group.orders} selected={selected} toggle={toggle} />}
              <ul className={cn("grid gap-4 md:grid-cols-2", dense && "lg:hidden")}>
                {group.orders.map((o) => (
                  <OrderCard key={o.id} o={o} selected={selected.has(o.id)} onToggle={() => toggle(o.id)} />
                ))}
              </ul>
            </>
          )}
        </section>
      ))}

      {chosen.length > 0 && <div aria-hidden className="h-28" />}
      {chosen.length > 0 && (
        <div
          role="region"
          aria-label="Actions sur la sélection"
          className="atelier-deploie fixed inset-x-3 bottom-20 z-30 flex flex-wrap items-center gap-3 rounded-[14px] bg-cacao p-3 text-creme shadow-[0_8px_24px_rgba(36,20,13,0.35)] lg:bottom-6 lg:left-[18rem] lg:right-8"
        >
          <p className="font-bold">
            {chosen.length} sélectionnée{chosen.length > 1 ? "s" : ""}
          </p>
          {(Object.keys(BULK_ACTIONS) as BulkTarget[]).map((target) => {
            const eligible = chosen.filter((o) => bulkEligible(target, o));
            if (eligible.length === 0) return null;
            return (
              <ConfirmDialog
                key={target}
                trigger={<Button variant="accent">{`${BULK_ACTIONS[target].label} (${eligible.length})`}</Button>}
                title={`${BULK_ACTIONS[target].label} : ${eligible.length} commande${eligible.length > 1 ? "s" : ""} ?`}
                description={
                  <div className="flex flex-col gap-2">
                    <p>Chaque commande est revérifiée avant le changement. Les clientes voient la nouvelle étape sur leur page de suivi.</p>
                    <ul className="max-h-48 overflow-y-auto rounded-[8px] bg-creme p-2 text-[0.95rem]">
                      {eligible.map((o) => (
                        <li key={o.id}>
                          {o.reference} — {o.customerName}
                        </li>
                      ))}
                    </ul>
                    {eligible.length < chosen.length && <p className="text-encre-douce">{chosen.length - eligible.length} commande(s) sélectionnée(s) ne sont pas à cette étape et seront laissées de côté.</p>}
                  </div>
                }
                confirmLabel={BULK_ACTIONS[target].label}
                variant="primary"
                onConfirm={() => run(target)}
              />
            );
          })}
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto min-h-11 px-3 font-bold underline decoration-rose decoration-2 underline-offset-4">
            Annuler la sélection
          </button>
        </div>
      )}
    </div>
  );
}
