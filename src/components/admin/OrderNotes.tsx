"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addOrderNote } from "@/app/admin/_actions/orders";
import { StateMessage } from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/Button";
import { Field, TextArea } from "@/components/ui/Field";
import type { AdminState } from "@/lib/admin/errors";

/** Ajout d'une note interne : visible de l'équipe seulement. */
export function OrderNoteForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [state, setState] = useState<AdminState>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const result = await addOrderNote(orderId, body);
        setBusy(false);
        setState(result);
        if (result?.ok) {
          setBody("");
          router.refresh();
        }
      }}
    >
      <Field label="Nouvelle note interne" hint="Jamais visible de la cliente.">
        {({ id, describedBy }) => <TextArea id={id} aria-describedby={describedBy} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} rows={3} />}
      </Field>
      <StateMessage state={state} />
      <Button type="submit" variant="secondary" state={busy ? "loading" : "idle"} loadingLabel="Enregistrement…" className="self-start">
        Ajouter la note
      </Button>
    </form>
  );
}
