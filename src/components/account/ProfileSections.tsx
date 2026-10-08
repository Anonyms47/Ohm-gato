"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { FormProvider, useForm } from "react-hook-form";
import {
  deleteAccount,
  deleteAddress,
  revokeSession,
  saveAddress,
  savePreferences,
  signOutEverywhereElse,
  toggleFavorite,
  updateProfile,
} from "@/app/(site)/compte/actions";
import { DeliveryFields, type SavedAddress } from "@/components/checkout/DeliveryFields";
import { Button, type ButtonState } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, TextInput } from "@/components/ui/Field";
import { OhmegatoSelect } from "@/components/ui/select/OhmegatoSelect";
import type { MemberAddress, MemberProfile, MemberSession } from "@/lib/account/data";
import { formatShortDay, formatTime } from "@/lib/dates";
import { formatSenegalPhone } from "@/lib/phone";
import { deliverySchema } from "@/lib/validation/checkout";

function Notice({ state }: { state: { ok: boolean; message: string } | null }) {
  if (!state) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={state.ok ? "font-bold text-succes" : "font-bold text-erreur"}>
      {state.message}
    </p>
  );
}

export function ContactSection({ profile }: { profile: MemberProfile }) {
  const [state, action, pending] = useActionState(updateProfile, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Nom">
        {({ id }) => <TextInput id={id} name="fullName" autoComplete="name" defaultValue={profile.fullName ?? ""} maxLength={80} />}
      </Field>
      <dl className="grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="font-bold">Téléphone vérifié</dt>
          <dd>{profile.phone ? formatSenegalPhone(profile.phone) : "—"}</dd>
        </div>
        <div>
          <dt className="font-bold">E-mail vérifié</dt>
          <dd className="break-all">{profile.email ?? "—"}</dd>
        </div>
      </dl>
      <p className="text-[0.95rem] text-encre-douce">Le téléphone et l&apos;e-mail sont ceux utilisés pour vous connecter avec un code.</p>
      <Notice state={state} />
      <Button type="submit" state={pending ? "loading" : "idle"} loadingLabel="Enregistrement…" className="self-start">
        Enregistrer mes coordonnées
      </Button>
    </form>
  );
}

interface AddressFormValues {
  label: string;
  isDefault: boolean;
  delivery: {
    district: string;
    addressLine: string;
    landmark: string;
    floorDoor: string;
    recipientName: string;
    recipientPhone: string;
    instructions: string;
    latitude: number | null;
    longitude: number | null;
  };
}

function AddressForm({ address, onDone }: { address: MemberAddress | null; onDone: () => void }) {
  const methods = useForm<AddressFormValues>({
    defaultValues: {
      label: address?.label ?? "",
      isDefault: address?.isDefault ?? false,
      delivery: {
        district: address?.district ?? "",
        addressLine: address?.addressLine ?? "",
        landmark: address?.landmark ?? "",
        floorDoor: address?.floorDoor ?? "",
        recipientName: address?.recipientName ?? "",
        recipientPhone: address?.recipientPhone ? formatSenegalPhone(address.recipientPhone) : "",
        instructions: address?.instructions ?? "",
        latitude: address?.latitude ?? null,
        longitude: address?.longitude ?? null,
      },
    },
  });
  const [state, setState] = useState<ButtonState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const submit = methods.handleSubmit(async (values) => {
    methods.clearErrors();
    const parsed = deliverySchema.safeParse(values.delivery);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) methods.setError(`delivery.${issue.path.join(".")}` as never, { message: issue.message });
      setMessage("Certaines informations sont à corriger.");
      return;
    }
    setState("loading");
    const result = await saveAddress({ ...values.delivery, id: address?.id, label: values.label, isDefault: values.isDefault });
    if (!result?.ok) {
      setState("error");
      setMessage(result?.message ?? "Enregistrement impossible.");
      return;
    }
    setState("success");
    onDone();
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5 rounded-[12px] border-2 border-chocolat/25 bg-blanc-casse p-4">
        <Field label="Nom de l'adresse" optional hint="Ex. Maison, Bureau">
          {({ id }) => <TextInput id={id} maxLength={40} {...methods.register("label")} />}
        </Field>
        <DeliveryFields />
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className="size-5 accent-[var(--ohm-chocolat)]" {...methods.register("isDefault")} />
          Adresse par défaut
        </label>
        {message && state !== "success" && (
          <p role="alert" className="font-bold text-erreur">
            {message}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" state={state} loadingLabel="Enregistrement…">
            Enregistrer l&apos;adresse
          </Button>
          <Button variant="text" onClick={onDone}>
            Annuler
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}

export function AddressSection({ addresses }: { addresses: MemberAddress[] }) {
  const [editing, setEditing] = useState<MemberAddress | "new" | null>(null);
  return (
    <div className="flex flex-col gap-4">
      {addresses.length === 0 && editing === null && <p className="text-encre-douce">Aucune adresse enregistrée.</p>}
      <ul className="grid gap-3 sm:grid-cols-2">
        {addresses.map((a) => (
          <li key={a.id} className="flex flex-col gap-2 rounded-[12px] bg-blanc-casse p-4">
            <p className="font-bold">
              {a.label || a.addressLine} {a.isDefault && <span className="font-normal text-encre-douce">· par défaut</span>}
            </p>
            <p>
              {a.addressLine}
              {a.district ? `, ${a.district}` : ""}
            </p>
            {a.landmark && <p className="text-encre-douce">Repère : {a.landmark}</p>}
            <p className="text-encre-douce">
              {a.recipientName} · {formatSenegalPhone(a.recipientPhone)}
            </p>
            {a.latitude !== null && a.longitude !== null ? (
              <a
                href={`https://www.openstreetmap.org/?mlat=${a.latitude}&mlon=${a.longitude}#map=18/${a.latitude}/${a.longitude}`}
                className="font-bold underline decoration-caramel decoration-2 underline-offset-4"
                target="_blank"
                rel="noreferrer"
              >
                Position enregistrée ({a.latitude.toFixed(5)}, {a.longitude.toFixed(5)})
              </a>
            ) : (
              <p className="text-orange-encre">Position non enregistrée</p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button variant="text" onClick={() => setEditing(a)}>
                Modifier
              </Button>
              <ConfirmDialog
                trigger={<Button variant="text">Supprimer</Button>}
                title="Supprimer cette adresse ?"
                description={<p>{a.label || a.addressLine} sera retirée de votre carnet. Les commandes déjà passées ne changent pas.</p>}
                confirmLabel="Supprimer l'adresse"
                onConfirm={() => deleteAddress(a.id)}
              />
            </div>
          </li>
        ))}
      </ul>
      {editing ? (
        <AddressForm address={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
      ) : (
        <Button variant="secondary" className="self-start" onClick={() => setEditing("new")}>
          Ajouter une adresse
        </Button>
      )}
    </div>
  );
}

export function FavoritesSection({ favorites }: { favorites: { id: string; name: string; slug: string }[] }) {
  const [pending, startTransition] = useTransition();
  if (favorites.length === 0) {
    return (
      <p className="text-encre-douce">
        Aucun produit préféré. Touchez « Garder en préféré » sur une{" "}
        <Link href="/carte" className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
          fiche produit
        </Link>
        .
      </p>
    );
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {favorites.map((f) => (
        <li key={f.id} className="flex items-center gap-1 rounded-full border-2 border-chocolat/30 bg-blanc-casse pl-4">
          <Link href={`/carte/${f.slug}`} className="font-bold">
            {f.name}
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => void toggleFavorite(f.id, false))}
            className="grid size-11 place-items-center rounded-full"
            aria-label={`Retirer ${f.name} de mes préférés`}
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}

export function PreferencesSection({ profile }: { profile: MemberProfile }) {
  const [values, setValues] = useState({
    newCycle: profile.preferences.newCycle,
    orderUpdates: profile.preferences.orderUpdates,
    channel: profile.preferences.channel,
    marketingConsent: profile.marketingConsent,
  });
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => setState(await savePreferences(values)));
      }}
    >
      <fieldset id="alertes" className="flex flex-col gap-2">
        <legend className="mb-2 font-bold">Alertes</legend>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className="size-5 accent-[var(--ohm-chocolat)]" checked={values.newCycle} onChange={(e) => setValues({ ...values, newCycle: e.target.checked })} />
          Me prévenir quand une nouvelle fournée ouvre
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            className="size-5 accent-[var(--ohm-chocolat)]"
            checked={values.orderUpdates}
            onChange={(e) => setValues({ ...values, orderUpdates: e.target.checked })}
          />
          Recevoir le suivi de mes commandes
        </label>
      </fieldset>
      <OhmegatoSelect
        label="Canal préféré"
        value={values.channel}
        onValueChange={(channel) => setValues({ ...values, channel: channel as typeof values.channel })}
        options={[
          { value: "whatsapp", label: "WhatsApp" },
          { value: "sms", label: "SMS" },
          { value: "email", label: "E-mail" },
        ]}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-bold">Consentements</legend>
        <label className="flex min-h-11 items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 size-5 accent-[var(--ohm-chocolat)]"
            checked={values.marketingConsent}
            onChange={(e) => setValues({ ...values, marketingConsent: e.target.checked })}
          />
          J&apos;accepte de recevoir des nouvelles d&apos;OHMEGATO (fournées, événements). Révocable à tout moment.
        </label>
        {profile.consentsUpdatedAt && <p className="text-[0.95rem] text-encre-douce">Dernière modification le {formatShortDay(profile.consentsUpdatedAt)}.</p>}
      </fieldset>
      <p className="text-[0.95rem] text-encre-douce">Les envois se font dès que le canal est activé par OHMEGATO ; vos choix sont enregistrés dès maintenant.</p>
      <Notice state={state} />
      <Button type="submit" state={pending ? "loading" : "idle"} loadingLabel="Enregistrement…" className="self-start">
        Enregistrer mes préférences
      </Button>
    </form>
  );
}

function deviceName(userAgent: string | null): string {
  if (!userAgent) return "Appareil inconnu";
  const os = /Android/i.test(userAgent) ? "Android" : /iPhone|iPad/i.test(userAgent) ? "iPhone / iPad" : /Windows/i.test(userAgent) ? "Windows" : /Mac OS/i.test(userAgent) ? "Mac" : /Linux/i.test(userAgent) ? "Linux" : "Appareil";
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Chrome\//.test(userAgent) ? "Chrome" : /Firefox\//.test(userAgent) ? "Firefox" : /Safari\//.test(userAgent) ? "Safari" : "Navigateur";
  return `${browser} sur ${os}`;
}

export function SessionsSection({ sessions }: { sessions: MemberSession[] }) {
  const [message, setMessage] = useState<{ ok: boolean; message: string } | null>(null);
  const others = sessions.filter((s) => !s.current);
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {sessions.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] bg-blanc-casse p-3">
            <div>
              <p className="font-bold">
                {deviceName(s.userAgent)} {s.current && <span className="font-normal text-succes">· cet appareil</span>}
              </p>
              <p className="text-[0.95rem] text-encre-douce">
                Dernière activité : {formatShortDay(s.updatedAt ?? s.createdAt)} {formatTime(s.updatedAt ?? s.createdAt)}
              </p>
            </div>
            {!s.current && (
              <ConfirmDialog
                trigger={<Button variant="text">Fermer</Button>}
                title="Fermer cette session ?"
                description={<p>{deviceName(s.userAgent)} devra se reconnecter avec un code.</p>}
                confirmLabel="Fermer la session"
                onConfirm={async () => {
                  const result = await revokeSession(s.id);
                  setMessage(result);
                  return result;
                }}
              />
            )}
          </li>
        ))}
      </ul>
      {others.length > 0 && (
        <ConfirmDialog
          trigger={<Button variant="secondary" className="self-start">Déconnecter les autres appareils</Button>}
          title="Déconnecter les autres appareils ?"
          description={<p>Seul cet appareil restera connecté.</p>}
          confirmLabel="Déconnecter les autres appareils"
          onConfirm={async () => {
            const result = await signOutEverywhereElse();
            setMessage(result);
            return result;
          }}
        />
      )}
      <Notice state={message} />
    </div>
  );
}

export function DataSection() {
  const [state, action, pending] = useActionState(deleteAccount, null);
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <a
        href="/api/compte/export"
        className="inline-flex min-h-12 w-fit items-center rounded-[10px] border-2 border-chocolat px-5 font-bold"
        download
      >
        Télécharger mes données (JSON)
      </a>
      {open ? (
        <form action={action} className="flex flex-col gap-3 rounded-[12px] border-2 border-erreur bg-blanc-casse p-4">
          <p>
            La suppression efface votre carnet : profil, adresses, positions, préférés et préférences. Vos commandes passées restent chez OHMEGATO
            pour sa comptabilité, sans lien avec un compte. Cette action est définitive.
          </p>
          <Field label="Écrivez SUPPRIMER pour confirmer" error={state && !state.ok ? state.message : undefined}>
            {({ id, describedBy, invalid }) => <TextInput id={id} name="confirmation" autoComplete="off" aria-describedby={describedBy} aria-invalid={invalid} />}
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="destructive" state={pending ? "loading" : "idle"} loadingLabel="Suppression…">
              Supprimer définitivement mon compte
            </Button>
            <Button variant="text" onClick={() => setOpen(false)}>
              Annuler
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="destructive" className="self-start" onClick={() => setOpen(true)}>
          Supprimer mon compte
        </Button>
      )}
    </div>
  );
}

export type { SavedAddress };
