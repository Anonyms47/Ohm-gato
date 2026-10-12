import Link from "next/link";
import { DeliveryBoard } from "@/components/admin/DeliveryBoard";
import { QueryFilters } from "@/components/admin/OrderFilters";
import { activeCycle, listCycles, listDeliveries, listOrders } from "@/lib/admin/data";
import { stageLabel } from "@/lib/admin/order-stage";
import { telLink, whatsappLink, whatsappMessage } from "@/lib/admin/whatsapp";
import { requireAdmin } from "@/lib/auth/session";
import { brand } from "@/config/brand";
import { formatShortDay, formatTime } from "@/lib/dates";

export const metadata = { title: "Livraisons et retraits" };

const link = "font-bold underline decoration-caramel decoration-2 underline-offset-4";

/**
 * Liste du jour de remise : livraisons regroupées par quartier (carte et tournée), retraits à part.
 * Le prix du livreur n'est jamais calculé ni facturé : il se règle directement au livreur.
 */
export default async function AdminLivraisons({ searchParams }: { searchParams: Promise<{ fournee?: string }> }) {
  await requireAdmin();
  const { fournee } = await searchParams;
  const [cycles, current] = await Promise.all([listCycles(), activeCycle()]);
  const cycleId = fournee ?? current?.id ?? null;
  const [stops, orders] = await Promise.all([listDeliveries(cycleId), cycleId ? listOrders({ cycle: cycleId, fulfillment: "pickup" }) : Promise.resolve([])]);
  const toDeliver = stops.filter((s) => s.status !== "delivered");
  const byDistrict = new Map<string, typeof toDeliver>();
  for (const s of toDeliver) {
    const key = s.district?.trim() || "Quartier non précisé";
    byDistrict.set(key, [...(byDistrict.get(key) ?? []), s]);
  }
  const pickups = orders.filter((o) => ["confirmed", "preparing", "finishing", "ready"].includes(o.status)).sort((a, b) => (a.slotStartsAt ?? "9").localeCompare(b.slotStartsAt ?? "9"));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">Livraisons et retraits</h1>
        <p className="text-encre-douce">Les frais de livraison se règlent toujours directement au livreur : ils ne sont jamais calculés ni encaissés ici.</p>
      </header>
      <QueryFilters withSearch={false} filters={[{ name: "fournee", label: "Fournée", options: cycles.map((c) => ({ value: c.id, label: `n°${c.number}` })) }]} />

      <section aria-labelledby="quartiers" className="flex flex-col gap-3">
        <h2 id="quartiers" className="font-display text-[1.5rem]">
          Livraisons par quartier ({toDeliver.length})
        </h2>
        {byDistrict.size === 0 ? (
          <p className="text-encre-douce">Aucune livraison à faire pour cette fournée.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...byDistrict.entries()]
              .sort((a, b) => b[1].length - a[1].length)
              .map(([district, list]) => (
                <li key={district} className="atelier-ticket p-4">
                  <p className="font-display text-[1.2rem]">
                    {district} <span className="text-encre-douce">({list.length})</span>
                  </p>
                  <ul className="mt-1 text-[0.95rem]">
                    {list.map((s) => (
                      <li key={s.id}>
                        <Link href={`/admin/commandes/${s.id}`} className={link}>
                          {s.reference}
                        </Link>{" "}
                        · {s.recipientName ?? s.customerName}
                        {!s.landmark && s.latitude === null ? <strong className="text-erreur"> · repère manquant</strong> : ""}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="carte" className="flex flex-col gap-3">
        <h2 id="carte" className="font-display text-[1.5rem]">
          Carte et tournée
        </h2>
        <DeliveryBoard key={cycleId ?? "aucune"} stops={stops} />
      </section>

      <section aria-labelledby="retraits" className="flex flex-col gap-3">
        <h2 id="retraits" className="font-display text-[1.5rem]">
          Retraits à {brand.pickupAddress.split(",").pop()?.trim() ?? "l'atelier"} ({pickups.length})
        </h2>
        {pickups.length === 0 ? (
          <p className="text-encre-douce">Aucun retrait en attente.</p>
        ) : (
          <ul className="flex flex-col divide-y-2 divide-dashed divide-chocolat/15 rounded-[12px] border-2 border-chocolat/15 bg-blanc-casse">
            {pickups.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <Link href={`/admin/commandes/${o.id}`} className={link}>
                  {o.reference}
                </Link>
                <span>{o.customerName}</span>
                <span className="text-encre-douce">{o.slotStartsAt ? `${formatShortDay(o.slotStartsAt)} ${formatTime(o.slotStartsAt)}` : "sans créneau"}</span>
                <span className="font-bold">{stageLabel(o.status, o.paymentStatus, o.fulfillment)}</span>
                <span className="ml-auto flex gap-2">
                  <a href={telLink(o.customerPhone)} className="inline-flex min-h-11 items-center rounded-[10px] border-2 border-chocolat px-3 font-bold">
                    Appeler
                  </a>
                  <a
                    href={whatsappLink(o.customerPhone, whatsappMessage(o.status === "ready" ? "ready_pickup" : "general", { ...o, pickupAddress: brand.pickupAddress }))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center rounded-[10px] border-2 border-chocolat px-3 font-bold"
                  >
                    WhatsApp
                  </a>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
