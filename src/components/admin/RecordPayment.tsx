"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { markPaymentNotFound, recordPayment } from "@/app/admin/_actions/orders";
import { StateMessage } from "@/components/admin/AdminUi";
import { useToast } from "@/components/admin/Toast";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, TextInput } from "@/components/ui/Field";
import type { AdminState } from "@/lib/admin/errors";
import { formatFcfa } from "@/lib/money";

/**
 * « Paiement Wave reçu » : à utiliser seulement après avoir vu le montant dans l'application Wave.
 * Résumé, confirmation explicite, puis tampon « Paiement vérifié » (le message reste lisible).
 */
export function RecordPayment({
  orderId,
  reference,
  amountFcfa,
  customerName,
  notFoundAt,
}: {
  orderId: string;
  reference: string;
  amountFcfa: number;
  customerName?: string;
  /** Dernière recherche infructueuse, si elle a été notée. */
  notFoundAt?: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [waveRef, setWaveRef] = useState("");
  const [state, setState] = useState<AdminState>(null);
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    const result = await recordPayment(orderId, waveRef);
    setState(result);
    if (result?.ok) {
      setPaid(true);
      // Le message (avec son tampon) reste affiché même quand la commande quitte la file.
      toast({ message: `${reference} : ${result.message}`, tone: "ok", stamp: "Paiement vérifié" });
      router.refresh();
    }
    return result;
  };

  const notFound = async () => {
    setBusy(true);
    const result = await markPaymentNotFound(orderId);
    setBusy(false);
    setState(result);
    if (result?.ok) router.refresh();
  };

  if (paid) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-[12px] border-2 border-succes bg-blanc-casse p-4">
        <span className="ohm-tampon ohm-tampon-pose text-[1.3rem] text-succes" aria-hidden>
          Paiement vérifié
        </span>
        <p className="text-encre-douce">Le reçu PDF est maintenant disponible pour la cliente.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-[12px] border-2 border-wave-encre bg-blanc-casse p-4">
      <p className="font-bold">Paiement Wave à vérifier : {formatFcfa(amountFcfa)}</p>
      <p className="text-encre-douce">
        Vérifiez dans l&apos;application Wave que {formatFcfa(amountFcfa)} est bien reçu pour {reference}. Sans paiement, rien n&apos;est annulé
        automatiquement : contactez la cliente.
      </p>
      {notFoundAt && <p className="text-[0.95rem] font-bold text-caramel-encre">Déjà cherché sans succès le {notFoundAt}.</p>}
      <Field label="Référence de la transaction Wave" optional>
        {({ id }) => <TextInput id={id} value={waveRef} onChange={(e) => setWaveRef(e.target.value)} maxLength={80} />}
      </Field>
      <div className="flex flex-wrap gap-3">
        <ConfirmDialog
          trigger={<Button variant="primary">Paiement Wave reçu</Button>}
          title="Confirmer la réception du paiement ?"
          description={
            <div className="flex flex-col gap-2">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-[8px] bg-creme p-3">
                <dt className="font-bold">Commande</dt>
                <dd>{reference}</dd>
                {customerName && (
                  <>
                    <dt className="font-bold">Cliente</dt>
                    <dd>{customerName}</dd>
                  </>
                )}
                <dt className="font-bold">Montant</dt>
                <dd className="tabular-nums">{formatFcfa(amountFcfa)}</dd>
                <dt className="font-bold">Réf. Wave</dt>
                <dd>{waveRef.trim() || "non renseignée"}</dd>
              </dl>
              <p>La cliente verra sa commande « Payée » et pourra télécharger son reçu. À faire seulement si {formatFcfa(amountFcfa)} est bien arrivé sur le compte Wave.</p>
            </div>
          }
          confirmLabel="Oui, paiement reçu"
          variant="primary"
          onConfirm={confirm}
        />
        <Button variant="secondary" state={busy ? "loading" : "idle"} onClick={() => void notFound()}>
          Introuvable pour le moment
        </Button>
      </div>
      <StateMessage state={state} />
    </div>
  );
}
