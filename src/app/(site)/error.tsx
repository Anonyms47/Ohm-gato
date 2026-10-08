"use client";

import { Button } from "@/components/ui/Button";
import { brand } from "@/config/brand";

/** Données indisponibles (base injoignable…) : jamais de page blanche ni d'information inventée. */
export default function SiteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="ohm-grille">
      <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <h1 className="font-display text-[clamp(2rem,6vw,2.8rem)] leading-[1.02]">Le four ne répond pas pour l&apos;instant.</h1>
        <p className="mt-4 text-[1.1rem]">
          Les informations de cette page sont momentanément indisponibles. Rien n&apos;a été perdu : réessayez dans un instant.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={reset}>Réessayer</Button>
          <a href={brand.whatsappUrl} className="inline-flex min-h-12 items-center font-bold underline decoration-caramel decoration-2 underline-offset-4">
            Écrire à OHMEGATO sur WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
