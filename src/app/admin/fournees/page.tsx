import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { listCycles } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/session";
import { cyclePhase, cyclePhaseLabel } from "@/lib/cycle-status";
import { formatDay } from "@/lib/dates";

export const metadata = { title: "Fournées" };

export default async function AdminFournees() {
  await requireAdmin();
  const cycles = await listCycles();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">Fournées</h1>
        <ButtonLink href="/admin/fournees/nouvelle">Créer une fournée</ButtonLink>
      </div>
      {cycles.length === 0 ? (
        <p>Aucune fournée.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {cycles.map((c) => (
            <li key={c.id} className="rounded-[12px] border-2 border-chocolat/20 bg-blanc-casse p-4">
              <Link href={`/admin/fournees/${c.id}`} className="font-display text-[1.4rem] underline decoration-caramel decoration-2 underline-offset-4">
                n°{c.number} — {c.title}
              </Link>
              <p className="font-bold">{c.status === "draft" ? "Brouillon" : cyclePhaseLabel[cyclePhase(c)]}</p>
              <p className="text-encre-douce">Livraison et retrait : {formatDay(c.fulfillmentDate)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
