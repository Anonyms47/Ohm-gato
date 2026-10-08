import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { requireUser } from "@/lib/auth/session";
import { getMyCustomRequests } from "@/lib/custom/data";
import { customStatusLabel } from "@/lib/custom/status";
import { formatDay } from "@/lib/dates";

export const metadata: Metadata = { title: "Mes demandes sur-mesure" };

export default async function MesDemandes() {
  const user = await requireUser("/compte/sur-mesure");
  const requests = await getMyCustomRequests(user.id);
  return (
    <section aria-labelledby="demandes" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 id="demandes" className="font-display text-[1.8rem]">
          Demandes sur-mesure
        </h1>
        <ButtonLink href="/sur-mesure" variant="secondary">
          Nouvelle demande
        </ButtonLink>
      </div>
      {requests.length === 0 ? (
        <p className="text-encre-douce">Aucune demande pour l&apos;instant.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {requests.map((r) => (
            <li key={r.id} className="rounded-[12px] border-2 border-chocolat/25 bg-blanc-casse p-4">
              <p className="font-bold tabular-nums">{r.reference}</p>
              <Link href={`/compte/sur-mesure/${r.reference}`} className="font-display text-[1.35rem] underline decoration-caramel decoration-2 underline-offset-4">
                {r.occasion}
              </Link>
              <p className="text-encre-douce">
                {formatDay(r.eventAt)} · {r.guests ?? "?"} pers.
              </p>
              <p className="mt-2 font-bold">
                {customStatusLabel[r.status]}
                {r.hasOpenProposal ? " · proposition à consulter" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
