"use client";

import { duplicateCycle } from "@/app/admin/_actions/cycles";
import { AdminForm } from "@/components/admin/AdminUi";
import { Field, TextInput } from "@/components/ui/Field";

/** Nouvelle fournée depuis une précédente : seules les dates changent, tout le reste est repris. */
export function DuplicateCycleForm({
  sourceId,
  defaults,
}: {
  sourceId: string;
  defaults: { number: number; opensAt: string; closesAt: string; productionDate: string; fulfillmentDate: string };
}) {
  return (
    <AdminForm action={duplicateCycle} submitLabel="Créer la fournée (brouillon)">
      <input type="hidden" name="sourceId" value={sourceId} />
      <Field label="Numéro">{({ id }) => <TextInput id={id} name="number" type="number" min={1} required defaultValue={defaults.number} />}</Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ouverture des commandes" hint="Heure de Dakar.">
          {({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} name="opensAt" type="datetime-local" required defaultValue={defaults.opensAt} />}
        </Field>
        <Field label="Date limite de précommande" hint="Les précommandes se ferment automatiquement à cette heure.">
          {({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} name="closesAt" type="datetime-local" required defaultValue={defaults.closesAt} />}
        </Field>
        <Field label="Début de la période de production">
          {({ id }) => <TextInput id={id} name="productionDate" type="date" required defaultValue={defaults.productionDate} />}
        </Field>
        <Field label="Jour principal de livraison et de retrait" hint="Les créneaux sont décalés d'autant de jours.">
          {({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} name="fulfillmentDate" type="date" required defaultValue={defaults.fulfillmentDate} />}
        </Field>
      </div>
    </AdminForm>
  );
}
