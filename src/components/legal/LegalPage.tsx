import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Annotation, BrandHeading } from "@/components/brand/BrandHeading";
import { LegalContent } from "@/components/legal/LegalContent";
import { PrintButton } from "@/components/legal/PrintButton";
import { brand } from "@/config/brand";
import { formatLegalDate, getLegalVariables, getPublishedDocument, type LegalSlug } from "@/lib/legal/documents";
import { parseLegalMarkdown, tableOfContents } from "@/lib/legal/markdown";

export const LEGAL_META: Record<LegalSlug, { title: string; description: string; annotation: string }> = {
  "conditions-generales": {
    title: "Conditions générales",
    description: "Conditions générales de vente et d'utilisation d'OHMEGATO : fournées, prix en FCFA, paiement Wave vérifié par l'équipe, retrait, livraison dans Dakar, sur-mesure.",
    annotation: "les règles du jeu, sans petites lignes",
  },
  "livraison-retrait": {
    title: "Livraison et retrait",
    description: "Livraison dans Dakar ou retrait gratuit à Sud Foire. Le paiement en ligne couvre uniquement les produits ; la livraison se règle au livreur.",
    annotation: "jusqu'à votre porte, ou chez nous",
  },
  "annulation-remboursement": {
    title: "Annulation et remboursement",
    description: "Annuler ou modifier une commande OHMEGATO, signaler un problème, obtenir un remplacement ou un remboursement.",
    annotation: "quand quelque chose ne va pas",
  },
  confidentialite: {
    title: "Confidentialité",
    description: "Comment OHMEGATO collecte, utilise et protège vos données personnelles, et comment exercer vos droits.",
    annotation: "vos données, simplement",
  },
  cookies: {
    title: "Cookies",
    description: "Cookies et stockage local du site OHMEGATO : uniquement ce qui est nécessaire, sans statistiques ni publicité.",
    annotation: "rien que le nécessaire",
  },
  "mentions-legales": {
    title: "Mentions légales",
    description: "Éditeur du site OHMEGATO, hébergement, propriété intellectuelle et droit applicable.",
    annotation: "qui est derrière le four",
  },
  "allergenes-conservation": {
    title: "Allergènes et conservation",
    description: "Allergènes, informations de recette et conseils de conservation de chaque pâtisserie OHMEGATO.",
    annotation: "pour savourer en confiance",
  },
};

export function legalMetadata(slug: LegalSlug): Metadata {
  const meta = LEGAL_META[slug];
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: `/${slug}` },
    openGraph: { title: `${meta.title} · ${brand.name}`, description: meta.description, url: `/${slug}`, type: "article" },
  };
}

/**
 * Page légale : contenu publié en base (versionné, édité dans /admin), rendu sans HTML brut.
 * `before` / `after` accueillent les parties alimentées par les données (encart livraison,
 * tableau des allergènes, délais renseignés dans l'administration).
 */
export async function LegalPage({ slug, before, after }: { slug: LegalSlug; before?: ReactNode; after?: ReactNode }) {
  const [document, variables] = await Promise.all([getPublishedDocument(slug), getLegalVariables()]);
  if (!document) notFound();
  const blocks = parseLegalMarkdown(document.content, variables);
  const toc = tableOfContents(blocks);
  const effective = formatLegalDate(document.effectiveAt ?? document.publishedAt);
  const meta = LEGAL_META[slug];

  return (
    <div className="ohm-grille print:bg-none">
      <article className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12" aria-labelledby="titre-document" data-testid={`document-${slug}`}>
        <header className="max-w-3xl">
          <Annotation className="print:hidden">{meta.annotation}</Annotation>
          <BrandHeading as="h1" size="titre" id="titre-document">
            {document.title}
          </BrandHeading>
          <p className="mt-3 text-encre-douce" data-testid="version-document">
            Version {document.version}
            {effective && <> · en vigueur depuis le {effective}</>}
          </p>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:gap-12">
          {toc.length > 1 && (
            <nav aria-label="Sommaire" className="print:hidden lg:sticky lg:top-24 lg:self-start">
              <details className="group rounded-[14px] border-2 border-chocolat/20 bg-blanc-casse lg:hidden">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 font-bold [&::-webkit-details-marker]:hidden">
                  Sommaire
                  <span aria-hidden className="transition-transform duration-[var(--ohm-duree-courte)] group-open:rotate-180">
                    ⌄
                  </span>
                </summary>
                <TocList items={toc} />
              </details>
              <div className="hidden lg:block">
                <p className="font-bold">Sommaire</p>
                <TocList items={toc} />
              </div>
            </nav>
          )}
          <div className="min-w-0 max-w-[68ch]">
            {before && <div className="mb-8">{before}</div>}
            <LegalContent blocks={blocks} />
            {after && <div className="mt-10">{after}</div>}
            <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-chocolat/25 pt-4 text-encre-douce">
              <span>
                {brand.name} · {document.title} · version {document.version}
              </span>
              <PrintButton />
            </footer>
          </div>
        </div>
      </article>
    </div>
  );
}

function TocList({ items }: { items: { id: string; text: string }[] }) {
  return (
    <ol className="flex flex-col gap-0.5 px-2 pb-3 lg:mt-2 lg:px-0">
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            className="flex min-h-11 items-center rounded-[8px] px-2 leading-snug decoration-caramel decoration-2 underline-offset-4 hover:underline focus-visible:underline"
          >
            {item.text}
          </a>
        </li>
      ))}
    </ol>
  );
}
