import { notFound } from "next/navigation";
import { PrintButton } from "@/components/admin/PrintButton";
import { brand } from "@/config/brand";
import { getOrderDetail } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/session";
import { formatShortDay, formatSlot, formatTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { paymentStatusLabel } from "@/lib/order-status";
import { providerLabel } from "@/lib/payments/labels";
import { formatSenegalPhone } from "@/lib/phone";

export const metadata = { title: "Reçu" };

/** Reçu imprimable : produits uniquement, frais de livraison réglés à part au livreur. */
export default async function Recu({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const order = await getOrderDetail(id);
  if (!order) notFound();
  const paid = order.payments.find((p) => p.status === "paid");
  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 print:hidden">
        <PrintButton />
      </div>
      <article className="ohm-ticket px-6 py-6 text-[0.95rem] print:shadow-none">
        <p className="text-center font-display text-[1.8rem]">{brand.name}</p>
        <p className="text-center">{brand.pickupAddress}</p>
        <p className="text-center">{brand.phoneDisplay}</p>
        <hr className="my-3 border-dashed border-chocolat/40" />
        <p>
          Reçu <strong>{order.reference}</strong>
        </p>
        <p>
          {formatShortDay(order.createdAt)} {formatTime(order.createdAt)} · {order.customerName} · {formatSenegalPhone(order.customerPhone)}
        </p>
        {order.slot && <p>{order.fulfillment === "pickup" ? "Retrait" : "Livraison"} : {formatSlot(order.slot.startsAt, order.slot.endsAt)}</p>}
        <hr className="my-3 border-dashed border-chocolat/40" />
        <ul>
          {order.items.map((i, index) => (
            <li key={index} className="flex justify-between gap-2 tabular-nums">
              <span>
                {i.quantity} × {i.productName} {i.variantLabel}
                {i.flavorName ? ` (${i.flavorName})` : ""}
              </span>
              <span>{formatFcfa(i.lineTotalFcfa)}</span>
            </li>
          ))}
        </ul>
        <hr className="my-3 border-dashed border-chocolat/40" />
        <p className="flex justify-between font-bold tabular-nums">
          <span>Total produits</span>
          <span>{formatFcfa(order.totalFcfa)}</span>
        </p>
        <p>
          Paiement : {paymentStatusLabel[order.paymentStatus]}
          {paid ? ` · ${providerLabel(paid.provider)}${paid.providerReference ? ` · réf. ${paid.providerReference}` : ""}` : ""}
        </p>
        {order.fulfillment === "delivery" && <p className="mt-2">Frais de livraison non compris, réglés directement au livreur selon la position.</p>}
      </article>
    </div>
  );
}
