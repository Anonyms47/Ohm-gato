import Link from "next/link";
import type { MemberOrder } from "@/lib/account/data";
import { cn } from "@/lib/cn";
import { formatShortDay } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { paymentStatusLabel, statusHeadline } from "@/lib/order-status";

/** Commande présentée comme un ticket de caisse OHMEGATO. */
export function OrderTicket({ order, highlight = false }: { order: MemberOrder; highlight?: boolean }) {
  return (
    <Link
      href={`/compte/commandes/${order.reference}`}
      className={cn(
        "ohm-ticket group block px-5 pb-6 pt-5 transition-transform duration-[var(--ohm-duree-courte)] hover:-translate-y-0.5",
        highlight && "outline-2 outline-chocolat",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold tabular-nums">{order.reference}</p>
          <p className="text-encre-douce">
            {formatShortDay(order.createdAt)} · {order.isCustom ? "Sur-mesure" : `Fournée n°${order.cycleNumber}`}
          </p>
        </div>
        <p className="text-right font-bold tabular-nums">{formatFcfa(order.totalFcfa)}</p>
      </div>
      <p className="mt-3 border-t-2 border-dashed border-chocolat/25 pt-3 text-[0.95rem]">
        {order.items
          .slice(0, 3)
          .map((i) => `${i.quantity} × ${i.productName}`)
          .join(" · ")}
        {order.items.length > 3 ? ` · +${order.items.length - 3}` : ""}
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 font-bold">
        <span>{statusHeadline[order.status]}</span>
        <span className="font-normal text-encre-douce">Paiement : {paymentStatusLabel[order.paymentStatus].toLowerCase()}</span>
      </p>
      <span className="mt-2 inline-block font-bold underline decoration-caramel decoration-2 underline-offset-4 group-hover:decoration-chocolat">
        Voir le détail
      </span>
    </Link>
  );
}
