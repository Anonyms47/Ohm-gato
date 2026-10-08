"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandHeading } from "@/components/brand/BrandHeading";
import { useCart } from "@/components/cart/CartProvider";
import { forgetPendingOrder, readPendingOrders } from "@/components/order/pending-orders";
import { Button, type ButtonState } from "@/components/ui/Button";
import { brand } from "@/config/brand";
import { cn } from "@/lib/cn";
import { formatSlot, formatTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import {
  isAwaitingPayment,
  paymentStatusLabel,
  reachedStepIndex,
  roadSteps,
  statusHeadline,
  type Fulfillment,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/order-status";

export interface TrackerOrder {
  reference: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillment: Fulfillment;
  customerName: string;
  addressLine: string | null;
  district: string | null;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  pickupCode: string | null;
  subtotalFcfa: number;
  deliveryFeeFcfa: number | null;
  totalFcfa: number;
  reservationExpiresAt: string | null;
  cycleNumber: number;
  slot: { startsAt: string; endsAt: string };
  items: { productName: string; variantLabel: string; flavorName: string | null; quantity: number; lineTotalFcfa: number }[];
  history: { status: OrderStatus; createdAt: string }[];
}

const STAMP_KEY = "ohmegato.tampons";

function stampAlreadyShown(reference: string): boolean {
  try {
    return (JSON.parse(window.sessionStorage.getItem(STAMP_KEY) ?? "[]") as string[]).includes(reference);
  } catch {
    return true;
  }
}

function markStampShown(reference: string) {
  try {
    const list = JSON.parse(window.sessionStorage.getItem(STAMP_KEY) ?? "[]") as string[];
    window.sessionStorage.setItem(STAMP_KEY, JSON.stringify([...list, reference].slice(-10)));
  } catch {
    // ignoré
  }
}

export function OrderTracker({
  token,
  order,
  returningFromPayment,
  paymentMethods,
  pickupAddress,
}: {
  token: string;
  order: TrackerOrder;
  returningFromPayment: boolean;
  paymentMethods: { id: "wave" | "orange_money" | "test"; label: string; available: boolean }[];
  pickupAddress: string;
}) {
  const router = useRouter();
  const { clear, hydrated } = useCart();
  const [animateStamp, setAnimateStamp] = useState(false);
  const [resume, setResume] = useState<{ provider: string | null; state: ButtonState; message?: string }>({ provider: null, state: "idle" });
  const paid = order.paymentStatus === "paid";
  const waiting = isAwaitingPayment(order.status, order.paymentStatus);
  const lastStatus = useRef(`${order.status}/${order.paymentStatus}`);

  // Interrogation du vrai statut tant que le paiement est en attente (jamais de succès supposé).
  useEffect(() => {
    if (!waiting) return;
    let stopped = false;
    let delay = 3000;
    let timer: number;
    const poll = async () => {
      if (stopped) return;
      if (document.visibilityState === "visible") {
        try {
          const response = await fetch("/api/orders/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
            cache: "no-store",
          });
          if (response.ok) {
            const data = (await response.json()) as { status: OrderStatus; paymentStatus: PaymentStatus };
            const key = `${data.status}/${data.paymentStatus}`;
            if (key !== lastStatus.current) {
              lastStatus.current = key;
              router.refresh();
              return;
            }
          }
        } catch {
          // réseau instable : on réessaie plus tard
        }
      }
      delay = Math.min(delay * 1.4, 20_000);
      timer = window.setTimeout(poll, delay);
    };
    timer = window.setTimeout(poll, delay);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [waiting, token, router]);

  // Paiement confirmé par le serveur : tampon « PAYÉE » (une seule fois) et boîte vidée sur cet appareil.
  // On attend que Ma boîte soit relue depuis le navigateur, sinon cette relecture la remplirait à nouveau.
  useEffect(() => {
    if (!paid || !hydrated) return;
    const fromThisDevice = readPendingOrders().some((o) => o.reference === order.reference);
    if (fromThisDevice) {
      clear();
      forgetPendingOrder(order.reference);
    }
    if (!stampAlreadyShown(order.reference)) {
      markStampShown(order.reference);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- animation déclenchée par la confirmation serveur
      setAnimateStamp(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    }
  }, [paid, hydrated, order.reference, clear]);

  const resumePayment = async (provider: string) => {
    setResume({ provider, state: "loading" });
    try {
      const response = await fetch("/api/orders/resume-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, provider }),
      });
      const data = (await response.json()) as { ok: boolean; checkoutUrl?: string; message?: string };
      if (!data.ok || !data.checkoutUrl) {
        setResume({ provider, state: "error", message: data.message ?? "Le paiement n'a pas pu être relancé." });
        router.refresh();
        return;
      }
      window.location.assign(data.checkoutUrl);
    } catch {
      setResume({ provider, state: "error", message: "La connexion a été interrompue. Réessayez dans un instant." });
    }
  };

  const steps = roadSteps(order.fulfillment);
  const reached = reachedStepIndex(order.status, order.fulfillment);
  const whatsappText = encodeURIComponent(`Bonjour OHMEGATO, à propos de ma commande ${order.reference}`);

  return (
    <div className="flex flex-col gap-8">
      <div aria-live="polite" className="flex flex-col gap-3">
        <p className="font-bold uppercase tracking-[0.18em] text-caramel-encre">Commande {order.reference}</p>
        <BrandHeading as="h1" size="titre">
          {paid && order.status === "confirmed" ? "C'est noté." : statusHeadline[order.status]}
        </BrandHeading>
        {paid && order.status === "confirmed" && <p className="text-[1.25rem]">Maintenant, à nous de cuisiner.</p>}
        {waiting && (
          <div className="flex flex-col gap-3">
            <p className="text-[1.1rem]">
              {returningFromPayment
                ? "Nous attendons la confirmation de votre paiement. Cette page se met à jour toute seule."
                : "Votre boîte est réservée en attendant le paiement."}
              {order.reservationExpiresAt && ` Réservation valable jusqu'à ${formatTime(order.reservationExpiresAt)}.`}
            </p>
            {returningFromPayment && (
              <p className="flex items-center gap-2 text-encre-douce" aria-hidden>
                <span className="size-4 rounded-full border-2 border-current border-r-transparent animate-[ohm-spin_700ms_linear_infinite]" />
                Vérification en cours…
              </p>
            )}
            <div className="flex flex-col gap-2">
              <p className="font-bold">Le paiement n&apos;a pas abouti ou la fenêtre a été fermée ?</p>
              <div className="flex flex-wrap gap-3">
                {paymentMethods.map((m) => (
                  <Button
                    key={m.id}
                    variant={m.id === "wave" ? "wave" : m.id === "orange_money" ? "orange-money" : "secondary"}
                    disabled={!m.available}
                    state={resume.provider === m.id ? resume.state : "idle"}
                    loadingLabel="Ouverture du paiement…"
                    onClick={() => resumePayment(m.id)}
                  >
                    Reprendre avec {m.label}
                  </Button>
                ))}
              </div>
              {resume.state === "error" && resume.message && (
                <p role="alert" className="font-bold text-erreur">
                  {resume.message}
                </p>
              )}
            </div>
          </div>
        )}
        {order.status === "awaiting_validation" && (
          <p className="text-[1.1rem]">
            Nous vérifions la livraison vers {order.district ?? "votre quartier"}. L&apos;équipe vous écrit sur WhatsApp avec le tarif, puis vous envoie
            le lien de paiement. Rien n&apos;est débité d&apos;ici là.
          </p>
        )}
        {(order.status === "cancelled" || order.status === "expired") && (
          <p className="text-[1.1rem]">
            Aucun montant n&apos;a été conservé pour cette commande. Votre boîte est toujours sur cet appareil :{" "}
            <a href="/commande" className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
              refaire le bon de fournée
            </a>
            .
          </p>
        )}
        {order.status === "needs_attention" && (
          <p className="text-[1.1rem]">Votre paiement est bien reçu. L&apos;équipe vérifie un détail et vous contacte rapidement.</p>
        )}
      </div>

      {/* Le ticket devient le carnet de route */}
      <section aria-labelledby="ticket-commande" className="relative mx-auto w-full max-w-md bg-blanc-casse px-6 py-6 shadow-[0_6px_14px_-8px_rgb(36_20_13/0.4)]">
        <h2 id="ticket-commande" className="text-center font-bold tracking-[0.2em]">
          {brand.name} · Fournée n°{order.cycleNumber}
        </h2>
        {paid && (
          <p className={cn("ohm-tampon absolute right-4 top-14 text-[1.4rem] text-succes", animateStamp && "ohm-tampon-pose")}>Payée</p>
        )}
        <ul className="mt-4 flex flex-col gap-2 border-y-2 border-dashed border-chocolat/30 py-3">
          {order.items.map((item, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>
                {item.quantity} × {item.productName}
                <span className="block text-encre-douce">{[item.variantLabel, item.flavorName].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="shrink-0 tabular-nums">{formatFcfa(item.lineTotalFcfa)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 flex flex-col gap-1">
          <div className="flex justify-between">
            <dt>Sous-total</dt>
            <dd className="tabular-nums">{formatFcfa(order.subtotalFcfa)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{order.fulfillment === "pickup" ? "Retrait" : "Livraison"}</dt>
            <dd className="tabular-nums">{order.deliveryFeeFcfa === null ? "À confirmer" : formatFcfa(order.deliveryFeeFcfa)}</dd>
          </div>
          <div className="flex justify-between border-t-2 border-chocolat pt-2 text-[1.15rem] font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatFcfa(order.totalFcfa)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Paiement</dt>
            <dd>{paymentStatusLabel[order.paymentStatus]}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-col gap-1">
          <p>
            <strong>{order.fulfillment === "pickup" ? "Retrait" : "Livraison"} :</strong> {formatSlot(order.slot.startsAt, order.slot.endsAt)}
          </p>
          {order.fulfillment === "pickup" ? (
            <p>{pickupAddress}</p>
          ) : (
            <p>
              {[order.addressLine, order.district, order.landmark].filter(Boolean).join(", ")}
              {order.latitude !== null && order.longitude !== null && (
                <>
                  {" — "}
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${order.latitude}&mlon=${order.longitude}#map=18/${order.latitude}/${order.longitude}`}
                    className="font-bold underline decoration-caramel decoration-2 underline-offset-4"
                  >
                    voir le repère
                  </a>
                </>
              )}
            </p>
          )}
        </div>
        {order.pickupCode && (
          <p className="mt-4 rounded-[10px] border-2 border-chocolat p-3 text-center">
            Code de retrait
            <span className="block font-display text-[2rem] tracking-[0.25em]">{order.pickupCode}</span>
            <span className="text-[0.95rem] text-encre-douce">À présenter lors du retrait.</span>
          </p>
        )}
      </section>

      {paid && (
        <section aria-labelledby="route">
          <h2 id="route" className="font-display text-[1.8rem]">
            Carnet de route
          </h2>
          <ol className="mt-4 flex flex-col gap-3">
            {steps.map((step, index) => {
              const done = index <= reached;
              return (
                <li key={step.key} className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-full border-2 font-bold",
                      done ? "border-chocolat bg-chocolat text-creme" : "border-chocolat/30 text-encre-douce",
                    )}
                  >
                    {done ? "✓" : index + 1}
                  </span>
                  <span className={done ? "font-bold" : "text-encre-douce"}>
                    {step.label}
                    <span className="sr-only">{done ? " — étape atteinte" : " — à venir"}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <div className="flex flex-wrap gap-3 print:hidden">
        <a
          href={`${brand.whatsappUrl}?text=${whatsappText}`}
          className="inline-flex min-h-12 items-center rounded-[10px] border-2 border-chocolat px-5 font-bold"
        >
          Une question ? WhatsApp
        </a>
        {paid && (
          <button type="button" onClick={() => window.print()} className="min-h-12 rounded-[10px] border-2 border-chocolat/35 px-5 font-bold">
            Imprimer le reçu
          </button>
        )}
      </div>
      <p className="text-[0.95rem] text-encre-douce print:hidden">
        Gardez ce lien : il donne accès à votre commande. Ne le partagez qu&apos;avec la personne qui réceptionne.
      </p>
    </div>
  );
}
