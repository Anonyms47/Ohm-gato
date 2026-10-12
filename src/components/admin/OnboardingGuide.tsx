"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const KEY = "ohm-atelier-guide-ferme";

const STEPS = [
  { label: "Vérifier une commande", href: "/admin/commandes" },
  { label: "Confirmer un paiement Wave", href: "/admin/paiements" },
  { label: "Imprimer la production", href: "/admin/production" },
  { label: "Marquer une commande prête", href: "/admin/commandes?vue=besoin#a-preparer" },
  { label: "Saisir un surplus", href: "/admin/fournee" },
];

function isClosed(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Première prise en main : discrète, refermable pour de bon, à rouvrir depuis l'aide. */
export function OnboardingGuide() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- préférence locale lue après hydratation
    setVisible(!isClosed());
  }, []);
  if (!visible) return null;
  return (
    <section aria-labelledby="prise-en-main" className="atelier-carnet atelier-deploie relative rounded-[14px] border-2 border-chocolat/15 py-4 pl-10 pr-4">
      <p className="atelier-annotation text-[1.1rem]">Pour bien démarrer</p>
      <h2 id="prise-en-main" className="font-display text-[1.35rem]">
        Cinq gestes pour prendre l&apos;atelier en main
      </h2>
      <ol className="mt-2 grid list-decimal gap-1 pl-5 sm:grid-cols-2">
        {STEPS.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
              {s.label}
            </Link>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[0.95rem] text-encre-douce">
        Chaque geste est expliqué dans{" "}
        <Link href="/admin/aide" className="underline">
          l&apos;aide
        </Link>
        .
      </p>
      <button
        type="button"
        onClick={() => {
          try {
            window.localStorage.setItem(KEY, "1");
          } catch {
            /* sans stockage : le guide se refermera seulement pour cette visite */
          }
          setVisible(false);
        }}
        className="mt-3 min-h-11 font-bold underline decoration-caramel decoration-2 underline-offset-4"
      >
        Ne plus afficher ce guide
      </button>
    </section>
  );
}

export function ReopenGuide() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        try {
          window.localStorage.removeItem(KEY);
        } catch {
          /* rien à faire */
        }
        router.push("/admin");
      }}
      className="inline-flex min-h-11 items-center rounded-[10px] border-2 border-chocolat px-4 font-bold"
    >
      Revoir le guide de prise en main
    </button>
  );
}
