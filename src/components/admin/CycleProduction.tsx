"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { planExtra, publishSurplus, recordProduction, withdrawSurplus } from "@/app/admin/_actions/cycles";
import { ActionButton, StateMessage } from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, TextInput } from "@/components/ui/Field";
import type { CycleSetup, DemandRow } from "@/lib/admin/data";
import type { AdminState } from "@/lib/admin/errors";
import { formatDay, formatTime } from "@/lib/dates";
import { theoreticalSurplus } from "@/lib/production";

const dateTime = (iso: string) => `${formatDay(iso)}, ${formatTime(iso)}`;

/** Une ligne de production : quantité supplémentaire, production réelle, pertes, note interne. */
function ProductionRow({
  cycleId,
  cycleStatus,
  row,
  inventory,
}: {
  cycleId: string;
  cycleStatus: string;
  row: DemandRow;
  inventory: CycleSetup["inventory"][number] | undefined;
}) {
  const router = useRouter();
  const [extra, setExtra] = useState(String(row.extra));
  const [produced, setProduced] = useState(inventory?.producedUnits === null || inventory?.producedUnits === undefined ? "" : String(inventory.producedUnits));
  const [lost, setLost] = useState(String(inventory?.lostUnits ?? 0));
  const [note, setNote] = useState(inventory?.productionNote ?? "");
  const [state, setState] = useState<AdminState>(null);
  const [busy, setBusy] = useState(false);
  const canRecord = ["closed", "preparing", "delivering", "surplus"].includes(cycleStatus);
  const run = async (action: () => Promise<AdminState>) => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    setState(result);
    if (result?.ok) router.refresh();
  };
  const surplus = inventory
    ? theoreticalSurplus(
        {
          producedUnits: produced === "" ? null : Number(produced),
          lostUnits: Number(lost) || 0,
          reservedUnits: inventory.reservedUnits,
          soldUnits: inventory.soldUnits,
          totalUnits: inventory.totalUnits,
        },
        cycleStatus,
      )
    : null;

  return (
    <li className="flex flex-col gap-3 rounded-[12px] border-2 border-chocolat/20 bg-blanc-casse p-4" data-testid={`production-${row.productId}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-[1.25rem]">{row.name}</p>
        <p className="text-encre-douce">
          À produire pour les commandes confirmées : <strong>{row.toProduce}</strong> {row.unitLabelPlural} (dont {row.paid} payées)
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
        <Field label="Quantité supplémentaire décidée" hint="En plus de la demande confirmée.">
          {({ id, describedBy }) => (
            <TextInput id={id} aria-describedby={describedBy} type="number" min={0} value={extra} onChange={(e) => setExtra(e.target.value)} />
          )}
        </Field>
        <Field label="Quantité réellement produite" optional={!canRecord} hint={canRecord ? undefined : "Après la clôture des précommandes."}>
          {({ id, describedBy }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              type="number"
              min={0}
              disabled={!canRecord}
              value={produced}
              onChange={(e) => setProduced(e.target.value)}
            />
          )}
        </Field>
        <Field label="Pertes / non commercialisables">
          {({ id }) => <TextInput id={id} type="number" min={0} disabled={!canRecord} value={lost} onChange={(e) => setLost(e.target.value)} />}
        </Field>
        <Field label="Note interne" optional>
          {({ id }) => <TextInput id={id} maxLength={500} disabled={!canRecord} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
      </div>
      <p className="text-[0.95rem]" data-testid="surplus-theorique">
        Surplus théorique :{" "}
        <strong>{surplus === null ? "saisissez la production réelle" : `${surplus} ${row.unitLabelPlural}`}</strong>
        {inventory?.productionRecordedAt && <span className="text-encre-douce"> · saisie le {dateTime(inventory.productionRecordedAt)}</span>}
      </p>
      <StateMessage state={state} />
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" state={busy ? "loading" : "idle"} onClick={() => void run(() => planExtra(cycleId, row.productId, Number(extra) || 0))}>
          Enregistrer la quantité supplémentaire
        </Button>
        {canRecord && (
          <Button
            variant="secondary"
            state={busy ? "loading" : "idle"}
            disabled={produced === ""}
            onClick={() => void run(() => recordProduction(cycleId, row.productId, { produced: Number(produced), lost: Number(lost) || 0, note }))}
          >
            Enregistrer la production
          </Button>
        )}
      </div>
    </li>
  );
}

export function ProductionEditor({
  cycleId,
  cycleStatus,
  demand,
  inventory,
}: {
  cycleId: string;
  cycleStatus: string;
  demand: DemandRow[];
  inventory: CycleSetup["inventory"];
}) {
  if (demand.length === 0) return <p className="text-encre-douce">Ajoutez d&apos;abord les produits de la fournée.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {demand.map((row) => (
        <ProductionRow key={row.productId} cycleId={cycleId} cycleStatus={cycleStatus} row={row} inventory={inventory.find((i) => i.productId === row.productId)} />
      ))}
    </ul>
  );
}

/**
 * Publication du surplus : Alima vérifie les quantités, la dernière date de vente et le mode de
 * remise, puis confirme un récapitulatif. Aucune publication automatique.
 */
export function SurplusPublisher({
  cycleId,
  cycleStatus,
  demand,
  inventory,
  surplusEndsAt,
  surplusDeliveryAllowed,
  hasSurplusSlots,
}: {
  cycleId: string;
  cycleStatus: string;
  demand: DemandRow[];
  inventory: CycleSetup["inventory"];
  surplusEndsAt: string | null;
  surplusDeliveryAllowed: boolean;
  hasSurplusSlots: boolean;
}) {
  const router = useRouter();
  const theoretical = (productId: string) => {
    const inv = inventory.find((i) => i.productId === productId);
    return inv ? theoreticalSurplus(inv, cycleStatus) : null;
  };
  const [units, setUnits] = useState<Record<string, string>>(() =>
    Object.fromEntries(demand.map((d) => [d.productId, cycleStatus === "surplus" ? "0" : String(theoretical(d.productId) ?? 0)])),
  );
  const [endsAt, setEndsAt] = useState(surplusEndsAt ? surplusEndsAt.slice(0, 16) : "");
  const [delivery, setDelivery] = useState(surplusDeliveryAllowed);
  const [state, setState] = useState<AdminState>(null);
  const allowed = ["preparing", "delivering", "surplus"].includes(cycleStatus);
  const items = demand.map((d) => ({ productId: d.productId, name: d.name, label: d.unitLabelPlural, units: Math.max(0, Number(units[d.productId]) || 0) }));
  const toPublish = items.filter((i) => i.units > 0);

  if (!allowed) {
    return <p className="text-encre-douce">Le surplus se publie après la production (fournée en production, en livraison ou déjà en surplus).</p>;
  }

  return (
    <div className="flex flex-col gap-4" data-testid="publication-surplus">
      <p className="text-encre-douce">
        Le surplus théorique est indicatif : vérifiez ce qui est réellement disponible. Le stock réservé aux commandes confirmées n&apos;est jamais
        proposé.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
        {demand.map((d) => {
          const max = theoretical(d.productId);
          return (
            <li key={d.productId}>
              <Field label={`${d.name} — ${cycleStatus === "surplus" ? "à ajouter" : "à publier"}`} hint={max === null ? "Production réelle non saisie." : `Au plus ${max} ${d.unitLabelPlural}.`}>
                {({ id, describedBy }) => (
                  <TextInput
                    id={id}
                    aria-describedby={describedBy}
                    type="number"
                    min={0}
                    max={max ?? 0}
                    disabled={max === null}
                    value={units[d.productId] ?? "0"}
                    onChange={(e) => setUnits((all) => ({ ...all, [d.productId]: e.target.value }))}
                  />
                )}
              </Field>
            </li>
          );
        })}
      </ul>
      <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
        <Field label="Dernière date de vente du surplus" hint="Heure de Dakar. La vente se ferme automatiquement à cette heure.">
          {({ id, describedBy }) => (
            <TextInput id={id} aria-describedby={describedBy} type="datetime-local" required value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          )}
        </Field>
        <label className="flex min-h-11 items-center gap-3 self-end font-bold">
          <input type="checkbox" className="size-5 accent-[var(--ohm-chocolat)]" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} />
          Livraison possible pour les commandes tardives (sinon retrait uniquement)
        </label>
      </div>
      {!hasSurplusSlots && (
        <p className="font-bold text-orange-encre">Ajoutez d&apos;abord un créneau « Commandes tardives (surplus) » dans les créneaux ci-dessous.</p>
      )}
      <StateMessage state={state} />
      <ConfirmDialog
        trigger={
          <Button className="self-start" disabled={!endsAt || (cycleStatus !== "surplus" && toPublish.length === 0)}>
            Publier le surplus disponible
          </Button>
        }
        title="Publier le surplus disponible ?"
        description={
          <div className="flex flex-col gap-2">
            {toPublish.length > 0 ? (
              <ul className="list-disc pl-5">
                {toPublish.map((i) => (
                  <li key={i.productId}>
                    {i.name} : {i.units} {i.label}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Aucune quantité ajoutée : seules la date de fin et la livraison seront mises à jour.</p>
            )}
            {endsAt && <p>Vente jusqu&apos;au {dateTime(`${endsAt}:00Z`)} (heure de Dakar).</p>}
            <p>{delivery ? "Livraison et retrait possibles." : "Retrait uniquement."}</p>
            <p>Ces quantités seront immédiatement proposées aux clients, dans la limite du stock réellement restant.</p>
          </div>
        }
        confirmLabel="Publier"
        onConfirm={async () => {
          const result = await publishSurplus(cycleId, {
            items: items.map((i) => ({ productId: i.productId, units: i.units })),
            endsAt,
            deliveryAllowed: delivery,
          });
          setState(result);
          if (result?.ok) router.refresh();
          return result;
        }}
      />
    </div>
  );
}

/** Retirer un produit du surplus en cours de vente. */
export function WithdrawSurplus({ cycleId, productId, name }: { cycleId: string; productId: string; name: string }) {
  return (
    <ActionButton
      label="Retirer du surplus"
      variant="text"
      run={() => withdrawSurplus(cycleId, productId)}
      confirm={{ title: `Retirer ${name} du surplus ?`, description: <p>Les unités restantes ne seront plus proposées aux clients.</p>, destructive: true }}
    />
  );
}
