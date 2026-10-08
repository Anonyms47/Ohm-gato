import Link from "next/link";
import { CustomerNotes } from "@/components/admin/CustomerNotes";
import { getCustomer } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/session";
import { customStatusLabel, type CustomStatus } from "@/lib/custom/status";
import { formatShortDay } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { paymentStatusLabel, statusHeadline } from "@/lib/order-status";
import { formatSenegalPhone } from "@/lib/phone";

export const metadata = { title: "Client" };

export default async function AdminClient({ params }: { params: Promise<{ phone: string }> }) {
  await requireAdmin();
  const phone = decodeURIComponent((await params).phone);
  const c = await getCustomer(phone);
  const name = c.orders[0]?.customerName ?? c.profile?.full_name ?? "Client";
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">{name}</h1>
        <p>
          {formatSenegalPhone(phone)} · {c.profile ? `membre depuis le ${formatShortDay(c.profile.created_at)}` : "client invité (sans compte)"}
        </p>
        <a href={`https://wa.me/${phone.replace(/^\+/, "")}`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-bold underline decoration-caramel decoration-2 underline-offset-4">
          Écrire sur WhatsApp
        </a>
      </header>

      {c.profile && (
        <section className="rounded-[12px] bg-blanc-casse p-5">
          <h2 className="font-display text-[1.4rem]">Consentements</h2>
          <p>Nouvelles d&apos;OHMEGATO : {c.profile.marketing_consent ? "accepté" : "refusé"}</p>
          <p>Suivi des commandes : {c.profile.order_updates_consent ? "accepté" : "refusé"}</p>
          {c.profile.consents_updated_at && <p className="text-encre-douce">Modifié le {formatShortDay(c.profile.consents_updated_at)}</p>}
          {c.addresses.length > 0 && (
            <>
              <h3 className="mt-4 font-bold">Adresses enregistrées</h3>
              <ul>
                {c.addresses.map((a) => (
                  <li key={a.id}>
                    {a.label ? `${a.label} : ` : ""}
                    {a.address_line}
                    {a.district ? `, ${a.district}` : ""}
                    {a.landmark ? ` · ${a.landmark}` : ""}
                    {a.latitude !== null ? " · position enregistrée" : ""}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <section>
        <h2 className="font-display text-[1.4rem]">Commandes ({c.orders.length})</h2>
        <ul className="mt-2 flex flex-col gap-1">
          {c.orders.map((o) => (
            <li key={o.id}>
              <Link href={`/admin/commandes/${o.id}`} className="font-bold underline underline-offset-4">
                {o.reference}
              </Link>{" "}
              · {formatShortDay(o.createdAt)} · {formatFcfa(o.totalFcfa)} · {statusHeadline[o.status]} · {paymentStatusLabel[o.paymentStatus].toLowerCase()}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-[1.4rem]">Demandes sur-mesure ({c.requests.length})</h2>
        <ul className="mt-2">
          {c.requests.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/sur-mesure/${r.id}`} className="font-bold underline underline-offset-4">
                {r.reference}
              </Link>{" "}
              · {r.occasion} · {customStatusLabel[r.status as CustomStatus]}
            </li>
          ))}
        </ul>
      </section>

      <section className="max-w-2xl">
        <h2 className="mb-3 font-display text-[1.4rem]">Notes internes</h2>
        <CustomerNotes phone={phone} notes={c.notes} />
      </section>
    </div>
  );
}
