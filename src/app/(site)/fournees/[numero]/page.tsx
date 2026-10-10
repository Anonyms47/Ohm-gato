import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Annotation } from "@/components/brand/BrandHeading";
import { FourneePoster } from "@/components/cycles/FourneePoster";
import { getCatalog, getCycleByNumber, getCycleProductNames, getSlots } from "@/lib/catalog";
import { phaseNow, productionLabel } from "@/lib/cycle-status";

type Props = { params: Promise<{ numero: string }> };

function parseNumber(raw: string): number | null {
  return /^\d{1,6}$/.test(raw) ? Number(raw) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const number = parseNumber((await params).numero);
  const cycle = number ? await getCycleByNumber(number) : null;
  if (!cycle) return { title: "Fournée introuvable", robots: { index: false } };
  const description = `${cycle.title} — ${productionLabel(cycle)}`;
  return {
    title: `Fournée n°${cycle.number}`,
    description,
    alternates: { canonical: `/fournees/${cycle.number}` },
    openGraph: { title: `Fournée n°${cycle.number} · OHMEGATO`, description, url: `/fournees/${cycle.number}` },
  };
}

/** Page d'une fournée publiée (jamais un brouillon). */
export default async function FourneePage({ params }: Props) {
  const number = parseNumber((await params).numero);
  if (!number) notFound();
  const [cycle, catalog] = await Promise.all([getCycleByNumber(number), getCatalog()]);
  if (!cycle) notFound();
  const isCurrent = catalog.cycle?.id === cycle.id;
  const shown = isCurrent ? catalog.cycle! : cycle;
  const phase = phaseNow(shown);
  const [slots, names] = await Promise.all([
    getSlots(cycle.id, phase === "surplus" ? "surplus" : "preorder"),
    isCurrent ? Promise.resolve([]) : getCycleProductNames(cycle.id),
  ]);
  const products = isCurrent ? catalog.products.filter((p) => p.inCycle && (phase !== "surplus" || (p.unitsLeft ?? 0) > 0)) : null;

  return (
    <div className="ohm-grille">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <Link href="/fournees" className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
          ← Nos fournées
        </Link>
        <Annotation className="mt-4 block">le journal du four</Annotation>
        <FourneePoster cycle={shown} phase={phase} products={products} slots={slots} productNames={names} headingLevel="h1" />
      </div>
    </div>
  );
}
