"use client";

import { useState } from "react";
import { saveWorkshopTraces } from "@/app/admin/_actions/allergens";
import { StateMessage } from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/Button";
import type { AdminAllergen, WorkshopTracesAdmin } from "@/lib/admin/data";
import type { AdminState } from "@/lib/admin/errors";
import { frenchList } from "@/lib/allergens";

const checks = [
  { key: "ingredients", label: "Les ingrédients manipulés dans la cuisine ont été vérifiés." },
  { key: "packaging", label: "Les mentions des emballages ont été lues." },
  { key: "utensils", label: "Les risques liés aux ustensiles et surfaces partagés ont été évalués." },
] as const;

/** Mention « Peut contenir des traces » pour tout l'atelier, activable seulement après confirmation d'Alima. */
export function WorkshopTracesEditor({ initial, allergens }: { initial: WorkshopTracesAdmin; allergens: AdminAllergen[] }) {
  const [enabled, setEnabled] = useState(initial.traces.enabled);
  const [selected, setSelected] = useState<string[]>(initial.traces.allergens);
  const [review, setReview] = useState({ ingredients: initial.review.ingredients, packaging: initial.review.packaging, utensils: initial.review.utensils });
  const [state, setState] = useState<AdminState>(null);
  const [busy, setBusy] = useState(false);
  const reviewed = review.ingredients && review.packaging && review.utensils;
  const labels = allergens.filter((a) => selected.includes(a.slug)).map((a) => a.sentenceLabel);

  return (
    <div className="flex flex-col gap-4" data-testid="traces-atelier">
      <p className="text-encre-douce">
        Désactivée par défaut. Ne l&apos;activez qu&apos;après avoir vérifié les trois points ci-dessous : aucune mention de traces n&apos;est inventée.
      </p>
      <fieldset className="flex flex-col gap-2">
        <legend className="font-bold">Vérifications d&apos;Alima</legend>
        {checks.map((c) => (
          <label key={c.key} className="flex min-h-11 items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 size-5 accent-[var(--ohm-chocolat)]"
              checked={review[c.key]}
              onChange={(e) => {
                setReview((r) => ({ ...r, [c.key]: e.target.checked }));
                if (!e.target.checked) setEnabled(false);
              }}
            />
            {c.label}
          </label>
        ))}
        {initial.review.confirmedAt && (
          <p className="text-encre-douce">Dernière confirmation : {new Date(initial.review.confirmedAt).toLocaleDateString("fr-FR", { timeZone: "Africa/Dakar" })}</p>
        )}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="font-bold">Allergènes concernés</legend>
        <div className="flex flex-wrap gap-x-6">
          {allergens.map((a) => (
            <label key={a.slug} className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                className="size-5 accent-[var(--ohm-chocolat)]"
                checked={selected.includes(a.slug)}
                onChange={(e) => setSelected((all) => (e.target.checked ? [...all, a.slug] : all.filter((s) => s !== a.slug)))}
              />
              {a.name}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex min-h-11 items-center gap-3 font-bold">
        <input
          type="checkbox"
          className="size-5 accent-[var(--ohm-chocolat)]"
          checked={enabled}
          disabled={!reviewed}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Afficher la mention sur les fiches produits
      </label>
      {!reviewed && <p className="text-encre-douce">Cochez d&apos;abord les trois vérifications.</p>}
      <p className="rounded-[10px] bg-blanc-casse p-3">
        Aperçu : {enabled && labels.length ? `Peut contenir des traces : ${frenchList(labels)}.` : "aucune mention de traces d’atelier affichée."}
      </p>
      <StateMessage state={state} />
      <Button
        variant="secondary"
        className="self-start"
        state={busy ? "loading" : "idle"}
        onClick={async () => {
          setBusy(true);
          setState(await saveWorkshopTraces({ enabled, allergens: selected, review }));
          setBusy(false);
        }}
      >
        Enregistrer
      </Button>
    </div>
  );
}
