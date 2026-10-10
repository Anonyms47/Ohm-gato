"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  discardLegalDraft,
  publishLegalVersion,
  recordRefund,
  saveLegalCoordinates,
  saveLegalDraft,
  saveLegalIdentity,
  saveRefundDelay,
  saveRetention,
} from "@/app/admin/_actions/legal";
import { ActionButton, AdminForm, StateMessage } from "@/components/admin/AdminUi";
import { LegalContent } from "@/components/legal/LegalContent";
import { Button } from "@/components/ui/Button";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import type { AdminState } from "@/lib/admin/errors";
import { parseLegalMarkdown, tableOfContents, type LegalVariables } from "@/lib/legal/markdown";

function useSave() {
  const router = useRouter();
  const [state, setState] = useState<AdminState>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<AdminState>) => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    setState(result);
    if (result?.ok) router.refresh();
    return result;
  };
  return { state, busy, run };
}

/**
 * Éditeur de brouillon : texte en markdown restreint, aperçu identique au rendu public
 * (même analyseur, même composant), enregistrement puis publication.
 */
export function LegalDraftEditor({
  slug,
  draft,
  suggestedVersion,
  fallback,
  variables,
}: {
  slug: string;
  draft: { id: string; title: string; version: string; effectiveAt: string | null; content: string } | null;
  suggestedVersion: string;
  fallback: { title: string; content: string };
  variables: LegalVariables;
}) {
  const [title, setTitle] = useState(draft?.title ?? fallback.title);
  const [version, setVersion] = useState(draft?.version ?? suggestedVersion);
  const [effectiveAt, setEffectiveAt] = useState(draft?.effectiveAt ?? "");
  const [content, setContent] = useState(draft?.content ?? fallback.content);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const { state, busy, run } = useSave();
  const blocks = useMemo(() => parseLegalMarkdown(content, variables), [content, variables]);
  const toc = tableOfContents(blocks);
  const dirty = !draft || draft.title !== title || draft.version !== version || (draft.effectiveAt ?? "") !== effectiveAt || draft.content !== content;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_11rem] [&>*]:min-w-0">
        <Field label="Titre">{({ id }) => <TextInput id={id} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />}</Field>
        <Field label="Version" hint="Ex. 1.1">
          {({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} value={version} inputMode="decimal" maxLength={9} onChange={(e) => setVersion(e.target.value)} />}
        </Field>
        <Field label="En vigueur le" optional hint="Vide : date de publication.">
          {({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} type="date" value={effectiveAt} onChange={(e) => setEffectiveAt(e.target.value)} />}
        </Field>
      </div>

      <div role="group" aria-label="Mode d'affichage" className="flex gap-2">
        {(
          [
            ["edit", "Texte"],
            ["preview", "Aperçu public"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={view === key}
            onClick={() => setView(key)}
            className="min-h-11 rounded-[10px] border-2 border-chocolat px-4 font-bold aria-pressed:bg-chocolat aria-pressed:text-creme"
          >
            {label}
          </button>
        ))}
      </div>

      {view === "edit" ? (
        <Field
          label="Texte du document"
          hint="« ## Titre », « ### Sous-titre », listes « - », encart « > », **gras**, [lien](/page). Variables : {{email}}, {{telephone}}, {{adresse_retrait}}. Le HTML n'est jamais interprété."
        >
          {({ id, describedBy }) => (
            <TextArea
              id={id}
              aria-describedby={describedBy}
              rows={24}
              maxLength={60000}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="font-mono text-[0.95rem]"
            />
          )}
        </Field>
      ) : (
        <div className="rounded-[14px] border-2 border-dashed border-chocolat/30 bg-creme p-4 sm:p-6" data-testid="apercu-document">
          <p className="font-display text-[clamp(1.8rem,4vw,2.4rem)] leading-tight">{title}</p>
          <p className="mt-2 text-encre-douce">Version {version} · aperçu (non publié)</p>
          {toc.length > 1 && (
            <p className="mt-2 text-encre-douce">
              Sommaire : {toc.length} sections
            </p>
          )}
          <div className="mt-6 max-w-[68ch]">
            <LegalContent blocks={blocks} />
          </div>
        </div>
      )}

      <StateMessage state={state} />
      <div className="flex flex-wrap gap-3">
        <Button
          variant="secondary"
          state={busy ? "loading" : "idle"}
          loadingLabel="Enregistrement…"
          onClick={() => void run(() => saveLegalDraft(slug, { title, version, effectiveAt, content }))}
        >
          Enregistrer le brouillon
        </Button>
        {draft && !dirty && (
          <ActionButton
            label={`Publier la version ${draft.version}`}
            variant="primary"
            run={() => publishLegalVersion(draft.id)}
            confirm={{
              title: `Publier la version ${draft.version} ?`,
              description: (
                <p>
                  Elle remplace immédiatement la version en ligne. Les commandes déjà passées restent liées à la version qu&apos;elles ont acceptée.
                </p>
              ),
              confirmLabel: "Publier",
            }}
          />
        )}
        {draft && (
          <ActionButton
            label="Abandonner le brouillon"
            variant="text"
            run={() => discardLegalDraft(draft.id)}
            confirm={{ title: "Abandonner le brouillon ?", description: <p>La version en ligne n&apos;est pas modifiée.</p>, destructive: true }}
          />
        )}
      </div>
      {draft && dirty && <p className="text-encre-douce">Enregistrez le brouillon pour pouvoir le publier.</p>}
    </div>
  );
}

export function CoordinatesEditor({ initial }: { initial: { email: string; phone: string; pickupAddress: string } }) {
  const [values, setValues] = useState(initial);
  const { state, busy, run } = useSave();
  return (
    <div className="flex flex-col gap-3">
      <Field label="E-mail de contact">{({ id }) => <TextInput id={id} type="email" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} />}</Field>
      <Field label="Téléphone">{({ id }) => <TextInput id={id} type="tel" value={values.phone} onChange={(e) => setValues({ ...values, phone: e.target.value })} />}</Field>
      <Field label="Adresse de retrait">
        {({ id }) => <TextInput id={id} value={values.pickupAddress} onChange={(e) => setValues({ ...values, pickupAddress: e.target.value })} />}
      </Field>
      <StateMessage state={state} />
      <Button variant="secondary" className="self-start" state={busy ? "loading" : "idle"} onClick={() => void run(() => saveLegalCoordinates(values))}>
        Enregistrer les coordonnées
      </Button>
    </div>
  );
}

export function IdentityEditor({
  initial,
  fields,
}: {
  initial: Record<string, string | null>;
  fields: { key: string; label: string }[];
}) {
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(fields.map((f) => [f.key, initial[f.key] ?? ""])));
  const { state, busy, run } = useSave();
  return (
    <div className="flex flex-col gap-3">
      {fields.map((f) => (
        <Field key={f.key} label={f.label} optional>
          {({ id }) => <TextInput id={id} value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />}
        </Field>
      ))}
      <StateMessage state={state} />
      <Button
        variant="secondary"
        className="self-start"
        state={busy ? "loading" : "idle"}
        onClick={() =>
          void run(() =>
            saveLegalIdentity({
              civil_name: values.civil_name ?? "",
              ninea: values.ninea ?? "",
              rccm: values.rccm ?? "",
              admin_address: values.admin_address ?? "",
            }),
          )
        }
      >
        Enregistrer l&apos;identité (privée)
      </Button>
    </div>
  );
}

export function RefundDelayEditor({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const { state, busy, run } = useSave();
  return (
    <div className="flex flex-col gap-3">
      <Field label="Délai de remboursement" optional hint="Ex. « sous 7 jours après accord ». Vide : aucun délai n'est affiché sur le site.">
        {({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} value={value} maxLength={200} onChange={(e) => setValue(e.target.value)} />}
      </Field>
      <StateMessage state={state} />
      <Button variant="secondary" className="self-start" state={busy ? "loading" : "idle"} onClick={() => void run(() => saveRefundDelay(value))}>
        Enregistrer le délai
      </Button>
    </div>
  );
}

export function RetentionEditor({ initial }: { initial: { orders: string | null; accounts: string | null; custom_requests: string | null } }) {
  const [values, setValues] = useState({ orders: initial.orders ?? "", accounts: initial.accounts ?? "", custom_requests: initial.custom_requests ?? "" });
  const { state, busy, run } = useSave();
  const fields = [
    ["orders", "Commandes"],
    ["accounts", "Comptes clients"],
    ["custom_requests", "Demandes sur-mesure"],
  ] as const;
  return (
    <div className="flex flex-col gap-3">
      {fields.map(([key, label]) => (
        <Field key={key} label={label} optional hint="Durée validée (ex. « 3 ans après la commande »). Vide : non affiché.">
          {({ id, describedBy }) => (
            <TextInput id={id} aria-describedby={describedBy} value={values[key]} maxLength={160} onChange={(e) => setValues({ ...values, [key]: e.target.value })} />
          )}
        </Field>
      ))}
      <StateMessage state={state} />
      <Button variant="secondary" className="self-start" state={busy ? "loading" : "idle"} onClick={() => void run(() => saveRetention(values))}>
        Enregistrer les durées
      </Button>
    </div>
  );
}

export function RefundForm({ orderId, today }: { orderId: string; today: string }) {
  return (
    <AdminForm action={recordRefund.bind(null, orderId)} submitLabel="Enregistrer le remboursement" className="rounded-[12px] border-2 border-dashed border-chocolat/30 p-4">
      <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
        <Field label="Montant (FCFA)">{({ id }) => <TextInput id={id} name="amountFcfa" type="number" inputMode="numeric" min={1} step={1} required />}</Field>
        <Field label="Date du remboursement">{({ id }) => <TextInput id={id} name="refundedAt" type="date" defaultValue={today} required />}</Field>
      </div>
      <Field label="Moyen utilisé" hint="Ex. Wave, espèces.">
        {({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} name="method" maxLength={80} required />}
      </Field>
      <Field label="Motif">{({ id }) => <TextArea id={id} name="reason" rows={2} maxLength={500} required />}</Field>
    </AdminForm>
  );
}
