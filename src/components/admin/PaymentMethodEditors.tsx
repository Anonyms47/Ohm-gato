"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { savePaymentMethod } from "@/app/admin/_actions/payments";
import { StateMessage } from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import type { AdminState } from "@/lib/admin/errors";

export interface PaymentMethodView {
  provider: "wave" | "orange_money";
  displayName: string;
  /** Lien enregistré dans l'atelier (vide si absent). */
  link: string;
  /** Wave : lien historique de la configuration du site, utilisé tant qu'aucun lien n'est enregistré ici. */
  fallbackHost: string | null;
  enabled: boolean;
  instructions: string;
  updatedAt: string | null;
  /** Visible par les clientes : activé et lien valide. */
  live: boolean;
}

export function PaymentMethodForm({ method }: { method: PaymentMethodView }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(method.displayName);
  const [link, setLink] = useState(method.link);
  const [enabled, setEnabled] = useState(method.enabled);
  const [instructions, setInstructions] = useState(method.instructions);
  const [state, setState] = useState<AdminState>(null);
  const hasLink = link.trim() !== "" || method.fallbackHost !== null;
  const willBeHidden = enabled && !hasLink;

  const save = async () => {
    const result = await savePaymentMethod({ provider: method.provider, displayName, merchantLink: link, enabled, instructions });
    setState(result);
    if (result?.ok) router.refresh();
    return result;
  };

  return (
    <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-4" data-testid={`moyen-${method.provider}`}>
      <Field label="Nom affiché aux clientes">{({ id }) => <TextInput id={id} value={displayName} maxLength={40} onChange={(e) => setDisplayName(e.target.value)} />}</Field>
      <Field
        label="Lien marchand"
        optional={method.provider === "orange_money"}
        hint={
          method.provider === "wave"
            ? `Lien fourni par Wave (https://pay.wave.com/…).${method.fallbackHost && !link.trim() ? ` Tant qu'aucun lien n'est enregistré ici, le lien de la configuration du site (${method.fallbackHost}) est utilisé.` : ""}`
            : "Lien ou page de paiement marchand fourni par Orange Money. Rien n'est inventé : sans lien, Orange Money reste masqué."
        }
      >
        {({ id, describedBy }) => <TextInput id={id} type="url" inputMode="url" value={link} aria-describedby={describedBy} placeholder="https://" maxLength={400} onChange={(e) => setLink(e.target.value)} />}
      </Field>
      <Field label="Instructions pour la cliente" optional hint="Affichées après le choix du paiement (ex. mention de la référence de commande).">
        {({ id, describedBy }) => <TextArea id={id} rows={3} maxLength={400} aria-describedby={describedBy} value={instructions} onChange={(e) => setInstructions(e.target.value)} />}
      </Field>
      <label className="flex min-h-11 items-center gap-3 font-bold">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-5 accent-chocolat" />
        Activé (proposé aux clientes)
      </label>
      <label className="flex min-h-11 items-center gap-3 text-encre-douce">
        <input type="checkbox" checked disabled className="size-5 accent-chocolat" />
        Vérification manuelle par OHMEGATO (obligatoire : aucune API officielle n&apos;est branchée)
      </label>
      {willBeHidden && (
        <p role="status" className="font-bold text-caramel-encre">
          Activé sans lien : {displayName || method.displayName} restera masqué pour les clientes tant qu&apos;aucun lien marchand n&apos;est enregistré.
        </p>
      )}
      <StateMessage state={state} />
      <ConfirmDialog
        trigger={
          <Button variant="primary" className="self-start">
            Enregistrer
          </Button>
        }
        title={`Enregistrer ${displayName || method.displayName} ?`}
        description={
          <p>
            {enabled && hasLink
              ? `${displayName} sera proposé aux clientes dès maintenant, au même niveau que les autres moyens. Chaque paiement restera à vérifier par OHMEGATO.`
              : enabled
                ? `${displayName} est activé mais restera masqué sans lien marchand.`
                : `${displayName} ne sera plus proposé aux nouvelles commandes. Les commandes déjà passées gardent leur moyen.`}
          </p>
        }
        confirmLabel="Enregistrer"
        variant="primary"
        onConfirm={save}
      />
    </form>
  );
}
