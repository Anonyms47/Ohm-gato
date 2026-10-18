import Link from "next/link";
import { notFound } from "next/navigation";
import { Countdown } from "@/components/admin/Countdown";
import { CycleForm, CycleProductsEditor, CycleStatusActions, SlotsEditor } from "@/components/admin/CycleEditors";
import { ProductionEditor, SurplusPublisher, WithdrawSurplus } from "@/components/admin/CycleProduction";
import { getCycleReport, lastProductionPrint } from "@/lib/admin/cycle-report";
import { CYCLE_STEPS, currentCycleStep, openingChecks, type CycleStepKey } from "@/lib/admin/cycle-steps";
import { getCycle, getCycleDemand, getCycleSetup, listFlavors, listProducts, type DemandRow } from "@/lib/admin/data";
import { serverNow } from "@/lib/admin/today";
import { cn } from "@/lib/cn";
import { formatFcfa } from "@/lib/money";
import { requireAdmin } from "@/lib/auth/session";
import { cyclePhase, cyclePhaseLabel, isUpcoming, productionLabel } from "@/lib/cycle-status";
import { formatDay, formatTime } from "@/lib/dates";

export const metadata = { title: "Fournée" };

const COLUMNS: { key: keyof DemandRow; label: string }[] = [
  { key: "ordered", label: "Commandé" },
  { key: "toVerify", label: "Paiement à vérifier" },
  { key: "paid", label: "Payé et confirmé" },
  { key: "cancelled", label: "Annulé" },
  { key: "toProduce", label: "À produire (confirmées)" },
  { key: "extra", label: "Supplément décidé" },
  { key: "produced", label: "Réellement produit" },
  { key: "lost", label: "Pertes" },
  { key: "reservedForOrders", label: "Réservé aux commandes" },
  { key: "handedOver", label: "Livré ou retiré" },
  { key: "remaining", label: "Restant" },
  { key: "surplusPublished", label: "Publié en surplus" },
  { key: "surplusSold", label: "Vendu en surplus" },
  { key: "available", label: "Disponible à la vente" },
];

function DemandTable({ demand }: { demand: DemandRow[] }) {
  if (demand.length === 0) return <p className="text-encre-douce">Aucun produit dans la fournée.</p>;
  return (
    <div className="overflow-x-auto rounded-[12px] border-2 border-chocolat/20 bg-blanc-casse" tabIndex={0} role="region" aria-label="Synthèse de la demande (défilement horizontal)">
      <table className="w-full min-w-[64rem] border-collapse text-left tabular-nums" data-testid="synthese-demande">
        <caption className="sr-only">Synthèse de la demande par produit, en unités réelles</caption>
        <thead>
          <tr className="border-b-2 border-chocolat/20">
            <th scope="col" className="p-3">
              Produit
            </th>
            {COLUMNS.map((c) => (
              <th key={c.key} scope="col" className="p-3 text-[0.9rem]">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {demand.map((row) => (
            <tr key={row.productId} className="border-b border-dashed border-chocolat/20">
              <th scope="row" className="p-3 font-bold">
                {row.name}
              </th>
              {COLUMNS.map((c) => (
                <td key={c.key} className="p-3">
                  {row[c.key] === null ? "—" : String(row[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Step({ step, current, title, intro, children, visibleToClients }: { step: CycleStepKey; current: CycleStepKey; title: string; intro: string; children: React.ReactNode; visibleToClients?: string }) {
  const index = CYCLE_STEPS.findIndex((s) => s.key === step);
  const currentIndex = CYCLE_STEPS.findIndex((s) => s.key === current);
  const state = index < currentIndex ? "passee" : index === currentIndex ? "en-cours" : "a-venir";
  // Une chose à la fois : l'étape en cours et la suivante sont ouvertes, les autres repliées (un geste pour les rouvrir).
  const expanded = index === currentIndex || index === currentIndex + 1;
  return (
    <details
      id={`etape-${step}`}
      aria-labelledby={`titre-${step}`}
      open={expanded}
      className={cn(
        "group/etape flex scroll-mt-24 flex-col gap-4 rounded-[14px] border-2 p-4 sm:p-6 [&[open]>summary]:mb-4",
        state === "en-cours" ? "border-chocolat bg-blanc-casse shadow-[0_4px_0_var(--ohm-chocolat)]" : "border-chocolat/15 bg-blanc-casse/60",
      )}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-full font-display text-[1.1rem]", state === "passee" ? "bg-chocolat text-creme" : state === "en-cours" ? "bg-caramel text-cacao" : "border-2 border-chocolat/25 text-encre-douce")} aria-hidden>
          {state === "passee" ? "✓" : index + 1}
        </span>
        <p id={`titre-${step}`} className="font-display text-[1.5rem] leading-tight">
          Étape {index + 1} · {title}
        </p>
        {state === "en-cours" && <span className="atelier-annotation text-[1.1rem]">← vous êtes ici</span>}
        {!expanded && <span className="ml-auto text-[0.95rem] font-bold text-encre-douce group-open/etape:hidden">{state === "passee" ? "Terminée · voir" : "Plus tard · voir"}</span>}
      </summary>
      <div className="flex flex-col gap-4">
        <details className="text-[0.95rem] text-encre-douce">
          <summary className="cursor-pointer font-bold">À quoi sert cette étape ?</summary>
          <p className="mt-1">{intro}</p>
          {visibleToClients && <p className="mt-1">Visible des clientes : {visibleToClients}</p>}
        </details>
        {children}
      </div>
    </details>
  );
}

function Figure({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="atelier-etiquette bg-rose/40 py-2 pl-4 pr-6">
      <p className="font-display text-[1.5rem] leading-none tabular-nums">{value}</p>
      <p className="text-[0.92rem] font-bold">{label}</p>
    </div>
  );
}

export default async function FourneeAdmin({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const cycle = await getCycle(id);
  if (!cycle) notFound();
  const now = serverNow();
  const [products, flavors, setup, report, lastPrint] = await Promise.all([listProducts(), listFlavors(), getCycleSetup(id), getCycleReport(id), lastProductionPrint(id)]);
  const demand = await getCycleDemand(id, products);
  const phase = cycle.status === "draft" ? null : cyclePhase(cycle, now);
  const deadlinePassed = cycle.status === "open" && phase === "closed";
  const afterClose = ["closed", "preparing", "delivering", "surplus", "done"].includes(cycle.status) || phase === "closed";
  const hasSurplusSlots = setup.slots.some((s) => s.phase === "surplus" && s.isActive && isUpcoming(s.endsAt));
  const step = currentCycleStep(cycle, now);
  const stepIndex = CYCLE_STEPS.findIndex((s) => s.key === step);
  const checks = openingChecks({
    products: setup.products.length,
    preorderSlots: setup.slots.filter((s) => s.phase === "preorder" && s.isActive).length,
    opensAt: cycle.opensAt,
    closesAt: cycle.closesAt,
    fulfillmentDate: cycle.fulfillmentDate,
    now,
  });
  const opensMs = Date.parse(cycle.opensAt);
  const closesMs = Date.parse(cycle.closesAt);
  const progress = Math.round(Math.min(1, Math.max(0, (now - opensMs) / Math.max(1, closesMs - opensMs))) * 100);
  const produced = demand.reduce((s, d) => s + (d.produced ?? 0), 0);
  const lost = demand.reduce((s, d) => s + (d.lost ?? 0), 0);
  const surplusSold = demand.reduce((s, d) => s + (d.surplusSold ?? 0), 0);
  const remaining = demand.reduce((s, d) => s + (d.remaining ?? 0), 0);
  const isDraftLike = cycle.status === "draft" || cycle.status === "scheduled";
  const link = "font-bold underline decoration-caramel decoration-2 underline-offset-4";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">
          Fournée n°{cycle.number} · {phase ? cyclePhaseLabel[phase] : "Brouillon"}
        </h1>
        <p className="text-encre-douce">
          Précommandes jusqu&apos;au {formatDay(cycle.closesAt)} à {formatTime(cycle.closesAt)} (heure de Dakar) · {productionLabel(cycle)} · Livraison et
          retrait le {formatDay(cycle.fulfillmentDate)}.
        </p>
        {deadlinePassed && (
          <p className="font-bold text-orange-encre">
            La date limite est passée : plus aucune précommande n&apos;est acceptée. La clôture se fait toute seule dans quelques minutes (ou tout de suite avec le bouton ci-dessous).
          </p>
        )}
        <p className="flex flex-wrap gap-4">
          {cycle.status !== "draft" && (
            <Link href={`/fournees/${cycle.number}`} className={link}>
              Aperçu client (page publique)
            </Link>
          )}
          <Link href={`/admin/fournees/${cycle.id}/production`} className={link}>
            Fiche de production (imprimable)
          </Link>
          <Link href={`/admin/commandes?fournee=${cycle.id}`} className={link}>
            Commandes de la fournée
          </Link>
        </p>
      </header>

      {/* Parcours : sept étapes, une seule en cours. */}
      <nav aria-label="Parcours de la fournée" className="flex flex-col gap-2">
        <p className="font-bold sm:hidden">
          Étape {stepIndex + 1} sur {CYCLE_STEPS.length} : {CYCLE_STEPS[stepIndex]!.label}
        </p>
        <ol className="grid grid-cols-7 gap-1 sm:gap-2">
          {CYCLE_STEPS.map((s, i) => (
            <li key={s.key}>
              <a
                href={`#etape-${s.key}`}
                aria-current={i === stepIndex ? "step" : undefined}
                className={cn(
                  "flex h-2 rounded-full sm:h-auto sm:min-h-11 sm:items-center sm:justify-center sm:rounded-[8px] sm:border-2 sm:px-2 sm:text-center sm:text-[0.85rem] sm:font-bold",
                  i < stepIndex && "bg-chocolat sm:border-chocolat sm:text-creme",
                  i === stepIndex && "bg-caramel sm:border-caramel sm:bg-rose/60 sm:text-chocolat",
                  i > stepIndex && "bg-chocolat/15 sm:border-dashed sm:border-chocolat/25 sm:bg-transparent sm:text-encre-douce",
                )}
              >
                <span className="sr-only sm:not-sr-only">{s.label}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <section aria-labelledby="action-principale" className="ohm-cacao flex flex-col gap-3 rounded-[16px] p-5 sm:p-6">
        <p id="action-principale" className="atelier-annotation text-[1.15rem] text-rose">
          Action de l&apos;étape
        </p>
        {cycle.status === "open" && !deadlinePassed && phase === "open" && (
          <p className="text-creme/90">
            Les précommandes se fermeront automatiquement <Countdown target={cycle.closesAt} serverNow={now} /> (le {formatDay(cycle.closesAt)} à{" "}
            {formatTime(cycle.closesAt)}), même si personne ne se connecte.
          </p>
        )}
        <div className="rounded-[12px] bg-blanc-casse p-4 text-chocolat">
          <CycleStatusActions cycle={cycle} deadlinePassed={deadlinePassed} />
        </div>
      </section>

      <Step step="preparer" current={step} title="Préparer" intro="Dates, produits, formats, parfums et créneaux. Tant que la fournée est en brouillon, rien n'est visible des clientes." visibleToClients="non, tant que la fournée n'est pas ouverte ou programmée.">
        <ul className="grid gap-2 sm:grid-cols-2">
          {checks.map((c) => (
            <li key={c.label} className={cn("flex items-center gap-2 font-bold", c.ok ? "text-succes" : "text-erreur")}>
              <span aria-hidden>{c.ok ? "✓" : "✗"}</span>
              {c.label}
              <span className="sr-only">{c.ok ? " : vérifié" : " : à compléter"}</span>
            </li>
          ))}
        </ul>
        <details open={isDraftLike} className="flex flex-col gap-6">
          <summary className="min-h-11 cursor-pointer font-bold underline decoration-caramel decoration-2 underline-offset-4">Configuration, produits et créneaux</summary>
          <div className="mt-4 flex flex-col gap-8">
            <section aria-labelledby="infos" className="max-w-3xl">
              <h2 id="infos" className="mb-4 font-display text-[1.4rem]">
                Configuration de la fournée
              </h2>
              <CycleForm cycle={cycle} products={products} nextNumber={cycle.number} />
            </section>
            <section aria-labelledby="produits">
              <h2 id="produits" className="mb-4 font-display text-[1.4rem]">
                Produits, formats et parfums
              </h2>
              <CycleProductsEditor cycleId={cycle.id} products={products} flavors={flavors} setup={setup} />
            </section>
            <section aria-labelledby="creneaux">
              <h2 id="creneaux" className="mb-4 font-display text-[1.4rem]">
                Créneaux de livraison et de retrait
              </h2>
              <SlotsEditor cycleId={cycle.id} slots={setup.slots} fulfillmentDate={cycle.fulfillmentDate} />
            </section>
          </div>
        </details>
      </Step>

      <Step step="ouvrir" current={step} title="Ouvrir" intro="L'ouverture rend la fournée visible et permet de précommander jusqu'à la date limite. Elle demande toujours votre confirmation." visibleToClients="oui, dès l'ouverture.">
        <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]">
          <dt className="font-bold">Ouverture</dt>
          <dd>
            {formatDay(cycle.opensAt)} à {formatTime(cycle.opensAt)}
          </dd>
          <dt className="font-bold">Date limite</dt>
          <dd>
            {formatDay(cycle.closesAt)} à {formatTime(cycle.closesAt)}
          </dd>
          <dt className="font-bold">Produits</dt>
          <dd>{setup.products.length}</dd>
          <dt className="font-bold">Créneaux de précommande</dt>
          <dd>{setup.slots.filter((s) => s.phase === "preorder" && s.isActive).length}</dd>
        </dl>
      </Step>

      <Step step="suivre" current={step} title="Suivre les commandes" intro="Les commandes arrivent pendant la période de précommande. Une commande ne compte vraiment qu'une fois son paiement vérifié." visibleToClients="la date limite et les produits.">
        <div className="flex flex-wrap gap-3">
          <Figure value={report.orders} label={report.orders > 1 ? "commandes" : "commande"} />
          <Figure value={report.paid} label={report.paid > 1 ? "payées" : "payée"} />
          {report.waveToVerify > 0 && <Figure value={report.waveToVerify} label="paiements à vérifier" />}
          <Figure value={formatFcfa(report.confirmedFcfa)} label="confirmés (produits)" />
        </div>
        {cycle.status === "open" && phase === "open" && (
          <div className="flex flex-col gap-1">
            <p className="font-bold">Avancement vers la date limite : {progress} %</p>
            <span aria-hidden className="h-3 overflow-hidden rounded-full bg-chocolat/10">
              <span className="block h-full rounded-full bg-caramel" style={{ width: `${progress}%` }} />
            </span>
          </div>
        )}
        {report.waveToVerify > 0 && (
          <Link href="/admin/paiements" className={link}>
            Vérifier les paiements Wave
          </Link>
        )}
        <section aria-labelledby="demande" className="flex flex-col gap-3">
          <h2 id="demande" className="font-display text-[1.4rem]">
            Synthèse de la demande
          </h2>
          <ul className="grid gap-2 sm:hidden">
            {demand.map((d) => (
              <li key={d.productId} className="rounded-[10px] bg-creme p-3">
                <p className="font-bold">{d.name}</p>
                <p className="text-[0.95rem] tabular-nums">
                  Commandé {d.ordered} · payé {d.paid} · à vérifier {d.toVerify} · à produire {d.toProduce + d.extra}
                </p>
              </li>
            ))}
          </ul>
          <p className="text-encre-douce">
            Le minimum à réserver vient des commandes payées et confirmées. Les commandes provisoires ou annulées n&apos;augmentent pas la production.
          </p>
          <DemandTable demand={demand} />
        </section>
      </Step>

      <Step step="produire" current={step} title="Produire" intro="À la date limite, les précommandes se clôturent seules et les quantités sont figées. Le jour de production, la fournée et les commandes payées passent seules en préparation. Imprimez la fiche, puis saisissez la production réelle." visibleToClients="« Précommandes terminées » après la date limite.">
        <p>
          <Link href={`/admin/fournees/${cycle.id}/production`} className={link}>
            Ouvrir la fiche de production
          </Link>
          {lastPrint ? (
            <span className="text-encre-douce">
              {" "}
              · dernière impression le {formatDay(lastPrint.printedAt)} à {formatTime(lastPrint.printedAt)}
              {lastPrint.printedBy ? ` par ${lastPrint.printedBy}` : ""}
            </span>
          ) : (
            <span className="text-encre-douce"> · pas encore imprimée</span>
          )}
        </p>
        <section aria-labelledby="production" className="flex flex-col gap-3">
          <h2 id="production" className="font-display text-[1.4rem]">
            Production
          </h2>
          {stepIndex >= 3 ? (
            <ProductionEditor cycleId={cycle.id} cycleStatus={cycle.status} demand={demand} inventory={setup.inventory} />
          ) : (
            <details>
              <summary className="min-h-11 cursor-pointer font-bold underline decoration-caramel decoration-2 underline-offset-4">
                Préparer un supplément dès maintenant (facultatif)
              </summary>
              <div className="mt-3">
                <ProductionEditor cycleId={cycle.id} cycleStatus={cycle.status} demand={demand} inventory={setup.inventory} />
              </div>
            </details>
          )}
        </section>
      </Step>

      <Step step="livrer" current={step} title="Livrer" intro="Le jour de remise, la fournée passe seule en livraison. Marquez les commandes prêtes, confiez les livraisons au livreur et remettez les retraits. Quand tout est remis et qu'il ne reste rien, la fournée se termine seule. Les frais de livraison se règlent toujours au livreur." visibleToClients="l'étape de leur commande sur la page de suivi.">
        <div className="flex flex-wrap gap-3">
          <Figure value={report.ready} label={report.ready > 1 ? "prêtes" : "prête"} />
          <Figure value={report.pickups} label="retraits" />
          <Figure value={report.deliveries} label="livraisons" />
          <Figure value={report.served} label="remises" />
        </div>
        <p className="flex flex-wrap gap-4">
          <Link href="/admin/livraisons" className={link}>
            Carte et tournée des livraisons
          </Link>
          <Link href={`/admin/commandes?vue=creneau&fournee=${cycle.id}`} className={link}>
            Commandes par créneau
          </Link>
        </p>
      </Step>

      <Step step="surplus" current={step} title="Gérer le surplus" intro="Le surplus théorique est calculé à partir de la production réelle et des pertes. Rien n'est publié sans votre confirmation." visibleToClients="seulement après « Publier le surplus disponible ».">
        {afterClose ? (
          <section aria-labelledby="surplus" className="flex flex-col gap-3">
            <h2 id="surplus" className="font-display text-[1.4rem]">
              Surplus
            </h2>
            <SurplusPublisher
              cycleId={cycle.id}
              cycleStatus={cycle.status}
              demand={demand}
              inventory={setup.inventory}
              surplusEndsAt={cycle.surplusEndsAt}
              surplusDeliveryAllowed={cycle.surplusDeliveryAllowed}
              hasSurplusSlots={hasSurplusSlots}
            />
            {cycle.status === "surplus" && (
              <ul className="flex flex-col gap-2">
                {demand
                  .filter((d) => d.available > 0)
                  .map((d) => (
                    <li key={d.productId} className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] bg-creme p-3">
                      <span>
                        <strong>{d.name}</strong> · {d.available} {d.unitLabelPlural} en vente
                      </span>
                      <WithdrawSurplus cycleId={cycle.id} productId={d.productId} name={d.name} />
                    </li>
                  ))}
              </ul>
            )}
          </section>
        ) : (
          <p className="text-encre-douce">Le surplus se prépare après la clôture des précommandes et la saisie de la production réelle.</p>
        )}
      </Step>

      <Step step="terminer" current={step} title="Terminer" intro="Le bilan ne compte que les commandes réellement payées. Terminer la fournée l'archive ; elle reste consultable." visibleToClients="la fournée passe dans « Nos fournées » comme terminée.">
        <p className="font-bold">{cycle.status === "done" ? "Bilan de la fournée" : "Bilan provisoire (mis à jour en temps réel)"}</p>
        <div className="flex flex-wrap gap-3">
          <Figure value={formatFcfa(report.netFcfa)} label="ventes payées, nettes des remboursements" />
          <Figure value={report.served} label="commandes servies" />
          <Figure value={report.cancelled} label="annulations" />
          {report.refundedFcfa > 0 && <Figure value={formatFcfa(report.refundedFcfa)} label="remboursés" />}
          {produced > 0 && <Figure value={produced} label="unités produites" />}
          {lost > 0 && <Figure value={lost} label="unités perdues" />}
          {surplusSold > 0 && <Figure value={surplusSold} label="vendues en surplus" />}
          {afterClose && produced > 0 && <Figure value={remaining} label="unités restantes" />}
        </div>
        {report.topProducts.length > 0 ? (
          <div>
            <p className="font-bold">Les plus commandés (unités payées)</p>
            <ol className="mt-1 list-decimal pl-6">
              {report.topProducts.map((p) => (
                <li key={p.name}>
                  {p.name} · {p.units}
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <p className="text-encre-douce">Aucune commande payée pour le moment : le bilan se remplira au fil des paiements vérifiés.</p>
        )}
      </Step>
    </div>
  );
}
