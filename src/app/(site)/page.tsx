import Link from "next/link";
import { Annotation, BrandHeading } from "@/components/brand/BrandHeading";
import { HandArrow } from "@/components/brand/HandArrow";
import { AvailabilityBadge } from "@/components/catalog/AvailabilityBadge";
import { ProductVisual } from "@/components/catalog/ProductVisual";
import { FourneeFrise } from "@/components/cycles/FourneeFrise";
import { ButtonLink } from "@/components/ui/Button";
import { brand } from "@/config/brand";
import { cn } from "@/lib/cn";
import { getCatalog, getPublicSettings } from "@/lib/catalog";
import type { CatalogProduct, CycleSummary } from "@/lib/catalog-types";
import { cyclePhaseLabel, phaseAction, phaseMessage, phaseNow, productionLabel } from "@/lib/cycle-status";
import { formatDay, formatTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";

function fromPrice(product: CatalogProduct) {
  const prices = product.variants.filter((v) => v.enabledInCycle).map((v) => v.priceFcfa);
  return prices.length ? Math.min(...prices) : null;
}

function cycleLine(cycle: CycleSummary | null): string {
  if (!cycle) return "Prochaine fournée annoncée sur Instagram.";
  const phase = phaseNow(cycle);
  if (phase === "scheduled") return `Fournée annoncée : ${productionLabel(cycle)}`;
  return phaseMessage(phase, cycle) ?? "Cette fournée est terminée. Consultez Nos fournées pour découvrir la prochaine ouverture.";
}

export default async function FourneePage() {
  const [{ cycle, products }, settings] = await Promise.all([getCatalog(), getPublicSettings()]);
  const inCycle = products.filter((p) => p.inCycle);
  const featured =
    products.find((p) => p.slug === cycle?.featuredProductSlug) ?? inCycle[0] ?? products[0] ?? null;
  // Le produit manifeste n'est montré que s'il n'est pas déjà la vedette de la couverture.
  const manifestoCandidate = products.find((p) => p.slug === "moelleux-chocolat") ?? null;
  const manifesto = manifestoCandidate && manifestoCandidate.id !== featured?.id ? manifestoCandidate : null;
  const alimaNote = typeof settings["home.alima_note"] === "string" ? (settings["home.alima_note"] as string) : null;
  const phase = cycle ? phaseNow(cycle) : null;
  const action = cycle && phase ? phaseAction(phase, cycle.number) : null;

  return (
    <>
      {/* Acte 1 — couverture de fournée */}
      <section aria-labelledby="couverture" className="ohm-grille overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-6 px-4 pb-12 pt-8 sm:px-6 md:grid-cols-[1.05fr_1fr] md:pb-20 md:pt-14">
          <div className="relative z-10 flex flex-col gap-5 motion-safe:animate-[ohm-entree_520ms_var(--ohm-courbe)_both]">
            <p className="inline-flex w-fit items-center gap-2 rounded-full border-2 border-chocolat bg-blanc-casse px-3 py-1 font-bold">
              <span aria-hidden className={cycle?.isOpen ? "size-2.5 rounded-full bg-succes" : "size-2.5 rounded-full bg-encre-douce"} />
              {phase ? cyclePhaseLabel[phase] : "Fournée fermée"}
            </p>
            <BrandHeading as="h1" size="affiche" id="couverture">
              {cycle ? (
                <>
                  La fournée
                  <br />
                  <span className="text-caramel-encre">n°{cycle.number}</span>
                </>
              ) : (
                "La fournée OHMEGATO"
              )}
            </BrandHeading>
            {cycle?.message && <p className="max-w-prose text-[1.15rem]">{cycle.message}</p>}
            <div className="max-w-prose rounded-[12px] border-2 border-chocolat bg-blanc-casse p-4">
              <p className="text-[1.15rem] font-bold">{cycleLine(cycle)}</p>
              {cycle && (
                <p className="mt-2 text-encre-douce">
                  {productionLabel(cycle)} Livraison ou retrait le {formatDay(cycle.fulfillmentDate)}.
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {action ? (
                <>
                  <ButtonLink href={action.href}>{action.label}</ButtonLink>
                  <Link
                    href={action.href === "/carte" ? "#moments" : "/carte"}
                    className="inline-flex min-h-11 items-center font-bold underline decoration-caramel decoration-2 underline-offset-4"
                  >
                    {action.href === "/carte" ? "Comment ça marche" : "Voir toute la carte"}
                  </Link>
                </>
              ) : cycle ? (
                <ButtonLink href={`/fournees/${cycle.number}`} variant="secondary">
                  Voir la fournée
                </ButtonLink>
              ) : (
                <ButtonLink href={brand.instagramUrl} variant="secondary">
                  Suivre les annonces sur Instagram
                </ButtonLink>
              )}
            </div>
          </div>
          {featured && (
            <div className="relative mx-auto w-full max-w-[34rem] motion-safe:animate-[ohm-affiche_700ms_var(--ohm-courbe)_120ms_both]">
              <ProductVisual product={featured} priority sizes="(min-width: 768px) 45vw, 90vw" />
              <div className="absolute -left-2 top-2 flex max-w-[11rem] flex-col items-start sm:-left-6 md:-left-14">
                <Annotation>la vedette de la fournée</Annotation>
                <HandArrow id="vedette" className="ml-6 h-12 w-20" />
              </div>
              <Link
                href={`/carte/${featured.slug}`}
                className="absolute bottom-3 right-0 rounded-[8px] bg-blanc-casse/90 px-3 py-2 font-bold underline decoration-caramel decoration-2 underline-offset-4"
              >
                {featured.name}
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Acte 2 — table des produits de la fournée */}
      <section aria-labelledby="table" className="bg-blanc-casse">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <BrandHeading id="table" size="titre">
              Sur la table
            </BrandHeading>
            <Link href="/carte" className="inline-flex min-h-11 items-center font-bold underline decoration-caramel decoration-2 underline-offset-4">
              Toute la carte
            </Link>
          </div>
          {inCycle.length === 0 ? (
            <p className="mt-6 text-[1.1rem]">La composition de la prochaine fournée sera annoncée bientôt.</p>
          ) : (
            <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
              {inCycle.map((product, index) => {
                const price = fromPrice(product);
                return (
                  <li key={product.id} className={cn(index % 2 === 1 && "sm:translate-y-6")}>
                    <Link
                      href={`/carte/${product.slug}`}
                      className="group flex flex-col gap-2 rounded-[12px] focus-visible:outline-offset-4 motion-safe:animate-[ohm-entree_420ms_var(--ohm-courbe)_both]"
                      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
                    >
                      <ProductVisual product={product} sizes="(min-width: 1024px) 22vw, 45vw" className="transition-transform duration-[var(--ohm-duree-moyenne)] group-hover:-rotate-2" />
                      <span className="font-display text-[1.3rem] leading-tight">{product.name}</span>
                      <span className="flex flex-wrap items-center gap-2">
                        {price !== null && (
                          <span className="tabular-nums text-encre-douce">
                            dès <strong className="text-caramel-encre">{formatFcfa(price)}</strong>
                          </span>
                        )}
                        {product.availability !== "available" && <AvailabilityBadge state={product.availability} />}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Acte 2 bis — comment se passe une fournée */}
      {cycle && phase && phase !== "cancelled" && (
        <section aria-labelledby="moments" className="ohm-grille">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
            <Annotation>comment ça marche</Annotation>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <BrandHeading id="moments" size="titre" className="scroll-mt-28">
                Votre fournée en quatre moments
              </BrandHeading>
              <Link
                href="/fournees"
                className="inline-flex min-h-11 items-center font-bold underline decoration-caramel decoration-2 underline-offset-4"
              >
                Tout savoir sur nos fournées
              </Link>
            </div>
            <FourneeFrise cycle={cycle} phase={phase} />
          </div>
        </section>
      )}

      {/* Acte 3 — pause humaine (affichée seulement avec une vraie note d'Alima) */}
      {alimaNote && (
        <section aria-labelledby="note" className="ohm-grille">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
            <h2 id="note" className="sr-only">
              Le mot d&apos;Alima
            </h2>
            <blockquote className="-rotate-1 rounded-[4px] bg-blanc-casse p-6 shadow-[0_2px_0_var(--ohm-grille)] sm:p-10">
              <p className="font-script text-[clamp(1.5rem,4vw,2.1rem)] leading-snug text-chocolat">{alimaNote}</p>
              <footer className="mt-4 font-bold">— Alima</footer>
            </blockquote>
          </div>
        </section>
      )}

      {/* Acte 4 — produit manifeste */}
      {manifesto && (
        <section aria-labelledby="manifeste" className="ohm-cacao">
          <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-16 sm:px-6 md:grid-cols-2">
            <ProductVisual product={manifesto} sizes="(min-width: 768px) 45vw, 90vw" className="mx-auto w-full max-w-[30rem]" />
            <div className="flex flex-col gap-4">
              <Annotation className="text-caramel">la recette qui nous ressemble</Annotation>
              <BrandHeading id="manifeste" size="titre" tone="creme">
                {manifesto.name}
              </BrandHeading>
              <p className="max-w-prose text-[1.15rem] text-creme/90">{manifesto.description}</p>
              {manifesto.storage?.note && <p className="text-creme/80">{manifesto.storage.note}</p>}
              <Link
                href={`/carte/${manifesto.slug}`}
                className="inline-flex min-h-11 w-fit items-center font-bold text-creme underline decoration-caramel decoration-2 underline-offset-4"
              >
                Voir la fiche du moelleux
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Acte 5 — ticket de sortie */}
      <section aria-labelledby="ticket" className="ohm-grille">
        <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
          <div className="rotate-[0.6deg] bg-blanc-casse px-6 pb-8 pt-6 shadow-[0_2px_0_var(--ohm-grille)]">
            <h2 id="ticket" className="text-center font-display text-[1.6rem]">
              Bon à savoir
            </h2>
            <dl className="mt-4 divide-y-2 divide-dashed divide-chocolat/25">
              {cycle && (
                <div className="grid gap-0.5 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
                  <dt className="font-bold">Date limite de commande</dt>
                  <dd>
                    {formatDay(cycle.closesAt)}, {formatTime(cycle.closesAt)}
                  </dd>
                </div>
              )}
              <div className="grid gap-0.5 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
                <dt className="font-bold">Livraison</dt>
                <dd>
                  Dans Dakar, le jour prévu de la fournée. Frais non compris, à régler directement au livreur selon votre position.
                </dd>
              </div>
              <div className="grid gap-0.5 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
                <dt className="font-bold">Retrait</dt>
                <dd>{brand.pickupAddress}. Gratuit.</dd>
              </div>
              <div className="grid gap-0.5 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
                <dt className="font-bold">Paiement</dt>
                <dd>Les produits uniquement, par lien marchand Wave ; le paiement est vérifié par OHMEGATO.</dd>
              </div>
              <div className="grid gap-0.5 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
                <dt className="font-bold">Délais</dt>
                <dd>24 h minimum. Sur-mesure : 2 à 4 jours selon la quantité.</dd>
              </div>
            </dl>
            <p className="mt-6 text-center font-script text-[1.4rem] text-caramel-encre">à très vite</p>
          </div>
        </div>
      </section>
    </>
  );
}
