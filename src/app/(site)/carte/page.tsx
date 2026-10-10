import type { Metadata } from "next";
import Link from "next/link";
import { BrandHeading } from "@/components/brand/BrandHeading";
import { CarteExperience } from "@/components/catalog/CarteExperience";
import { getCatalog } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { cycleStatusLine } from "@/lib/cycle-status";

export const metadata: Metadata = {
  title: "La carte",
  description: "Cookies, brownies, moelleux, muffins, cake à l'orange, choux et verrines : formats et prix de la carte OHMEGATO.",
};

export default async function CartePage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const { vue } = await searchParams;
  const { cycle, products } = await getCatalog();
  const showAll = vue === "tout" || !cycle;
  const visible = showAll ? products : products.filter((p) => p.inCycle);

  const tab = "inline-flex min-h-11 items-center rounded-full border-2 px-4 font-bold";
  return (
    <>
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 pb-8 pt-8 sm:px-6 md:flex-row md:items-end md:justify-between">
        <div>
          <BrandHeading as="h1" size="titre">
            La carte
          </BrandHeading>
          {cycle && (
            <p className="mt-2 text-encre-douce">
              {cycleStatusLine(cycle)}
            </p>
          )}
        </div>
        {cycle && (
          <nav aria-label="Vue de la carte" className="flex gap-2">
            <Link
              href="/carte"
              aria-current={!showAll ? "page" : undefined}
              className={cn(tab, !showAll ? "border-chocolat bg-chocolat text-creme" : "border-chocolat/35")}
            >
              Dans la fournée
            </Link>
            <Link
              href="/carte?vue=tout"
              aria-current={showAll ? "page" : undefined}
              className={cn(tab, showAll ? "border-chocolat bg-chocolat text-creme" : "border-chocolat/35")}
            >
              Toute la carte
            </Link>
          </nav>
        )}
      </div>
      <CarteExperience key={showAll ? "tout" : "fournee"} products={visible} />
    </>
  );
}
