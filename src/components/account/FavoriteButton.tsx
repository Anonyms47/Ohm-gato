"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toggleFavorite } from "@/app/(site)/compte/actions";

/** « Garder en préféré » : réservé aux membres, sinon invitation à se connecter. */
export function FavoriteButton({ productId, productName, initial, signedIn, slug }: { productId: string; productName: string; initial: boolean; signedIn: boolean; slug: string }) {
  const [favorite, setFavorite] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!signedIn) {
    return (
      <Link href={`/connexion?suite=${encodeURIComponent(`/carte/${slug}`)}`} className="inline-flex min-h-11 w-fit items-center font-bold underline decoration-caramel decoration-2 underline-offset-4">
        ♡ Se connecter pour garder en préféré
      </Link>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-pressed={favorite}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const next = !favorite;
            setFavorite(next);
            const result = await toggleFavorite(productId, next);
            if (!result?.ok) {
              setFavorite(!next);
              setError(result?.message ?? "Action impossible.");
            } else setError(null);
          })
        }
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border-2 border-chocolat/40 px-4 font-bold aria-pressed:border-rose-encre aria-pressed:text-rose-encre disabled:opacity-70"
      >
        <span aria-hidden>{favorite ? "♥" : "♡"}</span>
        {favorite ? `${productName} est dans vos préférés` : "Garder en préféré"}
      </button>
      {error && (
        <p role="alert" className="font-bold text-erreur">
          {error}
        </p>
      )}
    </div>
  );
}
