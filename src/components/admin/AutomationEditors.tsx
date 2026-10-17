"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { markNotificationsRead, retryEmails, runAutomationsNow, saveAutomationSettings, sendTestEmailAction, skipEmails, testEmailConnectionAction } from "@/app/admin/_actions/automations";
import { ActionButton, AdminForm } from "@/components/admin/AdminUi";
import { Field, TextInput } from "@/components/ui/Field";
import type { AutomationSettings } from "@/lib/admin/automation-settings";

export function AutomationSettingsForm({ settings }: { settings: AutomationSettings }) {
  return (
    <AdminForm action={saveAutomationSettings} submitLabel="Enregistrer les réglages">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Paiement Wave en attente (heures)" hint="Au-delà, il devient urgent dans « Aujourd'hui ».">
          {({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} name="paymentAlertHours" type="number" min={1} max={240} required defaultValue={settings.paymentAlertHours} />}
        </Field>
        <Field label="Demande sur mesure sans réponse (heures)" hint="Au-delà, elle est signalée.">
          {({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} name="customAnswerHours" type="number" min={1} max={240} required defaultValue={settings.customAnswerHours} />}
        </Field>
        <Field label="Rappel avant un créneau (heures)" hint="Commandes payées pas encore prêtes avant leur créneau.">
          {({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} name="slotReminderHours" type="number" min={1} max={72} required defaultValue={settings.slotReminderHours} />}
        </Field>
      </div>
      <label className="flex min-h-11 items-center gap-3 font-bold">
        <input type="checkbox" name="customerEmails" defaultChecked={settings.customerEmails} className="size-5 accent-chocolat" />
        E-mails automatiques aux clientes (commande enregistrée, paiement confirmé, prête, en route, annulée, remboursée)
      </label>
      <label className="flex min-h-11 items-center gap-3 font-bold">
        <input type="checkbox" name="dailyDigest" defaultChecked={settings.dailyDigest} className="size-5 accent-chocolat" />
        Résumé quotidien des actions par e-mail à l&apos;équipe
      </label>
    </AdminForm>
  );
}

export function RunAutomationsButton() {
  return <ActionButton label="Mettre l'atelier à jour maintenant" run={runAutomationsNow} />;
}

export function MarkAllRead() {
  return <ActionButton label="Tout marquer comme lu" variant="text" run={() => markNotificationsRead()} />;
}

/** Ouvre l'élément concerné et marque la notification comme lue. */
export function NotificationLink({ id, href, children, unread }: { id: number; href: string; children: React.ReactNode; unread: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Link
      href={href}
      aria-disabled={busy}
      onClick={async (e) => {
        if (!unread) return;
        e.preventDefault();
        setBusy(true);
        await markNotificationsRead(id).catch(() => null);
        router.push(href);
      }}
      className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[10px] bg-chocolat px-4 font-bold text-creme"
    >
      {children}
    </Link>
  );
}

export function TestEmailConnectionButton() {
  return <ActionButton label="Tester la connexion" run={testEmailConnectionAction} />;
}

/** Envoi réel d'un e-mail d'essai à l'adresse de la marque, après confirmation. */
export function SendTestEmailButton({ to }: { to: string }) {
  return (
    <ActionButton
      label="Envoyer un e-mail d'essai"
      run={sendTestEmailAction}
      confirm={{ title: "Envoyer un e-mail d'essai ?", description: <p>Un e-mail d&apos;essai part vers {to}. Aucune cliente ne le reçoit.</p>, confirmLabel: "Envoyer" }}
    />
  );
}

export interface EmailIssueRow {
  id: number;
  title: string;
  detail: string;
  href: string | null;
}

/** Messages en pause ou en échec : reprise ou abandon, uniquement sur sélection et après confirmation. */
export function EmailIssueList({ issues }: { issues: EmailIssueRow[] }) {
  const [selected, setSelected] = useState<number[]>([]);
  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const n = selected.length;
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {issues.map((issue) => (
          <li key={issue.id} className="flex items-start gap-3 rounded-[10px] border border-chocolat/15 bg-creme/60 p-3">
            <input
              type="checkbox"
              id={`email-${issue.id}`}
              checked={selected.includes(issue.id)}
              onChange={() => toggle(issue.id)}
              className="mt-1 size-5 shrink-0 accent-chocolat"
            />
            <label htmlFor={`email-${issue.id}`} className="min-w-0 flex-1">
              <span className="block font-bold">{issue.title}</span>
              <span className="block text-encre-douce">{issue.detail}</span>
            </label>
            {issue.href && (
              <Link href={issue.href} className="shrink-0 font-bold underline decoration-caramel decoration-2 underline-offset-4">
                Commande
              </Link>
            )}
          </li>
        ))}
      </ul>
      <p className="text-encre-douce" aria-live="polite">
        {n === 0 ? "Cochez les messages à reprendre ou à abandonner." : `${n} message${n > 1 ? "s" : ""} sélectionné${n > 1 ? "s" : ""}.`}
      </p>
      {n > 0 && (
        <div className="flex flex-wrap gap-3">
          <ActionButton
            label="Réessayer les messages sélectionnés"
            variant="primary"
            run={async () => {
              const r = await retryEmails(selected);
              if (r?.ok) setSelected([]);
              return r;
            }}
            confirm={{
              title: `Renvoyer ${n} message${n > 1 ? "s" : ""} ?`,
              description: "Chaque message part une seule fois, avec son identifiant d'origine. Vérifiez d'abord que le service d'envoi fonctionne (« Tester la connexion »).",
              confirmLabel: "Renvoyer",
            }}
          />
          <ActionButton
            label="Ne pas envoyer"
            variant="text"
            run={async () => {
              const r = await skipEmails(selected);
              if (r?.ok) setSelected([]);
              return r;
            }}
            confirm={{
              title: `Abandonner ${n} message${n > 1 ? "s" : ""} ?`,
              description: "Ils ne partiront jamais. La cliente garde son lien personnel de suivi ; contactez-la par téléphone ou WhatsApp si besoin.",
              confirmLabel: "Abandonner",
              destructive: true,
            }}
          />
        </div>
      )}
    </div>
  );
}
