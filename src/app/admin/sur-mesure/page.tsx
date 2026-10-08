import Link from "next/link";
import { QueryFilters } from "@/components/admin/OrderFilters";
import { requireAdmin } from "@/lib/auth/session";
import { listCustomRequestsForAdmin } from "@/lib/custom/data";
import { CUSTOM_STATUSES, customStatusLabel } from "@/lib/custom/status";
import { formatDay, formatTime } from "@/lib/dates";
import { formatSenegalPhone } from "@/lib/phone";

export const metadata = { title: "Sur-mesure" };

export default async function AdminSurMesure({ searchParams }: { searchParams: Promise<{ q?: string; statut?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const requests = await listCustomRequestsForAdmin({ q: sp.q, status: sp.statut });
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">Demandes sur-mesure</h1>
      <QueryFilters filters={[{ name: "statut", label: "Statut", options: CUSTOM_STATUSES.map((s) => ({ value: s, label: customStatusLabel[s] })) }]} />
      {requests.length === 0 ? (
        <p>Aucune demande.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {requests.map((r) => (
            <li key={r.id} className="rounded-[12px] border-2 border-chocolat/20 bg-blanc-casse p-4">
              <Link href={`/admin/sur-mesure/${r.id}`} className="font-display text-[1.3rem] underline decoration-caramel decoration-2 underline-offset-4">
                {r.reference} · {r.occasion}
              </Link>
              <p>
                {formatDay(r.eventAt)}, {formatTime(r.eventAt)} · {r.guests ?? "?"} pers.
              </p>
              <p className="text-encre-douce">
                {r.customerName} · {formatSenegalPhone(r.customerPhone)}
              </p>
              <p className="font-bold">{customStatusLabel[r.status]}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
