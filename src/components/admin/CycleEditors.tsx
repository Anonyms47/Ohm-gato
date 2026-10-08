"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addSlot, createCycle, deleteSlot, saveCycleProducts, setCycleStatus, toggleSlot, updateCycle } from "@/app/admin/_actions/cycles";
import { ActionButton, AdminForm, StateMessage } from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/Button";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { OhmegatoMultiSelect } from "@/components/ui/select/OhmegatoCombobox";
import { OhmegatoSelect } from "@/components/ui/select/OhmegatoSelect";
import type { AdminCycle, AdminProduct, CycleSetup } from "@/lib/admin/data";
import type { AdminState } from "@/lib/admin/errors";
import { formatSlot } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";

const PALETTES = [
  { value: "caramel", label: "Caramel" },
  { value: "chocolate", label: "Chocolat" },
  { value: "orange", label: "Orange" },
  { value: "rose", label: "Rose" },
];

/** Champ date-heure à l'heure de Dakar (UTC+0). */
const local = (iso: string) => iso.slice(0, 16);

export function CycleForm({ cycle, products, nextNumber }: { cycle: AdminCycle | null; products: AdminProduct[]; nextNumber: number }) {
  const [palette, setPalette] = useState<string>(cycle?.palette ?? "caramel");
  const [featured, setFeatured] = useState<string>(cycle?.featuredProductId ?? "");
  return (
    <AdminForm action={cycle ? updateCycle : createCycle} submitLabel={cycle ? "Enregistrer la fournée" : "Créer la fournée (brouillon)"}>
      {cycle && <input type="hidden" name="id" value={cycle.id} />}
      <input type="hidden" name="palette" value={palette} />
      <input type="hidden" name="featuredProductId" value={featured} />
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <Field label="Numéro">{({ id }) => <TextInput id={id} name="number" type="number" min={1} required defaultValue={cycle?.number ?? nextNumber} />}</Field>
        <Field label="Titre">{({ id }) => <TextInput id={id} name="title" required defaultValue={cycle?.title ?? `Fournée n°${nextNumber}`} />}</Field>
      </div>
      <Field label="Message de l'accueil" optional hint="Affiché sur la page d'accueil et dans le journal du four.">
        {({ id }) => <TextArea id={id} name="message" rows={3} maxLength={400} defaultValue={cycle?.message ?? ""} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ouverture des commandes" hint="Heure de Dakar">
          {({ id }) => <TextInput id={id} name="opensAt" type="datetime-local" required defaultValue={cycle ? local(cycle.opensAt) : ""} />}
        </Field>
        <Field label="Clôture des commandes" hint="Heure de Dakar">
          {({ id }) => <TextInput id={id} name="closesAt" type="datetime-local" required defaultValue={cycle ? local(cycle.closesAt) : ""} />}
        </Field>
        <Field label="Préparation">{({ id }) => <TextInput id={id} name="productionDate" type="date" required defaultValue={cycle?.productionDate ?? ""} />}</Field>
        <Field label="Livraison et retrait">{({ id }) => <TextInput id={id} name="fulfillmentDate" type="date" required defaultValue={cycle?.fulfillmentDate ?? ""} />}</Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Capacité totale (unités)" optional hint="Vide = limitée par le stock de chaque produit.">
          {({ id }) => <TextInput id={id} name="capacityUnits" type="number" min={0} defaultValue={cycle?.capacityUnits ?? ""} />}
        </Field>
        <OhmegatoSelect label="Couleur de l'affiche" value={palette} onValueChange={setPalette} options={PALETTES} />
        <OhmegatoSelect
          label="Produit vedette"
          optional
          value={featured || null}
          onValueChange={setFeatured}
          placeholder="Aucun"
          options={products.filter((p) => p.isActive).map((p) => ({ value: p.id, label: p.name }))}
        />
      </div>
    </AdminForm>
  );
}

const TRANSITIONS: Record<string, { to: string; label: string; confirm?: string; destructive?: boolean }[]> = {
  draft: [
    { to: "scheduled", label: "Programmer" },
    { to: "open", label: "Ouvrir les commandes", confirm: "Les clients pourront commander dès maintenant." },
    { to: "cancelled", label: "Annuler la fournée", confirm: "La fournée sera annulée.", destructive: true },
  ],
  scheduled: [
    { to: "open", label: "Ouvrir les commandes", confirm: "Les clients pourront commander dès maintenant." },
    { to: "draft", label: "Repasser en brouillon" },
    { to: "cancelled", label: "Annuler la fournée", confirm: "La fournée sera annulée.", destructive: true },
  ],
  open: [
    { to: "closed", label: "Clôturer les commandes", confirm: "Plus aucune commande ne sera acceptée pour cette fournée." },
    { to: "cancelled", label: "Annuler la fournée", confirm: "Commandes en attente annulées ; commandes payées signalées pour remboursement.", destructive: true },
  ],
  closed: [
    { to: "preparing", label: "Passer en préparation" },
    { to: "open", label: "Rouvrir les commandes", confirm: "Les clients pourront de nouveau commander." },
    { to: "cancelled", label: "Annuler la fournée", confirm: "Commandes en attente annulées ; commandes payées signalées pour remboursement.", destructive: true },
  ],
  preparing: [
    { to: "delivering", label: "Passer en livraison et retrait" },
    { to: "done", label: "Terminer la fournée", confirm: "La fournée passera dans les archives." },
  ],
  delivering: [{ to: "done", label: "Terminer la fournée", confirm: "La fournée passera dans les archives." }],
};

export function CycleStatusActions({ cycle }: { cycle: AdminCycle }) {
  const options = TRANSITIONS[cycle.status] ?? [];
  if (options.length === 0) return <p className="text-encre-douce">Aucune action possible : la fournée est {cycle.status === "done" ? "terminée" : "annulée"}.</p>;
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((t) => (
        <ActionButton
          key={t.to}
          label={t.label}
          variant={t.destructive ? "destructive" : "secondary"}
          run={() => setCycleStatus(cycle.id, t.to)}
          confirm={t.confirm ? { title: `${t.label} ?`, description: <p>{t.confirm}</p>, destructive: t.destructive } : undefined}
        />
      ))}
    </div>
  );
}

interface Row {
  productId: string;
  included: boolean;
  disabledVariantIds: string[];
  availableFlavorIds: string[] | null;
  totalUnits: number | null;
  sortOrder: number;
}

/** Produits de la fournée : formats autorisés, parfums, stock en unités réelles. */
export function CycleProductsEditor({
  cycleId,
  products,
  flavors,
  setup,
}: {
  cycleId: string;
  products: AdminProduct[];
  flavors: { id: string; name: string }[];
  setup: CycleSetup;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() =>
    products.map((p) => {
      const cp = setup.products.find((x) => x.productId === p.id);
      const inv = setup.inventory.find((x) => x.productId === p.id);
      return {
        productId: p.id,
        included: Boolean(cp),
        disabledVariantIds: cp?.disabledVariantIds ?? [],
        availableFlavorIds: cp?.availableFlavorIds ?? null,
        totalUnits: inv?.totalUnits ?? null,
        sortOrder: cp?.sortOrder ?? p.sortOrder,
      };
    }),
  );
  const [reason, setReason] = useState("");
  const [state, setState] = useState<AdminState>(null);
  const [busy, setBusy] = useState(false);
  const update = (productId: string, patch: Partial<Row>) => setRows((all) => all.map((r) => (r.productId === productId ? { ...r, ...patch } : r)));

  const save = async () => {
    setBusy(true);
    const result = await saveCycleProducts(cycleId, rows, reason);
    setBusy(false);
    setState(result);
    if (result?.ok) router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {products.map((product) => {
          const row = rows.find((r) => r.productId === product.id)!;
          const inv = setup.inventory.find((x) => x.productId === product.id);
          const productFlavors = flavors.filter((f) => product.flavorIds.includes(f.id));
          return (
            <li key={product.id} className="rounded-[12px] border-2 border-chocolat/20 bg-blanc-casse p-4">
              <label className="flex min-h-11 items-center gap-3 font-bold">
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--ohm-chocolat)]"
                  checked={row.included}
                  onChange={(e) => update(product.id, { included: e.target.checked })}
                />
                {product.name} {!product.isActive && <span className="font-normal text-orange-encre">(non publié)</span>}
              </label>
              {row.included && (
                <div className="mt-3 grid gap-4 md:grid-cols-[1fr_1fr_12rem]">
                  <fieldset>
                    <legend className="font-bold">Formats autorisés</legend>
                    {product.variants
                      .filter((v) => v.isActive)
                      .map((v) => (
                        <label key={v.id} className="flex min-h-11 items-center gap-3">
                          <input
                            type="checkbox"
                            className="size-5 accent-[var(--ohm-chocolat)]"
                            checked={!row.disabledVariantIds.includes(v.id)}
                            onChange={(e) =>
                              update(product.id, {
                                disabledVariantIds: e.target.checked ? row.disabledVariantIds.filter((id) => id !== v.id) : [...row.disabledVariantIds, v.id],
                              })
                            }
                          />
                          {v.label} · {v.unitsConsumed} u. · {formatFcfa(v.priceFcfa)}
                        </label>
                      ))}
                  </fieldset>
                  {productFlavors.length > 0 ? (
                    <OhmegatoMultiSelect
                      label="Parfums disponibles"
                      hint="Aucun choix = tous les parfums du produit."
                      values={row.availableFlavorIds ?? []}
                      onValuesChange={(values) => update(product.id, { availableFlavorIds: values.length === 0 ? null : values })}
                      options={productFlavors.map((f) => ({ value: f.id, label: f.name }))}
                      placeholder="Tous les parfums"
                    />
                  ) : (
                    <p className="text-encre-douce">Sans parfum.</p>
                  )}
                  <Field label={`Stock (${product.unitLabelPlural})`} hint={inv ? `Réservé ${inv.reservedUnits} · vendu ${inv.soldUnits}` : "Unités réelles produites."}>
                    {({ id }) => (
                      <TextInput
                        id={id}
                        type="number"
                        min={0}
                        value={row.totalUnits ?? ""}
                        onChange={(e) => update(product.id, { totalUnits: e.target.value === "" ? null : Number(e.target.value) })}
                      />
                    )}
                  </Field>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <Field label="Raison des changements de stock" optional hint="Gardée dans l'historique des mouvements.">
        {({ id }) => <TextInput id={id} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />}
      </Field>
      <StateMessage state={state} />
      <Button state={busy ? "loading" : "idle"} loadingLabel="Enregistrement…" onClick={() => void save()} className="self-start">
        Enregistrer produits et stock
      </Button>
    </div>
  );
}

export function SlotsEditor({ cycleId, slots, fulfillmentDate }: { cycleId: string; slots: CycleSetup["slots"]; fulfillmentDate: string }) {
  const [kind, setKind] = useState("delivery");
  return (
    <div className="flex flex-col gap-4">
      {slots.length === 0 ? (
        <p className="text-encre-douce">Aucun créneau : les clients ne peuvent pas encore commander.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {slots.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] bg-blanc-casse p-3">
              <span>
                <strong>{s.kind === "delivery" ? "Livraison" : s.kind === "pickup" ? "Retrait" : "Livraison et retrait"}</strong> ·{" "}
                {formatSlot(s.startsAt, s.endsAt)} · {s.orders} commande{s.orders > 1 ? "s" : ""}
                {s.capacityOrders ? ` / ${s.capacityOrders}` : ""} {!s.isActive && <span className="text-orange-encre">(désactivé)</span>}
              </span>
              <span className="flex flex-wrap gap-2">
                <ActionButton label={s.isActive ? "Désactiver" : "Réactiver"} variant="text" run={() => toggleSlot(s.id, !s.isActive)} />
                {s.orders === 0 && (
                  <ActionButton
                    label="Supprimer"
                    variant="text"
                    run={() => deleteSlot(s.id)}
                    confirm={{ title: "Supprimer ce créneau ?", description: <p>{formatSlot(s.startsAt, s.endsAt)}</p>, destructive: true }}
                  />
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <AdminForm action={addSlot} submitLabel="Ajouter le créneau" className="rounded-[12px] border-2 border-dashed border-chocolat/30 p-4">
        <input type="hidden" name="cycleId" value={cycleId} />
        <input type="hidden" name="kind" value={kind} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <OhmegatoSelect
            label="Type"
            value={kind}
            onValueChange={setKind}
            options={[
              { value: "delivery", label: "Livraison" },
              { value: "pickup", label: "Retrait" },
              { value: "both", label: "Les deux" },
            ]}
          />
          <Field label="Date">{({ id }) => <TextInput id={id} name="date" type="date" required defaultValue={fulfillmentDate} />}</Field>
          <Field label="Début">{({ id }) => <TextInput id={id} name="start" type="time" required />}</Field>
          <Field label="Fin">{({ id }) => <TextInput id={id} name="end" type="time" required />}</Field>
          <Field label="Capacité" optional hint="Commandes max.">
            {({ id }) => <TextInput id={id} name="capacity" type="number" min={1} />}
          </Field>
        </div>
      </AdminForm>
    </div>
  );
}
