"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { addCustomerNote, deleteCustomerNote } from "@/app/admin/_actions/customers";
import { ActionButton, StateMessage } from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/Button";
import { Field, TextArea } from "@/components/ui/Field";
import type { AdminState } from "@/lib/admin/errors";
import { formatShortDay } from "@/lib/dates";

export function CustomerNotes({ phone, notes }: { phone: string; notes: { id: string; body: string; author: string; createdAt: string }[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [state, setState] = useState<AdminState>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {notes.map((n) => (
          <li key={n.id} className="rounded-[10px] bg-blanc-casse p-3">
            <p className="whitespace-pre-line">{n.body}</p>
            <p className="text-[0.9rem] text-encre-douce">
              {n.author} · {formatShortDay(n.createdAt)}
            </p>
            <ActionButton
              label="Supprimer"
              variant="text"
              run={() => deleteCustomerNote(n.id, phone)}
              confirm={{ title: "Supprimer cette note ?", description: <p>La suppression est inscrite au journal d&apos;audit.</p>, destructive: true }}
            />
          </li>
        ))}
      </ul>
      <Field label="Nouvelle note interne" hint="Jamais visible par le client.">
        {({ id }) => <TextArea id={id} rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />}
      </Field>
      <StateMessage state={state} />
      <Button
        variant="secondary"
        className="self-start"
        state={busy ? "loading" : "idle"}
        onClick={async () => {
          setBusy(true);
          const result = await addCustomerNote(phone, body);
          setBusy(false);
          setState(result);
          if (result?.ok) {
            setBody("");
            router.refresh();
          }
        }}
      >
        Ajouter la note
      </Button>
    </div>
  );
}
