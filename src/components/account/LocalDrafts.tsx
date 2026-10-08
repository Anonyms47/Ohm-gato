"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { formatFcfa } from "@/lib/money";

/** Boîte commencée et brouillons gardés sur cet appareil (rien n'est envoyé au serveur). */
export function LocalDrafts() {
  const { resolved, hydrated, setDrawerOpen } = useCart();
  const [drafts, setDrafts] = useState<{ checkout: boolean; custom: { savedAt?: number } | null }>({ checkout: false, custom: null });

  useEffect(() => {
    try {
      const custom = window.localStorage.getItem("ohmegato.sur-mesure.v1");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique du stockage du navigateur
      setDrafts({
        checkout: Boolean(window.localStorage.getItem("ohmegato.bon.v1")),
        custom: custom ? (JSON.parse(custom) as { savedAt?: number }) : null,
      });
    } catch {
      setDrafts({ checkout: false, custom: null });
    }
  }, []);

  if (!hydrated) return <p className="text-encre-douce">Lecture de votre boîte…</p>;
  const nothing = resolved.lines.length === 0 && !drafts.custom;

  return (
    <div className="flex flex-col gap-3">
      {resolved.lines.length > 0 ? (
        <div className="rounded-[12px] bg-blanc-casse p-4">
          <p className="font-bold">
            Boîte commencée · {resolved.itemCount} article{resolved.itemCount > 1 ? "s" : ""} · {formatFcfa(resolved.subtotal)}
          </p>
          {resolved.hasIssues && <p className="text-orange-encre">Certains articles ne sont plus disponibles : vérifiez votre boîte.</p>}
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" onClick={() => setDrawerOpen(true)} className="min-h-11 font-bold underline decoration-caramel decoration-2 underline-offset-4">
              Ouvrir Ma boîte
            </button>
            {drafts.checkout && (
              <Link href="/commande" className="inline-flex min-h-11 items-center font-bold underline decoration-caramel decoration-2 underline-offset-4">
                Reprendre le bon de fournée
              </Link>
            )}
          </div>
        </div>
      ) : null}
      {drafts.custom && (
        <div className="rounded-[12px] bg-blanc-casse p-4">
          <p className="font-bold">Demande sur-mesure en brouillon</p>
          <Link href="/sur-mesure" className="mt-2 inline-flex min-h-11 items-center font-bold underline decoration-caramel decoration-2 underline-offset-4">
            Reprendre ma demande
          </Link>
        </div>
      )}
      {nothing && <p className="text-encre-douce">Aucune boîte ni brouillon en cours sur cet appareil.</p>}
    </div>
  );
}
