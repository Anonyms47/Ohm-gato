"use client";

import { useState } from "react";
import { recordPayment } from "@/app/admin/_actions/orders";
import { ActionButton } from "@/components/admin/AdminUi";
import { Field, TextInput } from "@/components/ui/Field";
import { formatFcfa } from "@/lib/money";

/** « Paiement Wave reçu » : à utiliser seulement après avoir vu le montant dans l'application Wave. */
export function RecordPayment({ orderId, reference, amountFcfa }: { orderId: string; reference: string; amountFcfa: number }) {
  const [waveRef, setWaveRef] = useState("");
  return (
    <div className="flex flex-col gap-3 rounded-[12px] border-2 border-wave-encre bg-blanc-casse p-4">
      <p className="font-bold">Paiement Wave à vérifier : {formatFcfa(amountFcfa)}</p>
      <p className="text-encre-douce">
        Vérifiez dans l&apos;application Wave que {formatFcfa(amountFcfa)} est bien reçu pour {reference}. Sans paiement, annulez la commande : le stock
        est rendu.
      </p>
      <Field label="Référence de la transaction Wave" optional>
        {({ id }) => <TextInput id={id} value={waveRef} onChange={(e) => setWaveRef(e.target.value)} maxLength={80} />}
      </Field>
      <ActionButton
        label="Paiement Wave reçu"
        variant="primary"
        run={() => recordPayment(orderId, waveRef)}
        confirm={{
          title: "Confirmer la réception du paiement ?",
          description: <p>Le client verra sa commande « Payée ». À faire seulement si {formatFcfa(amountFcfa)} est bien arrivé sur le compte Wave.</p>,
          confirmLabel: "Oui, paiement reçu",
        }}
      />
    </div>
  );
}
