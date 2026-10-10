"use client";

import { useState } from "react";
import { saveAllergenInfo } from "@/app/admin/_actions/allergens";
import { StateMessage } from "@/components/admin/AdminUi";
import { AllergenSummaryText } from "@/components/catalog/AllergenSummaryText";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { OhmegatoSelect } from "@/components/ui/select/OhmegatoSelect";
import type { AdminAllergen, AdminProduct } from "@/lib/admin/data";
import type { AdminState } from "@/lib/admin/errors";
import {
  ALLERGY_NOTICE,
  allergenStatusLabels,
  allergenVerificationLabels,
  summarizeAllergens,
  type AllergenStatus,
  type AllergenVerification,
  type WorkshopTraces,
} from "@/lib/allergens";

interface StatusRow {
  key: string;
  flavorId: string | null;
  allergenId: string;
  status: AllergenStatus;
  note: string;
  verification: AllergenVerification;
  verifiedAt: string | null;
}

interface NoteRow {
  key: string;
  flavorId: string | null;
  label: string;
  verification: AllergenVerification;
  verifiedAt: string | null;
}

const statusOptions = (Object.keys(allergenStatusLabels) as AllergenStatus[]).map((value) => ({
  value,
  label: allergenStatusLabels[value],
  description:
    value === "not_confirmed" || value === "not_applicable"
      ? "Jamais affiché aux clients."
      : value === "no_added"
        ? "Affiché avec « non garanti sans traces »."
        : undefined,
}));

const verificationOptions = (Object.keys(allergenVerificationLabels) as AllergenVerification[]).map((value) => ({
  value,
  label: allergenVerificationLabels[value],
}));

const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Africa/Dakar" });

let counter = 0;
const newKey = () => `n${++counter}`;

function Validation({ verifiedAt, onValidate }: { verifiedAt: string | null; onValidate: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[0.95rem]">
      <span className="text-encre-douce">
        {verifiedAt ? `Dernière validation : ${dateFormat.format(new Date(verifiedAt))}` : "Jamais validé par Alima"}
      </span>
      <button type="button" onClick={onValidate} className="min-h-11 font-bold underline decoration-caramel decoration-2 underline-offset-4">
        Valider aujourd&apos;hui
      </button>
    </div>
  );
}

export function AllergenEditor({
  product,
  allergens,
  flavors,
  workshopTraces,
}: {
  product: AdminProduct;
  allergens: AdminAllergen[];
  flavors: { id: string; name: string }[];
  workshopTraces: WorkshopTraces;
}) {
  const [rows, setRows] = useState<StatusRow[]>(() => product.allergenStatuses.map((s) => ({ ...s, key: s.id })));
  const [notes, setNotes] = useState<NoteRow[]>(() => product.recipeNotes.map((n) => ({ ...n, key: n.id })));
  const [adding, setAdding] = useState<Record<string, string>>({});
  const [state, setState] = useState<AdminState>(null);
  const [busy, setBusy] = useState(false);

  const productFlavors = product.flavorIds
    .map((id) => flavors.find((f) => f.id === id))
    .filter((f): f is { id: string; name: string } => Boolean(f));
  const scopes: { id: string | null; name: string }[] = [
    { id: null, name: "Tout le produit" },
    ...productFlavors.map((f) => ({ id: f.id, name: `Parfum ${f.name.toLocaleLowerCase("fr")}` })),
  ];
  const allergenName = (id: string) => allergens.find((a) => a.id === id)?.name ?? "Allergène retiré";
  const scopeKey = (id: string | null) => id ?? "produit";

  const updateRow = (key: string, patch: Partial<StatusRow>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const updateNote = (key: string, patch: Partial<NoteRow>) => setNotes((all) => all.map((n) => (n.key === key ? { ...n, ...patch } : n)));
  const today = () => new Date().toISOString();

  const info = {
    entries: rows.map((r) => ({ allergenId: r.allergenId, flavorId: r.flavorId, status: r.status })),
    recipeNotes: notes.map((n, i) => ({ flavorId: n.flavorId, label: n.label, sortOrder: i })),
  };
  const previews =
    productFlavors.length > 0
      ? productFlavors.map((f) => ({ title: `Parfum ${f.name.toLocaleLowerCase("fr")}`, summary: summarizeAllergens(info, allergens, [f.id], workshopTraces) }))
      : [{ title: product.name, summary: summarizeAllergens(info, allergens, [], workshopTraces) }];

  const save = async () => {
    setBusy(true);
    setState(
      await saveAllergenInfo(product.id, {
        statuses: rows.map(({ flavorId, allergenId, status, note, verification, verifiedAt }) => ({ flavorId, allergenId, status, note, verification, verifiedAt })),
        recipeNotes: notes.map(({ flavorId, label, verification, verifiedAt }) => ({ flavorId, label, verification, verifiedAt })),
      }),
    );
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-6" data-testid="editeur-allergenes">
      <p className="text-encre-douce">
        Trois informations distinctes : les allergènes (statut), les informations de recette (« Contient du chocolat ») et les traces. L&apos;indicateur
        interne et les précisions ne sont jamais visibles par les clients.
      </p>

      {scopes.map((scope) => {
        const order = (id: string) => allergens.find((a) => a.id === id)?.sortOrder ?? 99;
        const scopeRows = rows.filter((r) => r.flavorId === scope.id).sort((a, b) => order(a.allergenId) - order(b.allergenId));
        const scopeNotes = notes.filter((n) => n.flavorId === scope.id);
        const available = allergens.filter((a) => !scopeRows.some((r) => r.allergenId === a.id));
        const pick = adding[scopeKey(scope.id)] ?? null;
        return (
          <fieldset key={scopeKey(scope.id)} className="flex min-w-0 flex-col gap-4 rounded-[12px] border-2 border-chocolat/20 p-4">
            <legend className="px-1 font-display text-[1.25rem]">{scope.name}</legend>
            {scope.id && <p className="text-encre-douce">S&apos;ajoute aux informations de « Tout le produit » quand ce parfum est choisi.</p>}

            <h3 className="font-bold">Allergènes</h3>
            {scopeRows.length === 0 && <p className="text-encre-douce">Aucun allergène renseigné ici.</p>}
            <ul className="flex flex-col gap-3">
              {scopeRows.map((r) => (
                <li key={r.key} className="flex flex-col gap-3 rounded-[10px] bg-blanc-casse p-3" data-testid={`allergene-${scopeKey(scope.id)}-${allergens.find((a) => a.id === r.allergenId)?.slug ?? "x"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold">{allergenName(r.allergenId)}</span>
                    <button type="button" onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))} className="min-h-11 font-bold text-erreur underline">
                      Retirer
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
                    <OhmegatoSelect label="Statut" value={r.status} onValueChange={(v) => updateRow(r.key, { status: v as AllergenStatus })} options={statusOptions} />
                    <OhmegatoSelect
                      label="Indicateur interne"
                      value={r.verification}
                      onValueChange={(v) => updateRow(r.key, { verification: v as AllergenVerification })}
                      options={verificationOptions}
                    />
                  </div>
                  <Field label="Précision (interne)" optional>
                    {({ id }) => <TextInput id={id} value={r.note} maxLength={300} onChange={(e) => updateRow(r.key, { note: e.target.value })} />}
                  </Field>
                  <Validation verifiedAt={r.verifiedAt} onValidate={() => updateRow(r.key, { verifiedAt: today(), verification: "confirmed_by_alima" })} />
                </li>
              ))}
            </ul>
            {available.length > 0 && (
              <div className="flex flex-wrap items-end gap-3">
                <OhmegatoSelect
                  className="min-w-[14rem] flex-1"
                  label="Ajouter un allergène"
                  value={pick}
                  onValueChange={(v) => setAdding((all) => ({ ...all, [scopeKey(scope.id)]: v }))}
                  options={available.map((a) => ({ value: a.id, label: a.name }))}
                />
                <Button
                  variant="secondary"
                  disabled={!pick}
                  onClick={() => {
                    if (!pick) return;
                    setRows((all) => [
                      ...all,
                      { key: newKey(), flavorId: scope.id, allergenId: pick, status: "not_confirmed", note: "", verification: "deduced_from_recipe", verifiedAt: null },
                    ]);
                    setAdding((all) => ({ ...all, [scopeKey(scope.id)]: "" }));
                  }}
                >
                  Ajouter
                </Button>
              </div>
            )}

            <h3 className="font-bold">Informations de recette</h3>
            <p className="-mt-2 text-encre-douce">Écrites pour suivre « Contient » : « du chocolat », « de la cannelle », « des pommes ».</p>
            <ul className="flex flex-col gap-3">
              {scopeNotes.map((n) => (
                <li key={n.key} className="flex flex-col gap-3 rounded-[10px] bg-blanc-casse p-3">
                  <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
                    <Field label="Contient…">
                      {({ id }) => <TextInput id={id} value={n.label} maxLength={80} onChange={(e) => updateNote(n.key, { label: e.target.value })} />}
                    </Field>
                    <OhmegatoSelect
                      label="Indicateur interne"
                      value={n.verification}
                      onValueChange={(v) => updateNote(n.key, { verification: v as AllergenVerification })}
                      options={verificationOptions}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Validation verifiedAt={n.verifiedAt} onValidate={() => updateNote(n.key, { verifiedAt: today(), verification: "confirmed_by_alima" })} />
                    <button type="button" onClick={() => setNotes((all) => all.filter((x) => x.key !== n.key))} className="min-h-11 font-bold text-erreur underline">
                      Retirer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <Button
              variant="secondary"
              className="self-start"
              onClick={() => setNotes((all) => [...all, { key: newKey(), flavorId: scope.id, label: "", verification: "deduced_from_recipe", verifiedAt: null }])}
            >
              Ajouter une information de recette
            </Button>
          </fieldset>
        );
      })}

      <section aria-labelledby={`apercu-${product.id}`} className="rounded-[12px] border-2 border-dashed border-caramel p-4" data-testid="apercu-allergenes">
        <h3 id={`apercu-${product.id}`} className="font-display text-[1.25rem]">
          Aperçu client
        </h3>
        <div className="mt-2 flex flex-col gap-3">
          {previews.map((p) => (
            <div key={p.title}>
              {previews.length > 1 && <p className="font-bold">{p.title}</p>}
              <AllergenSummaryText summary={p.summary} empty="Aucune information allergène affichée." />
            </div>
          ))}
          <p className="text-encre-douce">{ALLERGY_NOTICE}</p>
        </div>
      </section>

      <StateMessage state={state} />
      <Button className="self-start" state={busy ? "loading" : "idle"} loadingLabel="Enregistrement…" onClick={save}>
        Enregistrer les allergènes
      </Button>
    </div>
  );
}
