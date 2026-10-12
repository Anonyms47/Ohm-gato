"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { markNotificationsRead, runAutomationsNow, saveAutomationSettings } from "@/app/admin/_actions/automations";
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
