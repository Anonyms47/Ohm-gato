"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import { CartLines } from "@/components/cart/CartLines";
import { ButtonLink } from "@/components/ui/Button";
import { formatDay, formatTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";

export function BoxPage() {
  const { resolved, hydrated, catalog, clear } = useCart();
  if (!hydrated) {
    return <p className="mt-6 text-encre-douce" aria-busy="true">Ouverture de votre boîte…</p>;
  }
  if (resolved.lines.length === 0) {
    return (
      <div className="mt-8">
        <p className="text-[1.15rem]">Votre boîte est vide.</p>
        <Link href="/carte" className="mt-3 inline-flex min-h-11 items-center font-bold underline decoration-caramel decoration-2 underline-offset-4">
          Voir la carte
        </Link>
      </div>
    );
  }
  const cycle = catalog.cycle;
  return (
    <div className="mt-6 flex flex-col gap-6">
      {cycle && (
        <p className="text-encre-douce">
          {cycle.isOpen
            ? `Fournée n°${cycle.number} — commandes jusqu'au ${formatDay(cycle.closesAt)}, ${formatTime(cycle.closesAt)}.`
            : "Les commandes sont fermées : votre boîte est conservée pour la prochaine fournée."}
        </p>
      )}
      {resolved.fromOtherCycle && (
        <p role="status" className="rounded-[10px] border-2 border-orange-encre bg-blanc-casse p-3 font-bold text-orange-encre">
          Cette boîte a été composée pour une fournée précédente : prix et disponibilités ont été mis à jour.
        </p>
      )}
      <div className="rounded-[12px] border-2 border-chocolat/20 bg-blanc-casse px-4 sm:px-6">
        <CartLines />
      </div>
      <div className="flex items-baseline justify-between">
        <span className="font-bold">Sous-total</span>
        <span className="font-display text-[2rem] tabular-nums">{formatFcfa(resolved.subtotal)}</span>
      </div>
      <p className="-mt-4 text-encre-douce">La livraison s&apos;ajoute selon votre quartier ; le retrait est gratuit.</p>
      {resolved.hasIssues && (
        <p role="alert" className="font-bold text-erreur">
          Corrigez les articles signalés avant de passer commande.
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={clear} className="min-h-11 self-start font-bold text-erreur underline decoration-2 underline-offset-4">
          Vider ma boîte
        </button>
        {resolved.hasIssues || !cycle?.isOpen ? (
          <span className="text-encre-douce">Commande impossible pour le moment.</span>
        ) : (
          <ButtonLink href="/commande">Remplir le bon de fournée</ButtonLink>
        )}
      </div>
    </div>
  );
}
