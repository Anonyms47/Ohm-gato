"use client";

import { useState } from "react";
import { grantRole, removeStoryMedia, revokeRole, saveTextSetting, uploadStoryMedia } from "@/app/admin/_actions/settings";
import { ActionButton, AdminForm, StateMessage } from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/Button";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { OhmegatoSelect } from "@/components/ui/select/OhmegatoSelect";
import type { AdminState } from "@/lib/admin/errors";

export function TextSetting({ settingKey, label, hint, initial }: { settingKey: string; label: string; hint: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<AdminState>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <Field label={label} hint={hint} optional>
        {({ id }) => <TextArea id={id} rows={3} maxLength={600} value={value} onChange={(e) => setValue(e.target.value)} />}
      </Field>
      <StateMessage state={state} />
      <Button
        variant="secondary"
        className="self-start"
        state={busy ? "loading" : "idle"}
        onClick={async () => {
          setBusy(true);
          setState(await saveTextSetting(settingKey, value));
          setBusy(false);
        }}
      >
        Enregistrer
      </Button>
    </div>
  );
}

export function StoryMediaUpload() {
  const [kind, setKind] = useState("archive");
  return (
    <AdminForm action={uploadStoryMedia} submitLabel="Ajouter à « Notre histoire »" className="rounded-[12px] border-2 border-dashed border-chocolat/30 p-4">
      <input type="hidden" name="kind" value={kind} />
      <OhmegatoSelect
        label="Type de média"
        value={kind}
        onValueChange={setKind}
        options={[
          { value: "archive", label: "Photographie d'archives" },
          { value: "alima", label: "Photo d'Alima ou de ses mains" },
          { value: "audio", label: "Court audio (avec transcription)" },
        ]}
      />
      <Field label="Fichier" hint={kind === "audio" ? "MP3, M4A ou OGG, 10 Mo maximum. Jamais de lecture automatique." : "WebP, PNG ou JPEG, 10 Mo maximum."}>
        {({ id }) => <input id={id} name="file" type="file" required accept={kind === "audio" ? "audio/mpeg,audio/mp4,audio/ogg" : "image/webp,image/png,image/jpeg"} className="min-h-11" />}
      </Field>
      {kind === "audio" ? (
        <Field label="Transcription">{({ id }) => <TextArea id={id} name="transcript" rows={4} required />}</Field>
      ) : (
        <>
          <Field label="Description de la photo (texte alternatif)">{({ id }) => <TextInput id={id} name="alt" required maxLength={200} />}</Field>
          <Field label="Légende" optional>{({ id }) => <TextInput id={id} name="caption" maxLength={160} />}</Field>
        </>
      )}
    </AdminForm>
  );
}

export function RemoveMedia({ kind, url, label }: { kind: "archive" | "alima" | "audio"; url: string | null; label: string }) {
  return (
    <ActionButton
      label={`Retirer ${label}`}
      variant="text"
      run={() => removeStoryMedia(kind, url)}
      confirm={{ title: `Retirer ${label} ?`, description: <p>Le média ne sera plus affiché sur « Notre histoire ».</p>, destructive: true }}
    />
  );
}

export function RolesEditor({ staff, currentUserId }: { staff: { userId: string; role: "admin" | "courier"; name: string }[]; currentUserId: string }) {
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("admin");
  const [state, setState] = useState<AdminState>(null);
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {staff.map((s) => (
          <li key={`${s.userId}-${s.role}`} className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] bg-blanc-casse p-3">
            <span>
              <strong>{s.name}</strong> · {s.role === "admin" ? "Administrateur" : "Livreur"}
              {s.userId === currentUserId ? " (vous)" : ""}
            </span>
            <ActionButton
              label="Retirer le rôle"
              variant="text"
              run={() => revokeRole(s.userId, s.role)}
              confirm={{ title: "Retirer ce rôle ?", description: <p>{s.name} perdra l&apos;accès correspondant immédiatement.</p>, destructive: true }}
            />
          </li>
        ))}
      </ul>
      <div className="grid gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
        <Field label="Téléphone du compte" hint="La personne doit s'être connectée une fois.">
          {({ id }) => <TextInput id={id} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}
        </Field>
        <OhmegatoSelect
          label="Rôle"
          value={role}
          onValueChange={setRole}
          options={[
            { value: "admin", label: "Administrateur" },
            { value: "courier", label: "Livreur" },
          ]}
        />
        <ActionButton
          label="Attribuer le rôle"
          variant="primary"
          run={async () => {
            const result = await grantRole(phone, role);
            setState(result);
            return result;
          }}
          confirm={{ title: "Attribuer ce rôle ?", description: <p>Un administrateur peut tout gérer, y compris les rôles.</p>, confirmLabel: "Attribuer" }}
        />
      </div>
      <StateMessage state={state} />
    </div>
  );
}
