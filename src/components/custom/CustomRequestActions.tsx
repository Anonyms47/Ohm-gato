"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, type ButtonState } from "@/components/ui/Button";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { OhmegatoSelect } from "@/components/ui/select/OhmegatoSelect";
import { ATTACHMENT_MAX_BYTES } from "@/lib/custom/status";
import { formatFcfa } from "@/lib/money";

export type CustomAccessProp = { token: string } | { reference: string };

async function postAction(access: CustomAccessProp, fields: Record<string, string | Blob>) {
  const form = new FormData();
  if ("token" in access) form.set("token", access.token);
  else form.set("reference", access.reference);
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  try {
    const response = await fetch("/api/sur-mesure/action", { method: "POST", body: form });
    return (await response.json()) as { ok: boolean; message?: string; trackingPath?: string | null };
  } catch {
    return { ok: false, message: "Connexion au serveur impossible. Réessayez." };
  }
}

function checkFile(file: File | null): string | null {
  if (!file) return null;
  if (file.size > ATTACHMENT_MAX_BYTES) return "Le fichier dépasse 5 Mo.";
  if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) return "Formats acceptés : JPEG, PNG, WebP ou PDF.";
  return null;
}

/** Réponse à une proposition. Accepter ouvre le paiement, au prix fixé par OHMEGATO. */
export function ProposalResponse({ access, proposalId, totalFcfa }: { access: CustomAccessProp; proposalId: string; totalFcfa: number }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "accepting" | "declining" | "confirmDecline">("idle");
  const [error, setError] = useState<string | null>(null);

  const respond = async (accept: boolean) => {
    setState(accept ? "accepting" : "declining");
    setError(null);
    const result = await postAction(access, { action: "respond", proposalId, accept: String(accept) });
    if (!result.ok) {
      setError(result.message ?? "Action impossible.");
      setState("idle");
      return;
    }
    if (accept && result.trackingPath) router.push(result.trackingPath);
    else router.refresh();
    setState("idle");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <Button state={state === "accepting" ? "loading" : "idle"} loadingLabel="Acceptation…" disabled={state === "declining"} onClick={() => void respond(true)}>
          Accepter et payer {formatFcfa(totalFcfa)}
        </Button>
        {state === "confirmDecline" ? (
          <>
            <Button variant="destructive" onClick={() => void respond(false)}>
              Oui, décliner la proposition
            </Button>
            <Button variant="text" onClick={() => setState("idle")}>
              Annuler
            </Button>
          </>
        ) : (
          <Button variant="secondary" state={state === "declining" ? "loading" : "idle"} onClick={() => setState("confirmDecline")}>
            Décliner
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="font-bold text-erreur">
          {error}
        </p>
      )}
    </div>
  );
}

export function MessageComposer({ access }: { access: CustomAccessProp }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<ButtonState>("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (state === "loading") return;
    const fileError = checkFile(file);
    if (fileError) return setError(fileError);
    if (!body.trim() && !file) return setError("Écrivez un message ou joignez un fichier.");
    setState("loading");
    setError(null);
    const result = await postAction(access, { action: "message", body, ...(file ? { file } : {}) });
    if (!result.ok) {
      setState("error");
      setError(result.message ?? "Envoi impossible.");
      return;
    }
    setBody("");
    setFile(null);
    setState("success");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <Field label="Votre message" error={error ?? undefined}>
        {({ id, describedBy, invalid }) => (
          <TextArea id={id} rows={3} aria-describedby={describedBy} aria-invalid={invalid} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />
        )}
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-h-11 cursor-pointer items-center rounded-[10px] border-2 border-chocolat/50 px-4 font-bold focus-within:outline-[3px] focus-within:outline-rose-encre">
          {file ? "Changer la pièce jointe" : "Joindre un fichier"}
          <input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        {file && <span className="break-all text-encre-douce">{file.name}</span>}
      </div>
      <Button type="submit" state={state} loadingLabel="Envoi…" successLabel="Message envoyé" className="self-start">
        Envoyer le message
      </Button>
    </form>
  );
}

const TIMES = Array.from({ length: 29 }, (_, i) => {
  const minutes = 7 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

/** Modification de la demande tant qu'aucune proposition n'est en attente. */
export function RequestEditor({
  access,
  initial,
}: {
  access: CustomAccessProp;
  initial: { eventDate: string; eventTime: string; guests: number | null; ambiance: string; personalization: string; budgetFcfa: number | null; notes: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(initial);
  const [state, setState] = useState<ButtonState>("idle");
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Modifier ma demande
      </Button>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (state === "loading") return;
    setState("loading");
    setError(null);
    const result = await postAction(access, { action: "edit", payload: JSON.stringify(values) });
    if (!result.ok) {
      setState("error");
      setError(result.message ?? "Modification impossible.");
      return;
    }
    setState("success");
    setOpen(false);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-[12px] border-2 border-chocolat/25 p-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date">
          {({ id }) => <TextInput id={id} type="date" value={values.eventDate} onChange={(e) => setValues({ ...values, eventDate: e.target.value })} />}
        </Field>
        <OhmegatoSelect
          label="Heure"
          value={values.eventTime}
          onValueChange={(eventTime) => setValues({ ...values, eventTime })}
          options={TIMES.map((t) => ({ value: t, label: t.replace(":", " h ") }))}
        />
      </div>
      <Field label="Nombre de personnes">
        {({ id }) => (
          <TextInput id={id} type="number" min={1} className="max-w-40" value={values.guests ?? ""} onChange={(e) => setValues({ ...values, guests: e.target.value ? Number(e.target.value) : null })} />
        )}
      </Field>
      <Field label="Ambiance" optional>
        {({ id }) => <TextArea id={id} rows={2} value={values.ambiance} onChange={(e) => setValues({ ...values, ambiance: e.target.value })} />}
      </Field>
      <Field label="Personnalisation" optional>
        {({ id }) => <TextArea id={id} rows={2} value={values.personalization} onChange={(e) => setValues({ ...values, personalization: e.target.value })} />}
      </Field>
      <Field label="Budget indicatif (FCFA)" optional>
        {({ id }) => (
          <TextInput id={id} type="number" min={0} className="max-w-56" value={values.budgetFcfa ?? ""} onChange={(e) => setValues({ ...values, budgetFcfa: e.target.value ? Number(e.target.value) : null })} />
        )}
      </Field>
      <Field label="Autres précisions" optional>
        {({ id }) => <TextArea id={id} rows={2} value={values.notes} onChange={(e) => setValues({ ...values, notes: e.target.value })} />}
      </Field>
      {error && (
        <p role="alert" className="font-bold text-erreur">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" state={state} loadingLabel="Enregistrement…">
          Enregistrer les modifications
        </Button>
        <Button variant="text" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
