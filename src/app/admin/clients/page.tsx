import Link from "next/link";
import { QueryFilters } from "@/components/admin/OrderFilters";
import { listCustomers } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/session";
import { formatShortDay } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { formatSenegalPhone } from "@/lib/phone";

export const metadata = { title: "Clients" };

export default async function AdminClients({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q } = await searchParams;
  const customers = await listCustomers(q ?? null);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">Clients</h1>
      <QueryFilters filters={[]} searchLabel="Nom ou téléphone" />
      {customers.length === 0 ? (
        <p>Aucun client.</p>
      ) : (
        <div className="overflow-x-auto rounded-[12px] bg-blanc-casse">
          <table className="w-full min-w-[40rem] text-left">
            <caption className="sr-only">Clients</caption>
            <thead>
              <tr className="border-b-2 border-chocolat/20">
                <th className="p-3">Client</th>
                <th className="p-3">Compte</th>
                <th className="p-3 text-right">Commandes</th>
                <th className="p-3 text-right">Payé (produits)</th>
                <th className="p-3">Dernière commande</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.phone} className="border-b border-dashed border-chocolat/15">
                  <td className="p-3">
                    <Link href={`/admin/clients/${encodeURIComponent(c.phone)}`} className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
                      {c.name ?? "—"}
                    </Link>
                    <span className="block text-[0.9rem] text-encre-douce">{formatSenegalPhone(c.phone)}</span>
                  </td>
                  <td className="p-3">{c.user_id ? "Membre" : "Invité"}</td>
                  <td className="p-3 text-right tabular-nums">
                    {c.orders_count}
                    {c.requests_count > 0 ? ` (+${c.requests_count} sur-mesure)` : ""}
                  </td>
                  <td className="p-3 text-right tabular-nums">{formatFcfa(Number(c.paid_total_fcfa))}</td>
                  <td className="p-3">{c.last_order_at ? formatShortDay(c.last_order_at) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
