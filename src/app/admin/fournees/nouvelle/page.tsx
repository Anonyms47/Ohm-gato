import Link from "next/link";
import { CycleForm } from "@/components/admin/CycleEditors";
import { DuplicateCycleForm } from "@/components/admin/DuplicateCycleForm";
import { getCycleSetup, listCycles, listProducts } from "@/lib/admin/data";
import { serverNow } from "@/lib/admin/today";
import { requireAdmin } from "@/lib/auth/session";
import { formatDay } from "@/lib/dates";

export const metadata = { title: "Nouvelle fournée" };

const WEEK = 7 * 86_400_000;
const localDateTime = (ms: number) => new Date(ms).toISOString().slice(0, 16);
const localDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Dates proposées : celles de la fournée source, décalées de semaines entières jusqu'à être à venir. */
function suggestedDates(source: { opensAt: string; closesAt: string; productionDate: string; fulfillmentDate: string }, now: number) {
  const closes = Date.parse(source.closesAt);
  const weeks = Math.max(1, Math.ceil((now - closes) / WEEK) + 1);
  const shift = weeks * WEEK;
  return {
    opensAt: localDateTime(Math.max(now, Date.parse(source.opensAt) + shift)),
    closesAt: localDateTime(closes + shift),
    productionDate: localDate(Date.parse(`${source.productionDate}T12:00:00Z`) + shift),
    fulfillmentDate: localDate(Date.parse(`${source.fulfillmentDate}T12:00:00Z`) + shift),
  };
}

export default async function NouvelleFournee({ searchParams }: { searchParams: Promise<{ depuis?: string }> }) {
  await requireAdmin();
  const { depuis } = await searchParams;
  const [cycles, products] = await Promise.all([listCycles(), listProducts()]);
  const nextNumber = Math.max(0, ...cycles.map((c) => c.number)) + 1;
  // Les fournées déjà ouvertes d'abord (elles ont fait leurs preuves), puis les brouillons.
  const previous = cycles.filter((c) => c.status !== "cancelled").sort((a, b) => Number(a.status === "draft") - Number(b.status === "draft") || b.number - a.number);
  const source = depuis ? previous.find((c) => c.id === depuis) : null;
  const link = "font-bold underline decoration-caramel decoration-2 underline-offset-4";

  if (source) {
    const setup = await getCycleSetup(source.id);
    const slots = setup.slots.filter((s) => s.phase === "preorder" && s.isActive).length;
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">Nouvelle fournée depuis la n°{source.number}</h1>
        <p className="text-encre-douce">
          Reprend {setup.products.length} produit{setup.products.length > 1 ? "s" : ""} (formats et parfums compris) et {slots} créneau{slots > 1 ? "x" : ""} de
          précommande, décalés aux nouvelles dates. La fournée est créée en brouillon, invisible des clientes, jusqu&apos;à son ouverture.
        </p>
        <DuplicateCycleForm sourceId={source.id} defaults={{ number: nextNumber, ...suggestedDates(source, serverNow()) }} />
        <Link href="/admin/fournees/nouvelle" className={link}>
          Partir d&apos;une fournée vide
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">Nouvelle fournée</h1>
      {previous.length > 0 && (
        <section aria-labelledby="reprendre" className="atelier-ticket flex flex-col gap-3 p-5">
          <h2 id="reprendre" className="font-display text-[1.35rem]">
            Le plus rapide : reprendre une fournée
          </h2>
          <p className="text-encre-douce">Produits, formats, parfums et créneaux repris en un clic ; il ne reste qu&apos;à choisir les dates.</p>
          <ul className="flex flex-col gap-2">
            {previous.slice(0, 3).map((c) => (
              <li key={c.id}>
                <Link href={`/admin/fournees/nouvelle?depuis=${c.id}`} className="inline-flex min-h-11 items-center rounded-[10px] bg-chocolat px-4 font-bold text-creme">
                  Reprendre la fournée n°{c.number} · livrée le {formatDay(c.fulfillmentDate)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <h2 className="font-display text-[1.35rem]">Ou partir d&apos;une fournée vide</h2>
      <p className="text-encre-douce">La fournée est créée en brouillon, invisible des clients. Ajoutez ensuite produits et créneaux.</p>
      <CycleForm cycle={null} products={products} nextNumber={nextNumber} />
    </div>
  );
}
