"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addProposal, saveInternalNote, sendStaffMessage, setRequestStatus } from "@/app/admin/_actions/custom";
import { ActionButton, AdminForm, StateMessage } from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/Button";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import type { AdminState } from "@/lib/admin/errors";
import type { CustomStatus } from "@/lib/custom/status";
import { formatFcfa } from "@/lib/money";

export function StaffMessageForm({ requestId }: { requestId: string }) {
  return (
    <AdminForm action={sendStaffMessage} submitLabel="Envoyer au client">
      <input type="hidden" name="requestId" value={requestId} />
      <Field label="Message">{({ id }) => <TextArea id={id} name="body" rows={4} maxLength={2000} />}</Field>
      <Field label="Document joint" optional hint="Image ou PDF, 5 Mo maximum.">
        {({ id }) => <input id={id} name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="min-h-11" />}
      </Field>
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" name="askQuestion" className="size-5 accent-[var(--ohm-chocolat)]" />
        C&apos;est une question : passer la demande en « Informations demandées »
      </label>
    </AdminForm>
  );
}

interface Line {
  label: string;
  detail: string;
  quantity: number;
  unit_price_fcfa: number;
}

/** Proposition chiffrée : le paiement ne s'ouvre que lorsque le client l'accepte. */
export function ProposalForm({ requestId, disabled }: { requestId: string; disabled: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [lines, setLines] = useState<Line[]>([{ label: "", detail: "", quantity: 1, unit_price_fcfa: 0 }]);
  const [validUntil, setValidUntil] = useState("");
  const [state, setState] = useState<AdminState>(null);
  const [busy, setBusy] = useState(false);
  const usable = lines.filter((l) => l.label.trim());
  const total = usable.reduce((sum, l) => sum + l.quantity * l.unit_price_fcfa, 0);
  if (disabled) return <p className="text-encre-douce">Paiement ouvert ou demande terminée : plus de nouvelle proposition.</p>;
  const update = (index: number, patch: Partial<Line>) => setLines((all) => all.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  return (
    <div className="flex flex-col gap-4">
      <Field label="Proposition (texte envoyé au client)">{({ id }) => <TextArea id={id} rows={4} value={body} onChange={(e) => setBody(e.target.value)} maxLength={3000} />}</Field>
      <fieldset className="flex flex-col gap-3">
        <legend className="font-bold">Lignes</legend>
        {lines.map((line, index) => (
          <div key={index} className="grid gap-2 rounded-[10px] bg-creme p-3 sm:grid-cols-[2fr_2fr_6rem_8rem_auto] sm:items-end">
            <Field label="Produit">{({ id }) => <TextInput id={id} value={line.label} onChange={(e) => update(index, { label: e.target.value })} />}</Field>
            <Field label="Détail" optional>{({ id }) => <TextInput id={id} value={line.detail} onChange={(e) => update(index, { detail: e.target.value })} />}</Field>
            <Field label="Qté">{({ id }) => <TextInput id={id} type="number" min={1} value={line.quantity} onChange={(e) => update(index, { quantity: Math.max(1, Number(e.target.value) || 1) })} />}</Field>
            <Field label="Prix unitaire">
              {({ id }) => <TextInput id={id} type="number" min={0} step={50} value={line.unit_price_fcfa} onChange={(e) => update(index, { unit_price_fcfa: Math.max(0, Number(e.target.value) || 0) })} />}
            </Field>
            <Button variant="text" onClick={() => setLines((all) => all.filter((_, i) => i !== index))} disabled={lines.length === 1}>
              Retirer
            </Button>
          </div>
        ))}
        <Button variant="text" className="self-start" onClick={() => setLines((all) => [...all, { label: "", detail: "", quantity: 1, unit_price_fcfa: 0 }])}>
          Ajouter une ligne
        </Button>
      </fieldset>
      <p className="font-bold tabular-nums">Total proposé : {formatFcfa(total)} (produits uniquement, livraison réglée au livreur)</p>
      <Field label="Valable jusqu'au" optional>{({ id }) => <TextInput id={id} type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />}</Field>
      <StateMessage state={state} />
      <Button
        state={busy ? "loading" : "idle"}
        loadingLabel="Envoi…"
        className="self-start"
        disabled={total <= 0}
        onClick={async () => {
          setBusy(true);
          const result = await addProposal(requestId, {
            body,
            lines: usable.map((l) => ({ label: l.label, detail: l.detail || undefined, quantity: l.quantity, unit_price_fcfa: l.unit_price_fcfa })),
            totalFcfa: total,
            validUntil,
          });
          setBusy(false);
          setState(result);
          if (result?.ok) {
            setBody("");
            router.refresh();
          }
        }}
      >
        Envoyer la proposition au client
      </Button>
    </div>
  );
}

const ACTIONS: Partial<Record<CustomStatus, { to: CustomStatus; label: string; destructive?: boolean }[]>> = {
  received: [
    { to: "studying", label: "Commencer l'étude" },
    { to: "declined", label: "Refuser la demande", destructive: true },
  ],
  studying: [{ to: "declined", label: "Refuser la demande", destructive: true }],
  info_requested: [
    { to: "studying", label: "Reprendre l'étude" },
    { to: "declined", label: "Refuser la demande", destructive: true },
  ],
  proposal_sent: [{ to: "declined", label: "Refuser la demande", destructive: true }],
  paid: [{ to: "preparing", label: "Passer en préparation" }],
  preparing: [{ to: "done", label: "Marquer terminée" }],
};

export function RequestStatusActions({ requestId, status }: { requestId: string; status: CustomStatus }) {
  const actions = ACTIONS[status] ?? [];
  if (actions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {actions.map((a) => (
        <ActionButton
          key={a.to}
          label={a.label}
          variant={a.destructive ? "destructive" : "secondary"}
          run={() => setRequestStatus(requestId, a.to, "")}
          confirm={a.destructive ? { title: `${a.label} ?`, description: <p>Le client verra que sa demande est refusée. Expliquez-lui pourquoi dans un message.</p>, destructive: true } : undefined}
        />
      ))}
    </div>
  );
}

export function InternalNote({ requestId, initial }: { requestId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<AdminState>(null);
  return (
    <div className="flex flex-col gap-2">
      <Field label="Note interne" hint="Jamais visible par le client.">
        {({ id }) => <TextArea id={id} rows={3} value={value} onChange={(e) => setValue(e.target.value)} />}
      </Field>
      <StateMessage state={state} />
      <Button variant="secondary" className="self-start" onClick={async () => setState(await saveInternalNote(requestId, value))}>
        Enregistrer la note
      </Button>
    </div>
  );
}
