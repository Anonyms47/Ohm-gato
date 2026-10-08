"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { handToCourier, setOrderStatus } from "@/app/admin/_actions/orders";
import { StateMessage } from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, TextInput } from "@/components/ui/Field";
import type { AdminState } from "@/lib/admin/errors";
import { statusHeadline, type Fulfillment, type OrderStatus, type PaymentStatus } from "@/lib/order-status";

function nextStatuses(status: OrderStatus, fulfillment: Fulfillment, payment: PaymentStatus): OrderStatus[] {
  switch (status) {
    case "pending_payment":
      return ["cancelled"];
    case "confirmed":
      return ["preparing", "cancelled"];
    case "preparing":
      return ["finishing", "ready", "cancelled"];
    case "finishing":
      return ["ready", "cancelled"];
    case "ready":
      return fulfillment === "delivery" ? ["out_for_delivery", "cancelled"] : ["picked_up", "cancelled"];
    case "out_for_delivery":
      return ["delivered", "ready"];
    case "needs_attention":
      return ["confirmed", "cancelled", "refunded"];
    case "cancelled":
      return payment === "paid" ? ["refunded"] : [];
    default:
      return [];
  }
}

const label: Partial<Record<OrderStatus, string>> = {
  preparing: "Passer en préparation",
  finishing: "Cuisson et finitions",
  ready: "Marquer prête",
  out_for_delivery: "Confier au livreur",
  delivered: "Livraison terminée",
  picked_up: "Retrait effectué",
  confirmed: "Confirmer la commande",
  cancelled: "Annuler la commande",
  refunded: "Remboursement effectué",
};

/** Mise à jour du statut : seules les transitions possibles sont proposées ; le serveur revérifie. */
export function OrderStatusActions({ orderId, status, fulfillment, paymentStatus }: { orderId: string; status: OrderStatus; fulfillment: Fulfillment; paymentStatus: PaymentStatus }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [courier, setCourier] = useState({ name: "", phone: "" });
  const [state, setState] = useState<AdminState>(null);
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const options = nextStatuses(status, fulfillment, paymentStatus);
  if (options.length === 0) return <p className="text-encre-douce">Aucun changement possible depuis « {statusHeadline[status]} ».</p>;

  const run = async (to: OrderStatus) => {
    if (busy) return null;
    setBusy(to);
    const result = to === "out_for_delivery" ? await handToCourier(orderId, courier.name, courier.phone) : await setOrderStatus(orderId, to, note);
    setBusy(null);
    setState(result);
    if (result?.ok) {
      setNote("");
      router.refresh();
    }
    return result;
  };

  return (
    <div className="flex flex-col gap-4">
      <Field label="Note (historique)" optional>
        {({ id }) => <TextInput id={id} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />}
      </Field>
      {options.includes("out_for_delivery") && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Livreur" optional>
            {({ id }) => <TextInput id={id} value={courier.name} onChange={(e) => setCourier({ ...courier, name: e.target.value })} />}
          </Field>
          <Field label="Numéro du livreur" optional>
            {({ id }) => <TextInput id={id} type="tel" value={courier.phone} onChange={(e) => setCourier({ ...courier, phone: e.target.value })} />}
          </Field>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        {options.map((to) =>
          to === "cancelled" || to === "refunded" ? (
            <ConfirmDialog
              key={to}
              trigger={<Button variant="destructive">{label[to]}</Button>}
              title={`${label[to]} ?`}
              description={
                <p>
                  {to === "cancelled"
                    ? paymentStatus === "paid"
                      ? "La commande payée sera annulée et ses unités remises en stock. Le remboursement est à faire auprès du client, puis à marquer ici."
                      : "La commande sera annulée et son stock réservé libéré."
                    : "Confirmez que le client a bien été remboursé (Wave / Orange Money)."}
                </p>
              }
              confirmLabel={label[to]!}
              onConfirm={() => run(to)}
            />
          ) : (
            <Button
              key={to}
              variant={to === options[0] ? "primary" : "secondary"}
              state={busy === to ? "loading" : "idle"}
              disabled={busy !== null && busy !== to}
              onClick={() => void run(to)}
            >
              {label[to]}
            </Button>
          ),
        )}
      </div>
      <StateMessage state={state} />
    </div>
  );
}
