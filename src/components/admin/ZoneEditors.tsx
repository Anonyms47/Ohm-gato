"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { duplicateZone, importZonesCsv, moveZone, previewZonesCsv, saveZone, setZoneActive, type ZonesImportPreview } from "@/app/admin/_actions/zones";
import { ActionButton, AdminForm, StateMessage } from "@/components/admin/AdminUi";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { OhmegatoCombobox } from "@/components/ui/select/OhmegatoCombobox";
import type { AdminState } from "@/lib/admin/errors";
import { districtOptions, normalizePlace, type DeliveryZone } from "@/lib/delivery/zones";
import { formatFcfa } from "@/lib/money";

type ZoneWithUsage = DeliveryZone & { orders: number };

function ZoneForm({ zone, nextOrder }: { zone?: ZoneWithUsage; nextOrder: number }) {
  return (
    <AdminForm action={saveZone} submitLabel={zone ? "Enregistrer la zone" : "Créer la zone"}>
      {zone && <input type="hidden" name="id" value={zone.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom de la zone">{({ id }) => <TextInput id={id} name="name" required maxLength={80} defaultValue={zone?.name ?? ""} />}</Field>
        <Field label="Tarif de livraison (FCFA)" optional hint="Vide : « tarif confirmé selon votre position ». Réglé directement au livreur.">
          {({ id }) => <TextInput id={id} name="fee" inputMode="numeric" defaultValue={zone?.feeFcfa ?? ""} placeholder="Ex. 1500" />}
        </Field>
      </div>
      <Field label="Quartiers de la zone" hint="Un quartier par ligne. Un quartier ne peut appartenir qu'à une seule zone active.">
        {({ id, describedBy }) => <TextArea id={id} name="districts" rows={6} aria-describedby={describedBy} defaultValue={zone?.districts.join("\n") ?? ""} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ordre d'affichage" hint="Les petits nombres s'affichent en premier.">
          {({ id }) => <TextInput id={id} name="sortOrder" inputMode="numeric" defaultValue={zone?.sortOrder ?? nextOrder} />}
        </Field>
        <Field label="Note ou délai" optional>
          {({ id }) => <TextInput id={id} name="note" maxLength={200} defaultValue={zone?.note ?? ""} placeholder="Ex. livraison l'après-midi" />}
        </Field>
      </div>
      <label className="flex min-h-11 items-center gap-3 font-bold">
        <input type="checkbox" name="active" defaultChecked={zone ? zone.isActive : true} className="size-5 accent-chocolat" />
        Zone active (proposée aux clientes)
      </label>
    </AdminForm>
  );
}

/** Aperçu exact du sélecteur de quartier de la cliente : même composant, mêmes options. */
function ClientPreview({ zones }: { zones: DeliveryZone[] }) {
  const [value, setValue] = useState<string | null>(null);
  const options = useMemo(() => districtOptions(zones), [zones]);
  const zone = value ? zones.find((z) => z.isActive && z.districts.some((d) => normalizePlace(d) === normalizePlace(value))) : null;
  if (options.length === 0) {
    return <p className="text-encre-douce">Aucune zone active : le bon de fournée affiche « Tarif confirmé selon votre position ».</p>;
  }
  return (
    <div className="flex max-w-md flex-col gap-3">
      <OhmegatoCombobox
        label="Quartier"
        value={value}
        onValueChange={setValue}
        options={options}
        placeholder="Choisir mon quartier"
        searchPlaceholder="Rechercher mon quartier…"
        emptyLabel="Aucun quartier ne correspond."
      />
      {zone && (
        <p className="rounded-[10px] border-2 border-caramel-encre bg-blanc-casse px-3 py-2 font-bold text-caramel-encre">
          {typeof zone.feeFcfa === "number" ? `Frais de livraison : ${formatFcfa(zone.feeFcfa)} — à régler directement au livreur.` : "Tarif confirmé selon votre position."}
        </p>
      )}
    </div>
  );
}

function ImportCsv() {
  const router = useRouter();
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ZonesImportPreview | null>(null);
  const [result, setResult] = useState<AdminState>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | undefined) => {
    setResult(null);
    setPreview(null);
    if (!file) return;
    if (file.size > 300_000) {
      setText(null);
      setPreview({ ok: false, message: "Fichier trop volumineux (300 Ko au plus).", errors: [], zones: 0, districts: 0, created: 0, updated: 0 });
      return;
    }
    const content = await file.text();
    setText(content);
    setFileName(file.name);
    setBusy(true);
    setPreview(await previewZonesCsv(content));
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-3 rounded-[12px] border-2 border-dashed border-chocolat/30 p-4">
      <Field label="Importer une grille (CSV)" hint="Colonnes : zone ; quartier ; tarif_fcfa ; ordre ; actif ; note. Une ligne par quartier. Vous pouvez d'abord exporter la grille actuelle pour obtenir le modèle.">
        {({ id, describedBy }) => <input id={id} type="file" accept=".csv,text/csv" aria-describedby={describedBy} onChange={(e) => void onFile(e.target.files?.[0])} className="min-h-11" />}
      </Field>
      {busy && <p role="status">Analyse du fichier…</p>}
      {preview && (
        <div className="flex flex-col gap-2" data-testid="apercu-import">
          <p role={preview.ok ? "status" : "alert"} className={preview.ok ? "font-bold text-succes" : "font-bold text-erreur"}>
            {preview.message}
          </p>
          {preview.ok && (
            <p>
              {fileName} : {preview.zones} zone(s), {preview.districts} quartier(s) — {preview.created} à créer, {preview.updated} à mettre à jour. Les zones absentes du fichier ne changent pas ; les anciennes commandes gardent leur tarif.
            </p>
          )}
          {preview.errors.length > 0 && (
            <ul className="list-disc pl-5 text-erreur">
              {preview.errors.map((e, i) => (
                <li key={i}>{e.line > 0 ? `Ligne ${e.line} : ` : ""}{e.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <StateMessage state={result} />
      {preview?.ok && text !== null && (
        <ActionButton
          label="Importer cette grille"
          variant="primary"
          run={async () => {
            const done = await importZonesCsv(text);
            setResult(done);
            if (done?.ok) {
              setPreview(null);
              setText(null);
              router.refresh();
            }
            return done;
          }}
          confirm={{
            title: "Importer cette grille ?",
            description: (
              <p>
                {preview.created} zone(s) seront créées et {preview.updated} mise(s) à jour. Les tarifs des clientes changent dès maintenant pour les nouvelles commandes ; les anciennes commandes ne changent pas.
              </p>
            ),
            confirmLabel: "Importer",
          }}
        />
      )}
    </div>
  );
}

export function ZonesManager({ zones }: { zones: ZoneWithUsage[] }) {
  const [query, setQuery] = useState("");
  const q = normalizePlace(query);
  const visible = zones.filter((z) => !q || normalizePlace(z.name).includes(q) || z.districts.some((d) => normalizePlace(d).includes(q)));
  const nextOrder = (zones.reduce((max, z) => Math.max(max, z.sortOrder), 0) || 0) + 10;

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="zones-liste" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="zones-liste" className="font-display text-[1.5rem]">
            Zones ({zones.length})
          </h2>
          <a href="/admin/zones/export" className="inline-flex min-h-11 items-center font-bold underline decoration-caramel decoration-2 underline-offset-4">
            Exporter la grille (CSV)
          </a>
        </div>
        <Field label="Rechercher une zone ou un quartier" optional>
          {({ id }) => <TextInput id={id} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ex. Almadies" />}
        </Field>
        {visible.length === 0 && <p className="text-encre-douce">{zones.length === 0 ? "Aucune zone pour l'instant." : "Aucune zone ne correspond."}</p>}
        <ul className="flex flex-col gap-3">
          {visible.map((zone) => {
            const index = zones.findIndex((z) => z.id === zone.id);
            return (
              <li key={zone.id} className="rounded-[12px] border-2 border-chocolat/20 bg-blanc-casse" data-testid="zone">
                <details>
                  <summary className="flex min-h-14 cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-2">
                    <span className="flex flex-col">
                      <span className="font-bold">
                        {zone.name} {!zone.isActive && <span className="ml-2 rounded-full bg-creme px-2 py-0.5 text-[0.85rem] font-bold text-encre-douce">désactivée</span>}
                      </span>
                      <span className="text-[0.95rem] text-encre-douce">
                        {typeof zone.feeFcfa === "number" ? formatFcfa(zone.feeFcfa) : "tarif à confirmer"} · {zone.districts.length} quartier{zone.districts.length > 1 ? "s" : ""}
                        {zone.orders > 0 && ` · ${zone.orders} commande${zone.orders > 1 ? "s" : ""}`}
                      </span>
                    </span>
                    <span className="font-bold underline decoration-caramel decoration-2 underline-offset-4">Modifier</span>
                  </summary>
                  <div className="flex flex-col gap-4 border-t-2 border-chocolat/10 p-4">
                    <ZoneForm zone={zone} nextOrder={nextOrder} />
                    <div className="flex flex-wrap gap-3 border-t-2 border-chocolat/10 pt-4">
                      <ActionButton label="Monter" variant="secondary" run={() => moveZone(zone.id, "up")} className={index === 0 ? "pointer-events-none opacity-40" : undefined} />
                      <ActionButton label="Descendre" variant="secondary" run={() => moveZone(zone.id, "down")} className={index === zones.length - 1 ? "pointer-events-none opacity-40" : undefined} />
                      <ActionButton label="Dupliquer" variant="secondary" run={() => duplicateZone(zone.id)} />
                      <ActionButton
                        label={zone.isActive ? "Désactiver" : "Activer"}
                        variant={zone.isActive ? "destructive" : "primary"}
                        run={() => setZoneActive(zone.id, !zone.isActive)}
                        confirm={{
                          title: zone.isActive ? `Désactiver « ${zone.name} » ?` : `Activer « ${zone.name} » ?`,
                          description: zone.isActive ? (
                            <p>Ses quartiers ne seront plus proposés : le tarif sera « confirmé selon la position ». Les anciennes commandes gardent leur tarif.</p>
                          ) : (
                            <p>Ses quartiers seront proposés aux clientes avec ce tarif.</p>
                          ),
                          destructive: zone.isActive,
                        }}
                      />
                    </div>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </section>

      <section id="nouvelle-zone" aria-labelledby="zone-nouvelle" className="flex scroll-mt-24 flex-col gap-4">
        <h2 id="zone-nouvelle" className="font-display text-[1.5rem]">
          Nouvelle zone
        </h2>
        <ZoneForm nextOrder={nextOrder} />
      </section>

      <section aria-labelledby="zones-import" className="flex flex-col gap-4">
        <h2 id="zones-import" className="font-display text-[1.5rem]">
          Importer une grille
        </h2>
        <ImportCsv />
      </section>

      <section aria-labelledby="zones-apercu" className="flex flex-col gap-4">
        <h2 id="zones-apercu" className="font-display text-[1.5rem]">
          Aperçu pour les clientes
        </h2>
        <p className="text-encre-douce">Voici exactement le sélecteur de quartier du bon de fournée, avec les zones actives.</p>
        <ClientPreview zones={zones} />
      </section>
    </div>
  );
}

