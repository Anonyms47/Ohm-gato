import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Aide" };

const GUIDES: { title: string; steps: string[]; href: string; link: string }[] = [
  {
    title: "Une commande arrive",
    steps: [
      "Elle apparaît dans « Aujourd'hui » et dans Commandes.",
      "Payée par Wave : vérifiez le montant dans l'application Wave, puis « Paiement reçu » dans Paiements.",
      "Une fois payée, elle compte dans la fiche de production.",
    ],
    href: "/admin/paiements",
    link: "Ouvrir les paiements",
  },
  {
    title: "Confirmer un paiement Wave",
    steps: [
      "Ouvrez Paiements : les plus anciens sont en haut.",
      "Retrouvez le montant exact dans Wave, notez la référence de transaction si vous l'avez.",
      "« Paiement Wave reçu » puis « Oui, paiement reçu ». La cliente voit « Payée » et peut télécharger son reçu.",
      "Introuvable ? Écrivez à la cliente avec le bouton WhatsApp : rien n'est annulé automatiquement.",
    ],
    href: "/admin/paiements",
    link: "Ouvrir les paiements",
  },
  {
    title: "Imprimer la production",
    steps: [
      "Après la date limite, les nouvelles précommandes sont refusées automatiquement.",
      "Dans la fournée, « Clôturer les précommandes » fige les quantités.",
      "« Fiche de production » : imprimez-la. Les paiements à vérifier y sont séparés.",
    ],
    href: "/admin/production",
    link: "Fiche de production",
  },
  {
    title: "Marquer une commande prête",
    steps: [
      "Ouvrez la commande, puis « Passer en préparation » et « Marquer prête ».",
      "Plusieurs commandes à la fois : cochez-les dans Commandes, puis choisissez l’action dans la barre qui apparaît (une confirmation est demandée).",
      "Retrait : « Retrait effectué » quand la cliente repart avec sa boîte. Livraison : passez par Livraisons.",
    ],
    href: "/admin/commandes",
    link: "Ouvrir les commandes",
  },
  {
    title: "Saisir un surplus",
    steps: [
      "Dans la fournée, section Production : saisissez la quantité réellement produite et les pertes.",
      "Le surplus théorique est calculé ; rien n'est publié sans votre confirmation.",
      "« Publier le surplus disponible » rend les quantités visibles des clientes.",
    ],
    href: "/admin/fournee",
    link: "Ouvrir la fournée",
  },
];

/** Aide de l'atelier : réponses courtes aux gestes du quotidien. */
export default async function AdminHelp() {
  await requireAdmin();
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">Aide de l&apos;atelier</h1>
        <p className="text-encre-douce">Les gestes du quotidien, en quelques lignes. Ce qui est visible des clientes est toujours précisé.</p>
      </header>
      <ol className="grid gap-5 md:grid-cols-2">
        {GUIDES.map((g, i) => (
          <li key={g.title} className="atelier-carnet flex flex-col gap-3 rounded-[12px] border-2 border-chocolat/15 py-4 pl-10 pr-4">
            <p className="atelier-annotation text-[1.1rem]">Fiche {i + 1}</p>
            <h2 className="font-display text-[1.35rem]">{g.title}</h2>
            <ol className="list-decimal pl-5">
              {g.steps.map((s) => (
                <li key={s} className="py-0.5">
                  {s}
                </li>
              ))}
            </ol>
            <Link href={g.href} className="mt-auto self-start font-bold underline decoration-caramel decoration-2 underline-offset-4">
              {g.link}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
