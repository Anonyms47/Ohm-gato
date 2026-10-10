import type { Metadata } from "next";
import Link from "next/link";
import { Annotation, BrandHeading } from "@/components/brand/BrandHeading";
import { FourneePoster } from "@/components/cycles/FourneePoster";
import { brand } from "@/config/brand";
import { getArchivedCycles, getCatalog, getSlots, getUpcomingCycles } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { phaseNow } from "@/lib/cycle-status";
import { formatDay, formatTime } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Nos fournées",
  description: "Fournées OHMEGATO : commandez avant la date limite, production selon les commandes, livraison ou retrait le jour prévu, surplus éventuel.",
  alternates: { canonical: "/fournees" },
};

export default async function FourneesPage() {
  const { cycle, products } = await getCatalog();
  const phase = cycle ? phaseNow(cycle) : null;
  const [upcoming, archives, slots] = await Promise.all([
    getUpcomingCycles(cycle?.id ?? null),
    getArchivedCycles(),
    cycle ? getSlots(cycle.id, phase === "surplus" ? "surplus" : "preorder") : Promise.resolve([]),
  ]);
  const inCycle = products.filter((p) => p.inCycle && (phase !== "surplus" || (p.unitsLeft ?? 0) > 0));
  const next = upcoming[0] ?? null;

  return (
    <div className="ohm-grille">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <Annotation>carnet de bord</Annotation>
        <BrandHeading as="h1" size="titre">
          Nos fournées
        </BrandHeading>
        <p className="mt-3 max-w-prose text-[1.1rem]">
          OHMEGATO cuisine par fournées. Vous commandez avant la date limite, Alima prépare selon les commandes reçues, puis livre ou remet votre
          boîte le jour prévu. S&apos;il reste des douceurs après les commandes confirmées, elles peuvent être proposées ensuite.
        </p>

        {cycle && phase ? (
          <>
            <FourneePoster cycle={cycle} phase={phase} products={inCycle} slots={slots} />
            <p className="mt-3">
              <Link href={`/fournees/${cycle.number}`} className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
                Page de la fournée n°{cycle.number}
              </Link>
            </p>
          </>
        ) : (
          <section className="mt-8 rounded-[14px] border-2 border-dashed border-chocolat/40 bg-blanc-casse p-6">
            <h2 className="font-display text-[1.8rem]">Aucune fournée en cours</h2>
            <p className="mt-2">La prochaine fournée est annoncée ici et sur Instagram dès que ses dates sont fixées.</p>
          </section>
        )}

        {/* Prochaine fournée */}
        <section aria-labelledby="prochaine" id="prochaine" className="mt-12 scroll-mt-28">
          <h2 id="prochaine" className="font-display text-[clamp(1.6rem,4vw,2.2rem)]">
            Prochaine fournée
          </h2>
          {next ? (
            <div className="mt-4 rounded-[12px] border-2 border-chocolat/30 bg-blanc-casse p-5">
              <p className="font-bold">
                Fournée n°{next.number} — {next.title}
              </p>
              <p className="mt-1">
                Commandes jusqu&apos;au {formatDay(next.closesAt)} à {formatTime(next.closesAt)}. Livraison et retrait le {formatDay(next.fulfillmentDate)}.
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
                    <Link href={`/fournees/${archive.number}`} className="font-display text-[1.3rem] underline decoration-caramel decoration-2 underline-offset-4">
                      n°{archive.number}
                    </Link>
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
