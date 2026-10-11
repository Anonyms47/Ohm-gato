import Link from "next/link";
import { AddToBox } from "@/components/catalog/AddToBox";
import { AvailabilityBadge } from "@/components/catalog/AvailabilityBadge";
import { ProductVisual } from "@/components/catalog/ProductVisual";
import { DeliveryFeeNotice } from "@/components/checkout/DeliveryFeeNotice";
import { FourneeFrise } from "@/components/cycles/FourneeFrise";
import { ButtonLink } from "@/components/ui/Button";
import { brand } from "@/config/brand";
import type { CatalogProduct, CycleSummary, SlotSummary } from "@/lib/catalog-types";
import { cn } from "@/lib/cn";
import { COME_BACK_MESSAGE, cyclePhaseLabel, phaseAction, phaseMessage, productionLabel, type CyclePhase } from "@/lib/cycle-status";
import { formatDay, formatTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";

const tone: Partial<Record<CyclePhase, string>> = {
  open: "text-succes",
  surplus: "text-rose-encre",
  cancelled: "text-erreur",
};

function slotWindow(slots: SlotSummary[], kind: "delivery" | "pickup") {
  const matching = slots.filter((s) => s.kind === kind || s.kind === "both");
  if (matching.length === 0) return null;
  return matching.map((s) => ({
    key: s.id,
    day: formatDay(s.startsAt),
    // L'horaire ne se coupe jamais en fin de ligne.
    range: `${formatTime(s.startsAt)} – ${formatTime(s.endsAt)}${s.isFull ? " (complet)" : ""}`,
  }));
}

function ProductRow({ product, canOrder, surplus }: { product: CatalogProduct; canOrder: boolean; surplus: boolean }) {
  const variants = product.variants.filter((v) => v.enabledInCycle);
  const orderable = canOrder && product.availability !== "sold_out";
  const from = variants.length ? Math.min(...variants.map((v) => v.priceFcfa)) : null;
  return (
    <li className="grid grid-cols-[5rem_minmax(0,1fr)] content-start items-start gap-x-4 gap-y-3 border-b-2 border-dashed border-chocolat/20 py-5 sm:grid-cols-[7rem_minmax(0,1fr)]">
      <Link href={`/carte/${product.slug}`} className="w-20 sm:w-28" aria-label={`Voir la fiche ${product.name}`}>
        <ProductVisual product={product} sizes="7rem" />
      </Link>
      <div className="flex min-w-0 flex-col gap-1.5">
        <h3 className="font-display text-[1.35rem] leading-tight sm:text-[1.45rem]">
          <Link href={`/carte/${product.slug}`} className="hover:underline">
            {product.name}
          </Link>
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <AvailabilityBadge state={product.availability} />
          {/* Quantité restante : seulement la valeur réelle de la base, pendant une vente ouverte. */}
          {product.unitsLeft !== null && orderable && (
            <span className="text-encre-douce">
              {surplus ? "En surplus : " : "Reste "}
              {product.unitsLeft} {product.unitsLeft > 1 ? product.unitLabelPlural : product.unitLabel}
            </span>
          )}
        </div>
        {orderable ? (
          from !== null && (
            <p className="tabular-nums text-encre-douce">
              dès <strong className="text-caramel-encre">{formatFcfa(from)}</strong>
            </p>
          )
        ) : (
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {variants.map((v) => (
              <li key={v.id} className="tabular-nums">
                {v.label} · <strong>{formatFcfa(v.priceFcfa)}</strong>
              </li>
            ))}
          </ul>
        )}
        {product.flavors.some((f) => f.availableInCycle) && (
          <p className="text-encre-douce">
            Parfums : {product.flavors.filter((f) => f.availableInCycle).map((f) => f.name).join(", ")}
          </p>
        )}
      </div>
      {/* Le choix du format s'ouvre à la demande : la liste reste courte, l'ajout reste direct. */}
      {orderable && (
        <details className="group col-span-2 sm:col-start-2 sm:col-span-1">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border-2 border-chocolat bg-blanc-casse px-5 font-bold [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Choisir le format</span>
            <span className="hidden group-open:inline">Masquer les formats</span>
            <span aria-hidden className="transition-transform duration-[var(--ohm-duree-courte)] group-open:rotate-180">
              ⌄
            </span>
          </summary>
          <div className="mt-3 max-w-md">
            <AddToBox product={product} compact />
          </div>
        </details>
      )}
    </li>
  );
}

/**
 * L'affiche de la fournée : phase réelle, message officiel, quatre moments, dates clés,
 * créneaux, produits et bouton d'action adapté. Tout vient de la base.
 */
export function FourneePoster({
  cycle,
  phase,
  products,
  slots,
  productNames,
  headingLevel = "h2",
}: {
  cycle: CycleSummary;
  phase: CyclePhase;
  /** Produits commandables (fournée en cours) ; sinon productNames. */
  products: CatalogProduct[] | null;
  slots: SlotSummary[];
  productNames?: string[];
  headingLevel?: "h1" | "h2";
}) {
  const Heading = headingLevel;
  const message = phaseMessage(phase, cycle);
  const action = phaseAction(phase, cycle.number);
  const canOrder = cycle.isOpen;
  const surplus = phase === "surplus";
  const deliveryWindow = slotWindow(slots, "delivery");
  const pickupWindow = slotWindow(slots, "pickup");
  const afterPreorder = phase === "closed" || phase === "preparing" || phase === "delivering";

  return (
    <article
      aria-labelledby={`fournee-${cycle.number}`}
      className="relative mt-8 overflow-hidden rounded-[18px] border-2 border-chocolat bg-blanc-casse p-5 shadow-[0_5px_0_var(--ohm-chocolat)] sm:p-8"
    >
      {/* Cercle d'affiche, discret, comme sur les visuels OHMEGATO. */}
      <span aria-hidden className="ohm-cercle pointer-events-none absolute -right-16 -top-16 size-48 opacity-25 sm:size-64" />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-script text-[1.35rem] text-caramel-encre">fournée n°{cycle.number}</p>
          <Heading id={`fournee-${cycle.number}`} className="font-display text-[clamp(1.9rem,5.5vw,2.8rem)] leading-[1.02]">
            {cycle.title}
          </Heading>
        </div>
        <p className={cn("ohm-tampon ohm-tampon-pose text-[1.05rem]", tone[phase] ?? "text-chocolat")}>{cyclePhaseLabel[phase]}</p>
      </div>
      {cycle.message && <p className="relative mt-4 max-w-prose text-[1.1rem]">{cycle.message}</p>}

      {message && (
        <p
          className={cn(
            "relative mt-5 max-w-prose rounded-[12px] border-2 p-4 text-[1.1rem] font-bold",
            phase === "open" || surplus ? "border-chocolat bg-rose/40" : "border-chocolat/30 bg-creme",
          )}
          data-testid="message-fournee"
        >
          {message}
        </p>
      )}
      {afterPreorder && <p className="relative mt-3 text-encre-douce">{COME_BACK_MESSAGE}</p>}

      {phase !== "cancelled" && <FourneeFrise cycle={cycle} phase={phase} />}

      {phase !== "cancelled" && (
        <dl className="relative mt-8 grid gap-4 rounded-[12px] bg-creme p-4 sm:grid-cols-3">
          <div>
            <dt className="font-bold">Date limite de commande</dt>
            <dd>
              <time dateTime={cycle.closesAt}>
                {formatDay(cycle.closesAt)} à {formatTime(cycle.closesAt)}
              </time>{" "}
              <span className="text-encre-douce">(heure de Dakar)</span>
            </dd>
          </div>
          <div>
            <dt className="font-bold">Production</dt>
            <dd>{productionLabel(cycle)}</dd>
          </div>
          <div>
            <dt className="font-bold">Livraison et retrait</dt>
            <dd>
              <time dateTime={cycle.fulfillmentDate}>{formatDay(cycle.fulfillmentDate)}</time>, jour principal
            </dd>
          </div>
        </dl>
      )}

      {(phase === "open" || surplus) && (deliveryWindow || pickupWindow) && (
        <dl className="relative mt-4 grid gap-3 rounded-[12px] border-2 border-chocolat/20 p-4 sm:grid-cols-2">
          {deliveryWindow && (
            <div>
              <dt className="font-bold">{surplus ? "Livraison des commandes tardives" : "Créneaux de livraison"}</dt>
              <dd>
                <ul className="mt-1 flex flex-col gap-1 tabular-nums">
                  {deliveryWindow.map((w) => (
                    <li key={w.key}>
                      {w.day}, <span className="whitespace-nowrap">{w.range}</span>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
          {pickupWindow && (
            <div>
              <dt className="font-bold">{surplus ? "Retrait des commandes tardives" : "Retrait gratuit"}</dt>
              <dd>
                <ul className="mt-1 flex flex-col gap-1 tabular-nums">
                  {pickupWindow.map((w) => (
                    <li key={w.key}>
                      {w.day}, <span className="whitespace-nowrap">{w.range}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-encre-douce">
                  {brand.pickupAddress}, {brand.city}
                </p>
              </dd>
            </div>
          )}
        </dl>
      )}
      {surplus && !cycle.surplusDeliveryAllowed && (
        <p className="relative mt-3 font-bold">Commandes tardives : retrait uniquement, au {brand.pickupAddress}, {brand.city}.</p>
      )}
      {surplus && cycle.surplusEndsAt && (
        <p className="relative mt-3">
          Vente du surplus jusqu&apos;au {formatDay(cycle.surplusEndsAt)} à {formatTime(cycle.surplusEndsAt)}, dans la limite du stock restant.
        </p>
      )}
      {(phase === "open" || surplus) && deliveryWindow && <DeliveryFeeNotice className="relative mt-4" />}

      {action && (
        <div className="relative mt-6">
          <ButtonLink href={action.href}>{action.label}</ButtonLink>
        </div>
      )}

      {phase === "cancelled" ? (
        <p className="relative mt-6 font-bold">
          Cette fournée a été annulée. Les commandes payées sont remboursées par OHMEGATO, qui contacte chaque client.
        </p>
      ) : (
        <section aria-labelledby={`au-programme-${cycle.number}`} id="au-programme" className="relative mt-10 scroll-mt-28">
          <h3 id={`au-programme-${cycle.number}`} className="font-display text-[1.7rem]">
            {surplus ? "Les douceurs encore disponibles" : "Au programme"}
          </h3>
          {products ? (
            products.length === 0 ? (
              <p className="mt-3">La composition de cette fournée sera publiée bientôt.</p>
            ) : (
              <ul className="mt-2 grid items-start lg:grid-cols-2 lg:gap-x-10">
                {products.map((product) => (
                  <ProductRow key={product.id} product={product} canOrder={canOrder} surplus={surplus} />
                ))}
              </ul>
            )
          ) : productNames && productNames.length > 0 ? (
            <p className="mt-3">{productNames.join(" · ")}</p>
          ) : (
            <p className="mt-3">La composition de cette fournée sera publiée bientôt.</p>
          )}
        </section>
      )}
    </article>
  );
}
