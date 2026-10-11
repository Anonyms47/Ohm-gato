"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import { DELIVERY_FEE_NOTICE } from "@/components/checkout/DeliveryFeeNotice";
import { formatFcfa } from "@/lib/money";

function Lines() {
  const { resolved } = useCart();
  return (
    <>
      <ul className="flex flex-col divide-y-2 divide-dashed divide-chocolat/15">
        {resolved.lines.map((l) => (
          <li key={l.key} className="flex items-baseline justify-between gap-3 py-2.5">
            <span className="min-w-0">
              <span className="font-bold">{l.product?.name ?? "Article retiré"}</span>
              <span className="block text-[0.95rem] text-encre-douce">
                {l.line.quantity} × {l.variant?.label}
                {l.flavor && <> · {l.flavor.name}</>}
              </span>
            </span>
            <span className="shrink-0 tabular-nums">{formatFcfa(l.total)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex items-baseline justify-between border-t-2 border-chocolat/20 pt-3">
        <span className="font-bold">Sous-total</span>
        <span className="font-display text-[1.6rem] tabular-nums">{formatFcfa(resolved.subtotal)}</span>
      </p>
      <p className="mt-1 text-[0.95rem] text-encre-douce">{DELIVERY_FEE_NOTICE}</p>
      <Link href="/ma-boite" className="mt-3 inline-flex min-h-11 items-center font-bold underline decoration-caramel decoration-2 underline-offset-4">
        Modifier ma boîte
      </Link>
    </>
  );
}

/**
 * Récapitulatif de la boîte pendant le bon de fournée : toujours visible sur grand écran,
 * repliable en haut de page sur téléphone. Affichage seul : le serveur recalcule tout.
 */
export function CheckoutSummary({ variant }: { variant: "mobile" | "desktop" }) {
  const { resolved, hydrated } = useCart();
  if (!hydrated || resolved.lines.length === 0) return null;

  if (variant === "mobile") {
    return (
      <details className="group mt-6 rounded-[12px] border-2 border-chocolat/20 bg-blanc-casse lg:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 font-bold [&::-webkit-details-marker]:hidden">
          <span>
            Votre boîte · {resolved.itemCount} article{resolved.itemCount > 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-2 tabular-nums">
            {formatFcfa(resolved.subtotal)}
            <span aria-hidden className="transition-transform duration-[var(--ohm-duree-courte)] group-open:rotate-180">
              ⌄
            </span>
          </span>
        </summary>
        <div className="px-4 pb-4">
          <Lines />
        </div>
      </details>
    );
  }

  return (
    <aside aria-labelledby="recap-boite" className="hidden rounded-[14px] border-2 border-chocolat/20 bg-blanc-casse p-5 lg:sticky lg:top-24 lg:block lg:self-start">
      <h2 id="recap-boite" className="font-display text-[1.5rem]">
        Votre boîte
      </h2>
      <div className="mt-2">
        <Lines />
      </div>
    </aside>
  );
}
