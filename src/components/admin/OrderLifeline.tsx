import { lifeline } from "@/lib/admin/order-stage";
import { cn } from "@/lib/cn";
import type { Fulfillment, OrderStatus, PaymentStatus } from "@/lib/order-status";

/** Ligne de vie complète d'une commande, de la réception à la remise. */
export function OrderLifeline({ status, paymentStatus, fulfillment }: { status: OrderStatus; paymentStatus: PaymentStatus; fulfillment: Fulfillment }) {
  const steps = lifeline(status, paymentStatus, fulfillment);
  const cancelled = steps.every((s, i) => i === 0 || s.state === "skipped");
  const currentIndex = steps.findIndex((s) => s.state === "current");
  const reached = currentIndex >= 0 ? currentIndex : steps.filter((s) => s.state === "done").length - 1;
  return (
    <>
    {/* Téléphone : une barre compacte et l'étape en toutes lettres. */}
    <div className="flex flex-col gap-2 sm:hidden">
      <p className="font-bold">
        Étape {reached + 1} sur {steps.length} : {steps[reached]?.label}
      </p>
      <span aria-hidden className="flex gap-1">
        {steps.map((s) => (
          <span key={s.key} className={cn("h-2 flex-1 rounded-full", s.state === "done" ? "bg-chocolat" : s.state === "current" ? "bg-caramel" : s.state === "skipped" ? "bg-erreur/25" : "bg-chocolat/15")} />
        ))}
      </span>
    </div>
    <ol aria-label="Parcours de la commande" className="hidden gap-2 sm:grid sm:grid-cols-7">
      {steps.map((s, i) => (
        <li
          key={s.key}
          aria-current={s.state === "current" ? "step" : undefined}
          className={cn(
            "atelier-glisse flex items-center gap-2 rounded-[8px] border-2 px-3 py-2 text-[0.92rem] font-bold sm:flex-col sm:items-start sm:gap-1",
            s.state === "done" && "border-chocolat bg-chocolat text-creme",
            s.state === "current" && "border-caramel bg-rose/50",
            s.state === "todo" && "border-dashed border-chocolat/25 text-encre-douce",
            s.state === "skipped" && "border-dashed border-erreur/30 text-encre-douce line-through",
          )}
        >
          <span aria-hidden className="tabular-nums">{s.state === "done" ? "✓" : i + 1}</span>
          <span>{s.label}</span>
        </li>
      ))}
    </ol>
    {cancelled && <p className="font-bold text-erreur">Commande arrêtée : voir l&apos;historique pour le motif.</p>}
    </>
  );
}
