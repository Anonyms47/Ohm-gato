import type { Metadata } from "next";
import Link from "next/link";
import { Annotation, BrandHeading } from "@/components/brand/BrandHeading";
import { AddToBox } from "@/components/catalog/AddToBox";
import { AvailabilityBadge } from "@/components/catalog/AvailabilityBadge";
import { ProductVisual } from "@/components/catalog/ProductVisual";
import { DeliveryFeeNotice } from "@/components/checkout/DeliveryFeeNotice";
import { ButtonLink } from "@/components/ui/Button";
import { brand } from "@/config/brand";
import { getArchivedCycles, getCatalog, getSlots, getUpcomingCycles } from "@/lib/catalog";
import type { CatalogProduct, CycleSummary, SlotSummary } from "@/lib/catalog-types";
import { cn } from "@/lib/cn";
import { cyclePhase, cyclePhaseLabel, journalSteps, type StepState } from "@/lib/cycle-status";
import { formatDay, formatShortDay, formatTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";

export const metadata: Metadata = {
  title: "Nos fournées",
  description: "Le journal du four OHMEGATO : fournée en cours, dates, produits disponibles, prochaine fournée et archives.",
};

const stepMark: Record<StepState, string> = {
  done: "bg-chocolat text-creme border-chocolat",
  current: "bg-rose text-cacao border-chocolat",
  upcoming: "bg-blanc-casse text-encre-douce border-chocolat/40",
  cancelled: "bg-blanc-casse text-encre-douce border-chocolat/30 line-through",
};
const stepWord: Record<StepState, string> = { done: "passé", current: "en cours", upcoming: "à venir", cancelled: "annulé" };

function Journal({ cycle }: { cycle: CycleSummary }) {
  const steps = journalSteps(cycle);
  return (
    <ol className="relative mt-6 grid gap-4 sm:grid-cols-4 sm:gap-3">
      {steps.map((step, index) => (
        <li key={step.key} className="relative flex gap-3 sm:flex-col">
          <span
            aria-hidden
            className={cn("grid size-10 shrink-0 place-items-center rounded-full border-2 font-display text-[1.1rem]", stepMark[step.state])}
          >
            {index + 1}
          </span>
          <div>
            <p className="font-bold">
              {step.label} <span className="sr-only">({stepWord[step.state]})</span>
            </p>
            <p className={cn("text-encre-douce", step.state === "cancelled" && "line-through")}>
              <time dateTime={step.date}>
                {formatDay(step.date)}
                {step.withTime ? `, ${formatTime(step.date)}` : ""}
              </time>
            </p>
            {step.state === "current" && <Annotation className="text-[1.15rem]">nous en sommes là</Annotation>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function slotWindow(slots: SlotSummary[], kind: "delivery" | "pickup") {
  const matching = slots.filter((s) => s.kind === kind || s.kind === "both");
  if (matching.length === 0) return null;
  return matching.map((s) => `${formatTime(s.startsAt)} – ${formatTime(s.endsAt)}${s.isFull ? " (complet)" : ""}`).join(", ");
}

function ProductRow({ product, cycleOpen }: { product: CatalogProduct; cycleOpen: boolean }) {
  const variants = product.variants.filter((v) => v.enabledInCycle);
  return (
    <li className="grid gap-4 border-b-2 border-dashed border-chocolat/20 py-6 sm:grid-cols-[8rem_1fr] md:grid-cols-[8rem_1fr_minmax(16rem,22rem)]">
      <Link href={`/carte/${product.slug}`} className="w-28 sm:w-32" aria-label={`Voir la fiche ${product.name}`}>
        <ProductVisual product={product} sizes="8rem" />
      </Link>
      <div className="flex min-w-0 flex-col gap-2">
        <h3 className="font-display text-[1.45rem] leading-tight">
          <Link href={`/carte/${product.slug}`} className="hover:underline">
            {product.name}
          </Link>
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <AvailabilityBadge state={product.availability} />
          {product.unitsLeft !== null && cycleOpen && product.availability !== "sold_out" && (
            <span className="text-encre-douce">
              Reste {product.unitsLeft} {product.unitsLeft > 1 ? product.unitLabelPlural : product.unitLabel}
            </span>
          )}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {variants.map((v) => (
            <li key={v.id} className="tabular-nums">
              {v.label} · <strong>{formatFcfa(v.priceFcfa)}</strong>
            </li>
          ))}
        </ul>
        {product.flavors.some((f) => f.availableInCycle) && (
          <p className="text-encre-douce">
            Parfums : {product.flavors.filter((f) => f.availableInCycle).map((f) => f.name).join(", ")}
          </p>
        )}
      </div>
      <div className="sm:col-span-2 md:col-span-1">
        {cycleOpen ? <AddToBox product={product} compact /> : null}
      </div>
    </li>
  );
}

export default async function FourneesPage() {
  const { cycle, products } = await getCatalog();
  const [upcoming, archives, slots] = await Promise.all([
    getUpcomingCycles(cycle?.id ?? null),
    getArchivedCycles(),
    cycle ? getSlots(cycle.id) : Promise.resolve([]),
  ]);
  const phase = cycle ? cyclePhase(cycle) : null;
  const inCycle = products.filter((p) => p.inCycle);
  const next = upcoming[0] ?? null;
  const deliveryWindow = slotWindow(slots, "delivery");
  const pickupWindow = slotWindow(slots, "pickup");

  return (
    <div className="ohm-grille">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <Annotation>carnet de bord</Annotation>
        <BrandHeading as="h1" size="titre">
          Le journal du four
        </BrandHeading>
        <p className="mt-3 max-w-prose text-[1.1rem]">
          OHMEGATO cuisine par fournées : chaque fournée a ses dates, ses produits et un stock compté à l&apos;unité. Tout ce qui est écrit ici
          vient directement du four.
        </p>

        {/* Fournée en cours */}
        {cycle && phase ? (
          <article aria-labelledby="fournee-actuelle" className="mt-8 rounded-[14px] border-2 border-chocolat bg-blanc-casse p-5 shadow-[0_4px_0_var(--ohm-chocolat)] sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-script text-[1.3rem] text-caramel-encre">fournée n°{cycle.number}</p>
                <h2 id="fournee-actuelle" className="font-display text-[clamp(1.8rem,5vw,2.6rem)] leading-[1.02]">
                  {cycle.title}
                </h2>
              </div>
              <p
                className={cn(
                  "ohm-tampon text-[1.05rem]",
                  phase === "open" ? "text-succes" : phase === "cancelled" ? "text-erreur" : "text-chocolat",
                )}
              >
                {cyclePhaseLabel[phase]}
              </p>
            </div>
            {cycle.message && <p className="mt-4 max-w-prose text-[1.1rem]">{cycle.message}</p>}
            <Journal cycle={cycle} />

            {phase !== "cancelled" && (deliveryWindow || pickupWindow) && (
              <dl className="mt-6 grid gap-3 rounded-[10px] bg-creme p-4 sm:grid-cols-2">
                {deliveryWindow && (
                  <div>
                    <dt className="font-bold">Livraison le {formatShortDay(cycle.fulfillmentDate)}</dt>
                    <dd>{deliveryWindow}</dd>
                  </div>
                )}
                {pickupWindow && (
                  <div>
                    <dt className="font-bold">Retrait gratuit le {formatShortDay(cycle.fulfillmentDate)}</dt>
                    <dd>
                      {pickupWindow} — {brand.pickupAddress}
                    </dd>
                  </div>
                )}
              </dl>
            )}
            {phase !== "cancelled" && deliveryWindow && <DeliveryFeeNotice className="mt-4" />}

            {phase === "cancelled" ? (
              <p className="mt-6 font-bold">
                Cette fournée a été annulée. Les commandes payées sont remboursées par OHMEGATO, qui contacte chaque client.
              </p>
            ) : (
              <section aria-labelledby="au-programme" className="mt-8">
                <h3 id="au-programme" className="font-display text-[1.6rem]">
                  Au programme
                </h3>
                {inCycle.length === 0 ? (
                  <p className="mt-3">La composition de cette fournée sera publiée bientôt.</p>
                ) : (
                  <ul className="mt-2">
                    {inCycle.map((product) => (
                      <ProductRow key={product.id} product={product} cycleOpen={cycle.isOpen} />
                    ))}
                  </ul>
                )}
                {cycle.isOpen && inCycle.length > 0 && (
                  <div className="mt-6 flex flex-wrap gap-3">
                    <ButtonLink href="/ma-boite">Voir Ma boîte</ButtonLink>
                    <ButtonLink href="/carte" variant="secondary">
                      Toute la carte
                    </ButtonLink>
                  </div>
                )}
              </section>
            )}
          </article>
        ) : (
          <section className="mt-8 rounded-[14px] border-2 border-dashed border-chocolat/40 bg-blanc-casse p-6">
            <h2 className="font-display text-[1.8rem]">Aucune fournée en cours</h2>
            <p className="mt-2">La prochaine fournée est annoncée sur Instagram dès que ses dates sont fixées.</p>
          </section>
        )}

        {/* Prochaine fournée */}
        <section aria-labelledby="prochaine" className="mt-12">
          <h2 id="prochaine" className="font-display text-[clamp(1.6rem,4vw,2.2rem)]">
            Prochaine fournée
          </h2>
          {next ? (
            <div className="mt-4 rounded-[12px] border-2 border-chocolat/30 bg-blanc-casse p-5">
              <p className="font-bold">
                Fournée n°{next.number} — {next.title}
              </p>
              <p className="mt-1">
                Ouverture des commandes le {formatDay(next.opensAt)}, {formatTime(next.opensAt)}. Livraison et retrait le{" "}
                {formatDay(next.fulfillmentDate)}.
              </p>
              {next.message && <p className="mt-2 text-encre-douce">{next.message}</p>}
            </div>
          ) : (
            <div className="mt-4 rounded-[12px] border-2 border-dashed border-chocolat/30 bg-blanc-casse p-5">
              <p className="font-bold">Pas encore de date programmée.</p>
              <p className="mt-1">
                Les dates sont annoncées sur{" "}
                <a href={brand.instagramUrl} className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
                  Instagram @{brand.instagramHandle}
                </a>
                . Avec un carnet OHMEGATO, vous pouvez aussi demander à être prévenu.
              </p>
            </div>
          )}
        </section>

        {/* Archives */}
        <section aria-labelledby="archives" className="mt-12">
          <h2 id="archives" className="font-display text-[clamp(1.6rem,4vw,2.2rem)]">
            Les fournées passées
          </h2>
          {archives.length === 0 ? (
            <p className="mt-3">Les fournées terminées apparaîtront ici.</p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {archives.map((archive) => (
                <li key={archive.id} className="rounded-[12px] border-2 border-chocolat/20 bg-blanc-casse p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display text-[1.3rem]">n°{archive.number}</p>
                    <span className={cn("text-[0.95rem] font-bold", archive.status === "cancelled" ? "text-erreur" : "text-encre-douce")}>
                      {archive.status === "cancelled" ? "Annulée" : "Terminée"}
                    </span>
                  </div>
                  <p className="text-encre-douce">{formatDay(archive.fulfillmentDate)}</p>
                  {archive.productNames.length > 0 && <p className="mt-2 text-[0.95rem]">{archive.productNames.join(" · ")}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
