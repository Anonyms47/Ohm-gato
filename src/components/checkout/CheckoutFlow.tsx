"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useForm, type FieldPath, type Resolver } from "react-hook-form";
import { useCart } from "@/components/cart/CartProvider";
import { DeliveryFields, type SavedAddress } from "@/components/checkout/DeliveryFields";
import { TicketPrinter } from "@/components/checkout/TicketPrinter";
import { Button, type ButtonState } from "@/components/ui/Button";
import { ErrorSummary, Field, TextArea, TextInput } from "@/components/ui/Field";
import { OhmegatoSelect } from "@/components/ui/select/OhmegatoSelect";
import { brand } from "@/config/brand";
import type { SlotSummary } from "@/lib/catalog-types";
import { DELIVERY_FEE_NOTICE, DeliveryFeeNotice } from "@/components/checkout/DeliveryFeeNotice";
import { cn } from "@/lib/cn";
import { formatDay, formatSlot, formatTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { formatSenegalPhone, normalizeSenegalPhone } from "@/lib/phone";
import {
  checkoutFormSchema,
  emptyCheckoutForm,
  fieldIssue,
  stepIssues,
  type CheckoutFormOutput,
  type CheckoutFormValues,
} from "@/lib/validation/checkout-form";
import { rememberPendingOrder } from "@/components/order/pending-orders";

export interface PaymentMethodView {
  id: "wave" | "wave_link" | "orange_money" | "test";
  label: string;
  available: boolean;
}

type StepId = "coordonnees" | "reception" | "creneau" | "notes" | "verification" | "paiement";

const STEPS: { id: StepId; title: string }[] = [
  { id: "coordonnees", title: "Vos coordonnées" },
  { id: "reception", title: "Livraison ou retrait" },
  { id: "creneau", title: "Date et créneau" },
  { id: "notes", title: "Un mot pour nous" },
  { id: "verification", title: "Vérification" },
  { id: "paiement", title: "Paiement" },
];

const STEP_FIELDS: Partial<Record<StepId, FieldPath<CheckoutFormValues>[]>> = {
  coordonnees: ["contact.name", "contact.phone"],
  reception: [
    "fulfillment",
    "delivery.district",
    "delivery.addressLine",
    "delivery.landmark",
    "delivery.latitude",
    "delivery.longitude",
    "delivery.floorDoor",
    "delivery.recipientName",
    "delivery.recipientPhone",
    "delivery.instructions",
  ],
  creneau: ["slotId"],
  notes: ["notes"],
};

const DRAFT_KEY = "ohmegato.bon.v1";

function readDraft(): Partial<CheckoutFormValues> | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Partial<CheckoutFormValues>) : null;
  } catch {
    return null;
  }
}

function newKey() {
  return crypto.randomUUID();
}

/** Versions en vigueur des documents acceptés à la commande (preuve enregistrée côté serveur). */
export interface CheckoutAcceptanceView {
  termsVersionId: string;
  termsVersion: string;
  cancellationVersionId: string;
  cancellationVersion: string;
}

export const ACCEPTANCE_LABEL = "J'ai lu et j'accepte les Conditions générales ainsi que la politique d'annulation et de remboursement.";
const ACCEPTANCE_ERROR = "Cochez la case pour accepter les conditions générales et la politique d'annulation avant de payer.";

export function CheckoutFlow({
  slots,
  paymentMethods,
  acceptance,
  member = null,
}: {
  slots: SlotSummary[];
  paymentMethods: PaymentMethodView[];
  acceptance: CheckoutAcceptanceView | null;
  /** Membre connecté : coordonnées pré-remplies et carnet d'adresses proposé. */
  member?: { contact: { name: string; phone: string; email: string }; addresses: SavedAddress[] } | null;
}) {
  const { resolved, catalog, hydrated, cart } = useCart();
  const cycle = catalog.cycle;
  const methods = useForm<CheckoutFormValues, unknown, CheckoutFormOutput>({
    // Les valeurs vides du formulaire (fulfillment "") sont refusées par le schéma à l'exécution.
    resolver: zodResolver(checkoutFormSchema) as unknown as Resolver<CheckoutFormValues, unknown, CheckoutFormOutput>,
    // Les erreurs apparaissent quand le client valide une étape (pas pendant la saisie,
    // ni à la sortie d'un champ : un message qui surgit déplacerait le bouton sous le doigt).
    mode: "onSubmit",
    defaultValues: emptyCheckoutForm,
    shouldFocusError: false,
  });
  const { register, watch, getValues, setValue, formState, reset, handleSubmit } = methods;
  const [step, setStep] = useState<StepId>("coordonnees");
  const [summaryErrors, setSummaryErrors] = useState<{ field: string; message: string }[]>([]);
  const [payState, setPayState] = useState<{ provider: PaymentMethodView["id"] | null; state: ButtonState; message?: string }>({
    provider: null,
    state: "idle",
  });
  // Jamais pré-cochée ni conservée dans le brouillon : l'acceptation se donne à chaque commande.
  const [accepted, setAccepted] = useState(false);
  const [acceptanceError, setAcceptanceError] = useState(false);
  const acceptanceRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const headingRefs = useRef<Partial<Record<StepId, HTMLHeadingElement | null>>>({});

  // Une clé d'idempotence par contenu de boîte : un double clic ne crée jamais deux commandes.
  const cartSignature = useMemo(() => JSON.stringify(cart.lines), [cart.lines]);
  const idempotencyKey = useMemo(() => newKey(), [cartSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  // Brouillon du bon de fournée (coordonnées, adresse…) conservé localement.
  useEffect(() => {
    const draft = readDraft();
    const base = member ? { ...emptyCheckoutForm, contact: member.contact } : emptyCheckoutForm;
    if (draft) reset({ ...base, ...draft, contact: { ...base.contact, ...draft.contact }, delivery: { ...base.delivery, ...draft.delivery }, slotId: "" });
    else if (member) reset(base);
  }, [reset]); // eslint-disable-line react-hooks/exhaustive-deps
  // Une erreur affichée disparaît dès que le champ est corrigé.
  useEffect(() => {
    const subscription = watch((values, { name }) => {
      if (!name || !methods.getFieldState(name).error) return;
      const message = fieldIssue(name, values as CheckoutFormValues);
      if (message) methods.setError(name, { type: "manual", message });
      else methods.clearErrors(name);
    });
    return () => subscription.unsubscribe();
  }, [watch, methods]);
  useEffect(() => {
    const subscription = watch((values) => {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...values, slotId: undefined }));
      } catch {
        // stockage indisponible : le formulaire reste utilisable
      }
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  const fulfillment = watch("fulfillment");
  const slotId = watch("slotId");
  // Seuls les produits sont payés en ligne : la livraison se règle au livreur.
  const total = resolved.subtotal;
  const slot = slots.find((s) => s.id === slotId) ?? null;

  const slotOptions = slots
    .filter((s) => fulfillment && (s.kind === "both" || s.kind === fulfillment))
    .map((s) => ({
      value: s.id,
      label: `${formatDay(s.startsAt)}`,
      description: `${formatTime(s.startsAt)} – ${formatTime(s.endsAt)}`,
      disabled: s.isFull,
      disabledReason: s.isFull ? "Complet" : undefined,
    }))
    .map((o) => ({ ...o, label: `${o.label}, ${o.description}`, description: undefined }));

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const goTo = (target: StepId) => {
    setStep(target);
    setSummaryErrors([]);
    requestAnimationFrame(() => headingRefs.current[target]?.focus());
  };

  const continueFrom = (current: StepId) => {
    if (current === "coordonnees" || current === "reception" || current === "creneau" || current === "notes") {
      const fields = STEP_FIELDS[current] ?? [];
      methods.clearErrors(fields);
      const issues = stepIssues(current, getValues());
      if (issues.length > 0) {
        for (const issue of issues) {
          methods.setError(issue.field as FieldPath<CheckoutFormValues>, { type: "manual", message: issue.message });
        }
        // Un message par problème (latitude et longitude partagent le même).
        setSummaryErrors(issues.filter((issue, index) => issues.findIndex((i) => i.message === issue.message) === index));
        requestAnimationFrame(() => summaryRef.current?.focus());
        return;
      }
    }
    if (current === "coordonnees") {
      // Le destinataire est pré-rempli avec les coordonnées du client.
      if (!getValues("delivery.recipientName")) setValue("delivery.recipientName", getValues("contact.name"));
      if (!getValues("delivery.recipientPhone")) setValue("delivery.recipientPhone", getValues("contact.phone"));
    }
    if (current === "verification" && !accepted) {
      setAcceptanceError(true);
      requestAnimationFrame(() => acceptanceRef.current?.focus());
      return;
    }
    const next = STEPS[STEPS.findIndex((s) => s.id === current) + 1];
    if (next) goTo(next.id);
  };

  const pay = (provider: PaymentMethodView["id"]) =>
    handleSubmit(
      async (values) => {
        if (!accepted || !acceptance) {
          setPayState({ provider, state: "error", message: ACCEPTANCE_ERROR });
          return;
        }
        setPayState({ provider, state: "loading" });
        try {
          const response = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              idempotencyKey,
              cycleId: cycle?.id,
              fulfillment: values.fulfillment,
              slotId: values.slotId,
              contact: { name: values.contact.name, phone: values.contact.phone, email: values.contact.email ?? "" },
              delivery: values.delivery,
              notes: values.notes || undefined,
              lines: cart.lines,
              paymentProvider: provider,
              acceptance: {
                accepted: true,
                termsVersionId: acceptance.termsVersionId,
                cancellationVersionId: acceptance.cancellationVersionId,
              },
            }),
          });
          const result = (await response.json()) as
            | { ok: true; reference: string; trackingToken: string; status: string; checkoutUrl: string | null }
            | { ok: false; code: string; message: string };
          if (!result.ok) {
            setPayState({ provider, state: "error", message: result.message });
            return;
          }
          rememberPendingOrder({ reference: result.reference, token: result.trackingToken, createdAt: Date.now() });
          setPayState({ provider, state: "success" });
          // Redirection vers le fournisseur, ou vers le suivi si l'équipe doit d'abord valider l'adresse.
          window.location.assign(result.checkoutUrl ?? `/suivi/${result.trackingToken}`);
        } catch {
          setPayState({
            provider,
            state: "error",
            message: "La connexion a été interrompue. Vérifiez votre réseau puis réessayez : aucune commande ne sera créée en double.",
          });
        }
      },
      () => {
        setPayState({ provider, state: "error", message: "Certaines informations sont à corriger dans les étapes précédentes." });
      },
    )();

  if (!hydrated) {
    return <p className="mt-6 text-encre-douce" aria-busy="true">Préparation de votre bon…</p>;
  }
  if (!cycle?.isOpen) {
    return (
      <p className="mt-6 text-[1.1rem]">
        Les commandes sont fermées pour le moment. Votre boîte est conservée ; la prochaine fournée est annoncée sur{" "}
        <a href={brand.instagramUrl} className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
          Instagram
        </a>
        .
      </p>
    );
  }
  if (resolved.lines.length === 0) {
    return (
      <p className="mt-6 text-[1.1rem]">
        Votre boîte est vide.{" "}
        <Link href="/carte" className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
          Voir la carte
        </Link>
      </p>
    );
  }
  if (resolved.hasIssues) {
    return (
      <div className="mt-6 flex flex-col gap-3">
        <p role="alert" className="font-bold text-erreur">
          Certains articles de votre boîte ne sont plus disponibles tels quels.
        </p>
        <Link href="/ma-boite" className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
          Ajuster Ma boîte
        </Link>
      </div>
    );
  }

  const values = getValues();
  const phoneDisplay = (raw: string) => {
    const normalized = normalizeSenegalPhone(raw);
    return normalized ? formatSenegalPhone(normalized) : raw;
  };

  const stepSummary: Partial<Record<StepId, string>> = {
    coordonnees: values.contact.name ? `${values.contact.name} · ${phoneDisplay(values.contact.phone)}` : undefined,
    reception:
      values.fulfillment === "pickup"
        ? `Retrait — ${brand.pickupAddress}`
        : values.fulfillment === "delivery"
          ? `Livraison — ${values.delivery.district}, ${values.delivery.addressLine}`
          : undefined,
    creneau: slot ? formatSlot(slot.startsAt, slot.endsAt) : undefined,
    notes: values.notes ? values.notes : "Aucune note",
  };

  return (
    <FormProvider {...methods}>
      <form noValidate onSubmit={(e) => e.preventDefault()} className="mt-6 flex flex-col gap-4">
        <ol className="flex flex-col gap-4">
          {STEPS.map((s, index) => {
            const isCurrent = s.id === step;
            const isDone = index < stepIndex;
            return (
              <li
                key={s.id}
                className={cn(
                  "rounded-[14px] border-2 bg-blanc-casse",
                  isCurrent ? "border-chocolat" : "border-chocolat/15",
                )}
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
                  <h2
                    ref={(el) => {
                      headingRefs.current[s.id] = el;
                    }}
                    tabIndex={-1}
                    className="flex items-baseline gap-3 font-display text-[1.35rem] outline-none sm:text-[1.6rem]"
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    <span className="font-script text-[1.4rem] text-caramel-encre">{index + 1}.</span>
                    {s.title}
                  </h2>
                  {isDone && (
                    <button
                      type="button"
                      onClick={() => goTo(s.id)}
                      className="min-h-11 shrink-0 font-bold underline decoration-caramel decoration-2 underline-offset-4"
                    >
                      Modifier<span className="sr-only"> : {s.title}</span>
                    </button>
                  )}
                </div>
                {isDone && stepSummary[s.id] && <p className="-mt-1 break-words px-4 pb-4 text-encre-douce sm:px-6">{stepSummary[s.id]}</p>}

                {isCurrent && (
                  <div className="flex flex-col gap-5 px-4 pb-6 sm:px-6">
                    <ErrorSummary ref={summaryRef} errors={summaryErrors} />

                    {s.id === "coordonnees" && (
                      <>
                        <Field id="contact.name" label="Nom" error={formState.errors.contact?.name?.message}>
                          {({ id, describedBy, invalid }) => (
                            <TextInput id={id} autoComplete="name" aria-describedby={describedBy} aria-invalid={invalid} {...register("contact.name")} />
                          )}
                        </Field>
                        <Field
                          id="contact.phone"
                          label="Téléphone (WhatsApp de préférence)"
                          hint="Ex. 77 123 45 67. Nous l'utilisons uniquement pour votre commande."
                          error={formState.errors.contact?.phone?.message}
                        >
                          {({ id, describedBy, invalid }) => (
                            <TextInput
                              id={id}
                              type="tel"
                              inputMode="tel"
                              autoComplete="tel"
                              aria-describedby={describedBy}
                              aria-invalid={invalid}
                              {...register("contact.phone")}
                            />
                          )}
                        </Field>
                        <p className="text-encre-douce">Aucun compte n&apos;est nécessaire pour commander.</p>
                      </>
                    )}

                    {s.id === "reception" && (
                      <>
                        <fieldset id="fulfillment" tabIndex={-1} className="outline-none">
                          <legend className="mb-2 font-bold">Comment récupérez-vous votre boîte ?</legend>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {(
                              [
                                { value: "delivery", title: "Livraison dans Dakar", text: "En général le lendemain matin. Frais à régler au livreur selon votre position." },
                                { value: "pickup", title: "Retrait", text: `${brand.pickupAddress}. Gratuit.` },
                              ] as const
                            ).map((option) => (
                              <label
                                key={option.value}
                                className="flex min-h-20 cursor-pointer gap-3 rounded-[12px] border-2 border-chocolat/30 bg-creme p-4 has-[:checked]:border-chocolat has-[:checked]:bg-blanc-casse has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-rose-encre"
                              >
                                <input
                                  type="radio"
                                  value={option.value}
                                  className="mt-1 size-5 accent-chocolat"
                                  {...register("fulfillment", { onChange: () => setValue("slotId", "") })}
                                />
                                <span>
                                  <span className="block font-bold">{option.title}</span>
                                  <span className="text-encre-douce">{option.text}</span>
                                </span>
                              </label>
                            ))}
                          </div>
                          {formState.errors.fulfillment?.message && (
                            <p className="mt-2 font-bold text-erreur">{formState.errors.fulfillment.message}</p>
                          )}
                        </fieldset>
                        {fulfillment === "delivery" && <DeliveryFields savedAddresses={member?.addresses ?? []} />}
                      </>
                    )}

                    {s.id === "creneau" && (
                      <OhmegatoSelect
                        id="slotId"
                        label={fulfillment === "pickup" ? "Créneau de retrait" : "Créneau de livraison"}
                        placeholder="Choisir un créneau"
                        value={slotId || null}
                        onValueChange={(v) => setValue("slotId", v, { shouldValidate: true })}
                        options={slotOptions}
                        error={formState.errors.slotId?.message}
                        hint={`Fournée n°${cycle.number} — ${formatDay(cycle.fulfillmentDate)}.`}
                      />
                    )}

                    {s.id === "notes" && (
                      <Field id="notes" label="Une précision ?" optional hint="Un message pour un anniversaire, une contrainte d'horaire…" error={formState.errors.notes?.message}>
                        {({ id, describedBy, invalid }) => (
                          <TextArea id={id} rows={3} aria-describedby={describedBy} aria-invalid={invalid} {...register("notes")} />
                        )}
                      </Field>
                    )}

                    {s.id === "verification" && (
                      <>
                        <TicketPrinter signature={`${cartSignature}|${slotId}|${fulfillment}`}>
                          <OrderTicket
                            lines={resolved.lines.map((l) => ({
                              key: l.key,
                              name: l.product?.name ?? "",
                              detail: [l.variant?.label, l.flavor?.name].filter(Boolean).join(" · "),
                              quantity: l.line.quantity,
                              total: l.total,
                            }))}
                            subtotal={resolved.subtotal}
                            fulfillment={fulfillment === "pickup" ? "pickup" : "delivery"}
                            total={total}
                            slotLabel={slot ? formatSlot(slot.startsAt, slot.endsAt) : ""}
                            cycleNumber={cycle.number}
                          />
                        </TicketPrinter>
                        {fulfillment === "delivery" && <DeliveryFeeNotice />}
                        {acceptance ? (
                          <CheckoutAcceptance
                            ref={acceptanceRef}
                            checked={accepted}
                            error={acceptanceError}
                            delivery={fulfillment === "delivery"}
                            onChange={(value) => {
                              setAccepted(value);
                              if (value) setAcceptanceError(false);
                            }}
                          />
                        ) : (
                          <p role="alert" className="font-bold text-erreur">
                            Les conditions générales sont momentanément indisponibles : la commande ne peut pas être finalisée. Écrivez-nous sur{" "}
                            <a href={brand.whatsappUrl} className="underline decoration-caramel decoration-2 underline-offset-4">
                              WhatsApp
                            </a>
                            .
                          </p>
                        )}
                        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <Button variant="secondary" onClick={() => goTo("coordonnees")}>
                            Modifier
                          </Button>
                          <Button onClick={() => continueFrom("verification")} disabled={!acceptance} className="flex-col py-2">
                            Tout est bon, payer
                            {fulfillment === "delivery" && (
                              <span className="text-[0.9rem] font-normal">Livraison à régler séparément au livreur</span>
                            )}
                          </Button>
                        </div>
                      </>
                    )}

                    {s.id === "paiement" && (
                      <PaymentChoices
                        methods={paymentMethods}
                        total={total}
                        delivery={fulfillment === "delivery"}
                        payState={payState}
                        onPay={pay}
                      />
                    )}

                    {(s.id === "coordonnees" || s.id === "reception" || s.id === "creneau" || s.id === "notes") && (
                      <div className="flex justify-end">
                        <Button onClick={() => continueFrom(s.id)}>Continuer</Button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </form>
    </FormProvider>
  );
}

const legalLinkClass = "font-bold underline decoration-caramel decoration-2 underline-offset-4";

/**
 * Dernière étape avant le paiement : case obligatoire, jamais pré-cochée. Les liens s'ouvrent
 * dans un nouvel onglet pour que le bon de fournée en cours reste intact.
 */
const CheckoutAcceptance = forwardRef<
  HTMLInputElement,
  { checked: boolean; error: boolean; delivery: boolean; onChange: (checked: boolean) => void }
>(function CheckoutAcceptance({ checked, error, delivery, onChange }, ref) {
  return (
    <div className="flex flex-col gap-3 rounded-[12px] border-2 border-chocolat/25 bg-creme p-4" data-testid="acceptation">
      <div className="flex items-start gap-3">
        <input
          ref={ref}
          id="acceptation-conditions"
          type="checkbox"
          required
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error || undefined}
          aria-describedby={error ? "acceptation-erreur" : undefined}
          className="mt-1 size-5 shrink-0 accent-chocolat"
        />
        <label htmlFor="acceptation-conditions" className="cursor-pointer">
          J&apos;ai lu et j&apos;accepte les{" "}
          <a href="/conditions-generales" target="_blank" rel="noopener" className={legalLinkClass}>
            Conditions générales<span className="sr-only"> (nouvel onglet)</span>
          </a>{" "}
          ainsi que la{" "}
          <a href="/annulation-remboursement" target="_blank" rel="noopener" className={legalLinkClass}>
            politique d&apos;annulation et de remboursement<span className="sr-only"> (nouvel onglet)</span>
          </a>
          .
        </label>
      </div>
      {error && (
        <p id="acceptation-erreur" className="font-bold text-erreur">
          {ACCEPTANCE_ERROR}
        </p>
      )}
      <p className="text-encre-douce">
        Les informations saisies sont utilisées pour traiter votre commande conformément à notre{" "}
        <a href="/confidentialite" target="_blank" rel="noopener" className={legalLinkClass}>
          Politique de confidentialité<span className="sr-only"> (nouvel onglet)</span>
        </a>
        .
      </p>
      {delivery && (
        <p className="font-bold" data-testid="rappel-livraison">
          Les frais de livraison ne sont pas inclus dans ce paiement. Ils seront réglés séparément au livreur.
        </p>
      )}
    </div>
  );
});

function OrderTicket({
  lines,
  subtotal,
  fulfillment,
  total,
  slotLabel,
  cycleNumber,
}: {
  lines: { key: string; name: string; detail: string; quantity: number; total: number }[];
  subtotal: number;
  fulfillment: "delivery" | "pickup";
  total: number;
  slotLabel: string;
  cycleNumber: number;
}) {
  return (
    <div className="relative text-[0.98rem]">
      <p className="text-center font-bold tracking-[0.2em]">{brand.name}</p>
      <p className="text-center text-encre-douce">Bon de fournée n°{cycleNumber}</p>
      <ul className="mt-4 flex flex-col gap-2 border-y-2 border-dashed border-chocolat/30 py-3">
        {lines.map((l) => (
          <li key={l.key} className="flex justify-between gap-3">
            <span>
              {l.quantity} × {l.name}
              {l.detail && <span className="block text-encre-douce">{l.detail}</span>}
            </span>
            <span className="shrink-0 tabular-nums">{formatFcfa(l.total)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-3 flex flex-col gap-1">
        <div className="flex justify-between">
          <dt>Sous-total</dt>
          <dd className="tabular-nums">{formatFcfa(subtotal)}</dd>
        </div>
        {fulfillment === "pickup" && (
          <div className="flex justify-between">
            <dt>Retrait</dt>
            <dd>Gratuit</dd>
          </div>
        )}
        <div className="flex justify-between border-t-2 border-chocolat pt-2 text-[1.15rem] font-bold">
          <dt>Total à payer</dt>
          <dd className="tabular-nums">{formatFcfa(total)}</dd>
        </div>
      </dl>
      {fulfillment === "delivery" && <p className="mt-2 font-bold">{DELIVERY_FEE_NOTICE}</p>}
      <p className="mt-3">{slotLabel}</p>
      <p className="ohm-tampon absolute right-0 top-12 text-[1rem] text-rose-encre">À vérifier</p>
      <p className="mt-4 text-center font-bold">Ceci n&apos;est pas encore une confirmation.</p>
    </div>
  );
}

function PaymentChoices({
  methods,
  total,
  delivery,
  payState,
  onPay,
}: {
  methods: PaymentMethodView[];
  total: number;
  delivery: boolean;
  payState: { provider: PaymentMethodView["id"] | null; state: ButtonState; message?: string };
  onPay: (provider: PaymentMethodView["id"]) => void;
}) {
  const busy = payState.state === "loading" || payState.state === "success";
  return (
    <div className="flex flex-col gap-4">
      <p>
        Montant à régler : <strong className="tabular-nums">{formatFcfa(total)}</strong>. Le paiement est intégral ; vous serez redirigé vers votre
        application de paiement.
      </p>
      {delivery && <DeliveryFeeNotice />}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {methods.map((method) => (
          <div key={method.id} className="flex flex-col gap-1 sm:min-w-56">
            <Button
              variant={method.id === "wave" || method.id === "wave_link" ? "wave" : method.id === "orange_money" ? "orange-money" : "primary"}
              state={payState.provider === method.id ? payState.state : "idle"}
              loadingLabel={`Ouverture de ${method.label}…`}
              disabled={!method.available || (busy && payState.provider !== method.id)}
              aria-describedby={!method.available ? `indispo-${method.id}` : undefined}
              onClick={() => onPay(method.id)}
            >
              Payer avec {method.label}
            </Button>
            {!method.available && (
              <span id={`indispo-${method.id}`} className="text-[0.95rem] font-bold text-encre-douce">
                Paiement temporairement indisponible
              </span>
            )}
          </div>
        ))}
      </div>
      {payState.state === "error" && payState.message && (
        <p role="alert" className="font-bold text-erreur">
          {payState.message}
        </p>
      )}
      {methods.every((m) => !m.available) && (
        <p>
          Le paiement en ligne est momentanément indisponible.{" "}
          <a href={brand.whatsappUrl} className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
            Écrivez-nous sur WhatsApp
          </a>{" "}
          pour finaliser votre commande.
        </p>
      )}
    </div>
  );
}
