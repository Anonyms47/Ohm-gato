"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { handToCourier, setOrderStatus } from "@/app/admin/_actions/orders";
import { AdminMap } from "@/components/admin/AdminMap";
import { ActionButton } from "@/components/admin/AdminUi";
import { PositionLinks } from "@/components/admin/PositionLinks";
import { DeliveryFeeNotice } from "@/components/checkout/DeliveryFeeNotice";
import { Field, TextInput } from "@/components/ui/Field";
import type { DeliveryStop } from "@/lib/admin/data";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/dates";
import { statusHeadline } from "@/lib/order-status";
import { formatSenegalPhone } from "@/lib/phone";

const tone = (s: DeliveryStop["status"]) => (s === "delivered" ? "done" : s === "out_for_delivery" ? "out" : "todo") as "todo" | "out" | "done";

/** Positions de livraison : carte, fiche de chaque arrêt, remise au livreur et fin de livraison. */
export function DeliveryBoard({ stops }: { stops: DeliveryStop[] }) {
  const located = useMemo(() => stops.filter((s) => s.latitude !== null && s.longitude !== null), [stops]);
  const [selectedId, setSelectedId] = useState<string | null>(located[0]?.id ?? stops[0]?.id ?? null);
  const [courier, setCourier] = useState({ name: "", phone: "" });
  const selected = stops.find((s) => s.id === selectedId) ?? null;
  const mapStops = located.map((s) => ({ id: s.id, label: `${s.reference} — ${s.addressLine ?? ""}`, latitude: s.latitude!, longitude: s.longitude!, tone: tone(s.status) }));

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="flex min-w-0 flex-col gap-4">
        <AdminMap stops={mapStops} selectedId={selectedId} onSelect={setSelectedId} label="Carte des livraisons : chaque repère est une commande" />
        <p className="text-[0.95rem] text-encre-douce">
          Repères : chocolat = à livrer · caramel = confiée au livreur · vert = livrée. Touchez un repère ou une ligne pour ouvrir la commande.
        </p>
        <ol className="flex flex-col gap-2">
          {stops.map((s, index) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setSelectedId(s.id)}
                aria-pressed={s.id === selectedId}
                className={cn(
                  "flex w-full flex-wrap items-center justify-between gap-2 rounded-[10px] border-2 bg-blanc-casse p-3 text-left",
                  s.id === selectedId ? "border-chocolat" : "border-chocolat/15",
                )}
              >
                <span className="font-bold">
                  {s.latitude !== null ? `${located.findIndex((l) => l.id === s.id) + 1}. ` : ""}
                  {s.reference} · {s.district ?? "—"}
                </span>
                <span className="text-encre-douce">
                  {s.slotStartsAt ? `${formatTime(s.slotStartsAt)} · ` : ""}
                  {statusHeadline[s.status]}
                  {s.latitude === null ? " · position manquante" : ""}
                </span>
                <span className="sr-only">Arrêt {index + 1}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <aside aria-label="Commande sélectionnée" className="flex flex-col gap-4">
        <DeliveryFeeNotice />
        {selected ? (
          <div className="flex flex-col gap-4 rounded-[12px] border-2 border-chocolat bg-blanc-casse p-5">
            <div>
              <Link href={`/admin/commandes/${selected.id}`} className="font-display text-[1.5rem] underline decoration-caramel decoration-2 underline-offset-4">
                {selected.reference}
              </Link>
              <p className="font-bold">{statusHeadline[selected.status]}</p>
            </div>
            <dl className="grid gap-2">
              <div>
                <dt className="font-bold">Adresse</dt>
                <dd>
                  {selected.addressLine}
                  {selected.floorDoor ? ` (${selected.floorDoor})` : ""}
                  {selected.district ? `, ${selected.district}` : ""}
                </dd>
              </div>
              <div>
                <dt className="font-bold">Point de repère</dt>
                <dd>{selected.landmark ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-bold">Destinataire</dt>
                <dd>
                  {selected.recipientName ?? selected.customerName}
                  {selected.recipientPhone && (
                    <>
                      {" · "}
                      <a href={`tel:${selected.recipientPhone}`} className="font-bold underline underline-offset-4">
                        {formatSenegalPhone(selected.recipientPhone)}
                      </a>
                    </>
                  )}
                </dd>
              </div>
              {selected.instructions && (
                <div>
                  <dt className="font-bold">Instructions</dt>
                  <dd>{selected.instructions}</dd>
                </div>
              )}
              {selected.courierName && (
                <div>
                  <dt className="font-bold">Livreur</dt>
                  <dd>
                    {selected.courierName}
                    {selected.courierPhone ? ` · ${formatSenegalPhone(selected.courierPhone)}` : ""}
                  </dd>
                </div>
              )}
            </dl>
            {selected.latitude !== null && selected.longitude !== null ? (
              <PositionLinks
                reference={selected.reference}
                latitude={selected.latitude}
                longitude={selected.longitude}
                address={[selected.addressLine, selected.district].filter(Boolean).join(", ")}
                landmark={selected.landmark}
                recipient={`${selected.recipientName ?? selected.customerName} ${selected.recipientPhone ? formatSenegalPhone(selected.recipientPhone) : ""}`}
              />
            ) : (
              <p className="font-bold text-orange-encre">Position non transmise : contactez le destinataire.</p>
            )}
            {selected.status === "ready" && (
              <div className="flex flex-col gap-3 border-t-2 border-dashed border-chocolat/20 pt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Livreur" optional>
                    {({ id }) => <TextInput id={id} value={courier.name} onChange={(e) => setCourier({ ...courier, name: e.target.value })} />}
                  </Field>
                  <Field label="Numéro du livreur" optional>
                    {({ id }) => <TextInput id={id} type="tel" value={courier.phone} onChange={(e) => setCourier({ ...courier, phone: e.target.value })} />}
                  </Field>
                </div>
                <ActionButton label="Confier au livreur" variant="primary" run={() => handToCourier(selected.id, courier.name, courier.phone)} />
              </div>
            )}
            {selected.status === "out_for_delivery" && (
              <ActionButton
                label="Livraison terminée"
                variant="primary"
                run={() => setOrderStatus(selected.id, "delivered", "")}
                confirm={{ title: "Livraison terminée ?", description: <p>{selected.reference} sera marquée livrée.</p>, confirmLabel: "Oui, livrée" }}
              />
            )}
            {["confirmed", "preparing", "finishing"].includes(selected.status) && (
              <p className="text-encre-douce">Marquez la commande « prête » depuis sa fiche pour pouvoir la confier au livreur.</p>
            )}
          </div>
        ) : (
          <p>Aucune livraison pour cette fournée.</p>
        )}
      </aside>
    </div>
  );
}
