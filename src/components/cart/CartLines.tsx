"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { MAX_LINE_QUANTITY } from "@/lib/cart";
import { lineIssueMessage } from "@/lib/cart-resolve";
import { cn } from "@/lib/cn";
import { formatFcfa } from "@/lib/money";

/** Lignes de « Ma boîte », avec revalidation visible (prix et disponibilités actuels). */
export function CartLines({ compact = false }: { compact?: boolean }) {
  const { resolved, setLineQuantity, remove } = useCart();
  return (
    <ul className="flex flex-col divide-y-2 divide-dashed divide-chocolat/20">
      {resolved.lines.map((l) => {
        const name = l.product?.name ?? "Article retiré de la carte";
        const detail = [l.variant?.label, l.flavor?.name].filter(Boolean).join(" · ");
        return (
          <li key={l.key} className={cn("flex flex-col gap-2", compact ? "py-3" : "py-4")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {l.product ? (
                  <Link href={`/carte/${l.product.slug}`} className="font-bold underline-offset-4 hover:underline">
                    {name}
                  </Link>
                ) : (
                  <span className="font-bold">{name}</span>
                )}
                {detail && <p className="text-encre-douce">{detail}</p>}
              </div>
              <span className="shrink-0 font-bold tabular-nums">{formatFcfa(l.total)}</span>
            </div>
            {l.issue && (
              <p className="rounded-[8px] bg-blanc-casse px-3 py-2 text-[0.95rem] font-bold text-erreur">
                {lineIssueMessage[l.issue]}
              </p>
            )}
            <div className="flex items-center justify-between gap-3">
              {l.variant ? (
                <QuantityStepper
                  value={l.line.quantity}
                  max={MAX_LINE_QUANTITY}
                  onChange={(q) => setLineQuantity(l.key, q)}
                  label={`Quantité de ${name}${detail ? `, ${detail}` : ""}`}
                />
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => remove(l.key)}
                className="min-h-11 px-2 font-bold text-erreur underline decoration-2 underline-offset-4"
              >
                Retirer<span className="sr-only"> {name}</span>
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
