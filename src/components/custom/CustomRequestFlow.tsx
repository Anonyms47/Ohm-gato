"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { DeliveryFields, type SavedAddress } from "@/components/checkout/DeliveryFields";
import { DeliveryFeeNotice } from "@/components/checkout/DeliveryFeeNotice";
import { Button } from "@/components/ui/Button";
import { ErrorSummary, Field, TextArea, TextInput } from "@/components/ui/Field";
import { OhmegatoSelect } from "@/components/ui/select/OhmegatoSelect";
import { brand } from "@/config/brand";
import { cn } from "@/lib/cn";
import { ATTACHMENT_MAX_BYTES, CUSTOM_KINDS, CUSTOM_MIN_DELAY_HOURS, OCCASIONS, customKindLabel } from "@/lib/custom/status";
import { formatDay } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { contactSchema, deliverySchema } from "@/lib/validation/checkout";
import { customItemSchema, eventDateTime } from "@/lib/validation/custom-request";

const DRAFT_KEY = "ohmegato.sur-mesure.v1";

interface ItemValues {
  quantity: number | null;
  format: string;
  flavors: string;
  description: string;
}

export interface CustomFormValues {
  occasion: string;
  occasionDetail: string;
  eventDate: string;
  eventTime: string;
  guests: number | null;
  kinds: string[];
  items: Record<string, ItemValues>;
  ambiance: string;
  personalization: string;
  budgetFcfa: number | null;
  fulfillment: "" | "delivery" | "pickup";
  delivery: {
    district: string;
    addressLine: string;
    landmark: string;
    floorDoor: string;
    recipientName: string;
    recipientPhone: string;
    instructions: string;
    latitude: number | null;
    longitude: number | null;
  };
  contact: { name: string; phone: string; email: string };
  notes: string;
}

const emptyItem: ItemValues = { quantity: null, format: "", flavors: "", description: "" };

const STEPS = [
  { id: "occasion", question: "C'est pour quelle occasion ?" },
  { id: "date", question: "Pour quand ?" },
  { id: "invites", question: "Combien de personnes ?" },
  { id: "produits", question: "Qu'aimeriez-vous servir ?" },
  { id: "details", question: "Formats, quantités et parfums" },
  { id: "ambiance", question: "Une ambiance, une personnalisation ?" },
  { id: "inspiration", question: "Une image pour nous inspirer ?" },
  { id: "budget", question: "Un budget en tête ?" },
  { id: "reception", question: "Livraison ou retrait ?" },
  { id: "coordonnees", question: "Comment vous joindre ?" },
  { id: "resume", question: "On relit ensemble" },
] as const;
type StepId = (typeof STEPS)[number]["id"];

const TIMES = Array.from({ length: 29 }, (_, i) => {
  const minutes = 7 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

function minDate(): string {
  const d = new Date(Date.now() + CUSTOM_MIN_DELAY_HOURS * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

type Issue = { field: string; message: string };

function validateStep(step: StepId, v: CustomFormValues): Issue[] {
  switch (step) {
    case "occasion":
      if (!v.occasion) return [{ field: "occasion", message: "Choisissez le type d'occasion." }];
      if (v.occasion === "Autre occasion" && v.occasionDetail.trim().length < 2)
        return [{ field: "occasionDetail", message: "Précisez l'occasion." }];
      return [];
    case "date": {
      const issues: Issue[] = [];
      if (!v.eventDate) issues.push({ field: "eventDate", message: "Choisissez la date." });
      if (!v.eventTime) issues.push({ field: "eventTime", message: "Choisissez l'heure." });
      const at = eventDateTime(v.eventDate, v.eventTime);
      if (v.eventDate && v.eventTime && (!at || at.getTime() < Date.now() + CUSTOM_MIN_DELAY_HOURS * 3600 * 1000))
        issues.push({ field: "eventDate", message: "Prévoyez au moins 2 jours : le sur-mesure demande 2 à 4 jours selon la quantité." });
      return issues;
    }
    case "invites":
      return v.guests && v.guests >= 1 && v.guests <= 5000 ? [] : [{ field: "guests", message: "Indiquez le nombre de personnes (au moins 1)." }];
    case "produits":
      return v.kinds.length > 0 ? [] : [{ field: "kinds", message: "Choisissez au moins un produit." }];
    case "details":
      return v.kinds.flatMap((kind) => {
        const item = v.items[kind] ?? emptyItem;
        const parsed = customItemSchema.safeParse({
          kind,
          quantity: item.quantity ?? undefined,
          format: item.format,
          flavors: item.flavors,
          description: item.description,
        });
        const issues = parsed.success ? [] : parsed.error.issues.map((i) => ({ field: `items.${kind}.${String(i.path[0])}`, message: `${customKindLabel(kind)} : ${i.message}` }));
        if (kind === "creation" && item.description.trim().length < 5)
          issues.push({ field: `items.${kind}.description`, message: "Création à discuter : décrivez votre idée en quelques mots." });
        return issues;
      });
    case "reception": {
      if (!v.fulfillment) return [{ field: "fulfillment", message: "Choisissez la livraison ou le retrait." }];
      if (v.fulfillment === "pickup") return [];
      const parsed = deliverySchema.safeParse(v.delivery);
      return parsed.success ? [] : parsed.error.issues.map((i) => ({ field: `delivery.${i.path.map(String).join(".")}`, message: i.message }));
    }
    case "coordonnees": {
      const parsed = contactSchema.safeParse(v.contact);
      return parsed.success ? [] : parsed.error.issues.map((i) => ({ field: `contact.${i.path.map(String).join(".")}`, message: i.message }));
    }
    case "budget":
      return v.budgetFcfa !== null && (v.budgetFcfa < 0 || !Number.isInteger(v.budgetFcfa))
        ? [{ field: "budgetFcfa", message: "Indiquez un montant entier en FCFA." }]
        : [];
    default:
      return [];
  }
}

/**
 * Carnet sur-mesure : une question à la fois, comme une conversation. Le brouillon reste
 * dans le navigateur ; l'envoi crée une demande (jamais une commande ni un paiement).
 */
export function CustomRequestFlow({
  prefill,
  savedAddresses,
  memberArea,
}: {
  prefill: { name: string; phone: string; email: string } | null;
  savedAddresses: SavedAddress[];
  memberArea: boolean;
}) {
  const router = useRouter();
  const methods = useForm<CustomFormValues>({
    defaultValues: {
      occasion: "",
      occasionDetail: "",
      eventDate: "",
      eventTime: "",
      guests: null,
      kinds: [],
      items: {},
      ambiance: "",
      personalization: "",
      budgetFcfa: null,
      fulfillment: "",
      delivery: { district: "", addressLine: "", landmark: "", floorDoor: "", recipientName: "", recipientPhone: "", instructions: "", latitude: null, longitude: null },
      contact: prefill ?? { name: "", phone: "", email: "" },
      notes: "",
    },
  });
  const { register, watch, setValue, getValues, reset, setError, clearErrors } = methods;
  const [stepIndex, setStepIndex] = useState(0);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [sendState, setSendState] = useState<"idle" | "loading" | "error">("idle");
  const [sendError, setSendError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const idempotencyKey = useRef<string>("");
  const questionRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  const values = watch();
  const step = STEPS[stepIndex]!;

  // Brouillon : relu une fois, puis enregistré à chaque modification.
  useEffect(() => {
    idempotencyKey.current = crypto.randomUUID();
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as { values: CustomFormValues; step: number };
        reset({ ...draft.values, contact: { ...draft.values.contact, ...(prefill && !draft.values.contact.phone ? prefill : {}) } });
        setStepIndex(Math.min(draft.step, STEPS.length - 1));
        setRestored(true);
      }
    } catch {
      // brouillon illisible : on repart d'une page blanche
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const save = (all: unknown) => {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ values: all, step: stepIndex, savedAt: Date.now() }));
      } catch {
        // stockage indisponible : la demande reste utilisable pendant la visite
      }
    };
    // Une demande vierge à l'étape 1 n'est pas un brouillon.
    if (stepIndex > 0) save(getValues());
    const subscription = watch((all) => save(all));
    return () => subscription.unsubscribe();
  }, [watch, getValues, stepIndex]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    questionRef.current?.focus();
  }, [stepIndex]);

  useEffect(() => {
    if (issues.length > 0) summaryRef.current?.focus();
  }, [issues]);

  const goTo = (index: number) => {
    setIssues([]);
    clearErrors();
    setStepIndex(index);
  };

  const next = () => {
    const found = validateStep(step.id, getValues());
    clearErrors();
    if (found.length > 0) {
      for (const issue of found) setError(issue.field as never, { message: issue.message });
      setIssues(found);
      return;
    }
    setIssues([]);
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const toggleKind = (kind: string) => {
    const current = getValues("kinds");
    const nextKinds = current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind];
    setValue("kinds", nextKinds, { shouldDirty: true });
    if (!getValues(`items.${kind}` as never)) setValue(`items.${kind}` as never, { ...emptyItem } as never);
  };

  const onFile = (selected: File | null) => {
    setFileError(null);
    if (!selected) return setFile(null);
    if (selected.size > ATTACHMENT_MAX_BYTES) return setFileError("Le fichier dépasse 5 Mo.");
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(selected.type))
      return setFileError("Formats acceptés : JPEG, PNG, WebP ou PDF.");
    setFile(selected);
  };

  const send = async () => {
    if (sendState === "loading") return;
    // Revalidation complète avant l'envoi.
    for (let i = 0; i < STEPS.length - 1; i++) {
      const found = validateStep(STEPS[i]!.id, getValues());
      if (found.length > 0) {
        goTo(i);
        for (const issue of found) setError(issue.field as never, { message: issue.message });
        setIssues(found);
        return;
      }
    }
    const v = getValues();
    setSendState("loading");
    setSendError(null);
    try {
      const response = await fetch("/api/sur-mesure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey.current,
          occasion: v.occasion,
          occasionDetail: v.occasionDetail,
          eventDate: v.eventDate,
          eventTime: v.eventTime,
          guests: v.guests,
          items: v.kinds.map((kind) => ({
            kind,
            quantity: v.items[kind]?.quantity,
            format: v.items[kind]?.format,
            flavors: v.items[kind]?.flavors,
            description: v.items[kind]?.description,
          })),
          ambiance: v.ambiance,
          personalization: v.personalization,
          budgetFcfa: v.budgetFcfa,
          fulfillment: v.fulfillment,
          delivery: v.fulfillment === "delivery" ? v.delivery : null,
          contact: v.contact,
          notes: v.notes,
        }),
      });
      const json = (await response.json()) as { ok: boolean; reference?: string; token?: string; message?: string };
      if (!json.ok || !json.token) {
        setSendState("error");
        setSendError(json.message ?? "Envoi impossible pour le moment.");
        return;
      }
      if (file) {
        const form = new FormData();
        form.set("action", "inspiration");
        form.set("token", json.token);
        form.set("file", file);
        await fetch("/api/sur-mesure/action", { method: "POST", body: form }).catch(() => null);
      }
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        // rien à nettoyer
      }
      router.push(memberArea ? `/compte/sur-mesure/${json.reference}?envoyee=1` : `/sur-mesure/suivi/${json.token}?envoyee=1`);
    } catch {
      setSendState("error");
      setSendError("Connexion au serveur impossible. Votre demande est gardée en brouillon : réessayez.");
    }
  };

  const errorOf = (field: string) => issues.find((i) => i.field === field)?.message;
  const progress = Math.round(((stepIndex + 1) / STEPS.length) * 100);

  return (
    <FormProvider {...methods}>
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          {restored && stepIndex > 0 && (
            <p role="status" className="mb-4 rounded-[10px] bg-blanc-casse p-3">
              Votre demande commencée a été retrouvée.{" "}
              <button
                type="button"
                className="min-h-11 font-bold underline decoration-caramel decoration-2 underline-offset-4"
                onClick={() => {
                  try {
                    window.localStorage.removeItem(DRAFT_KEY);
                  } catch {
                    // rien
                  }
                  window.location.reload();
                }}
              >
                Recommencer
              </button>
            </p>
          )}
          <div className="mb-4 flex items-center gap-3" aria-hidden>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-chocolat/15">
              <div className="h-full rounded-full bg-caramel transition-[width] duration-[var(--ohm-duree-moyenne)]" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <p className="text-encre-douce">
            Étape {stepIndex + 1} sur {STEPS.length}
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (step.id === "resume") void send();
              else next();
            }}
            noValidate
            key={step.id}
            className="mt-2 flex flex-col gap-5 rounded-[14px] border-2 border-chocolat bg-blanc-casse p-5 shadow-[0_4px_0_var(--ohm-chocolat)] motion-safe:animate-[ohm-page_280ms_var(--ohm-courbe)] sm:p-7"
          >
            <h2 ref={questionRef} tabIndex={-1} className="font-display text-[clamp(1.6rem,4.5vw,2.2rem)] leading-[1.05] focus:outline-none">
              {step.question}
            </h2>
            <ErrorSummary ref={summaryRef} errors={issues} />

            {step.id === "occasion" && (
              <>
                <div role="radiogroup" aria-label="Type d'occasion" className="grid gap-2 sm:grid-cols-2">
                  {OCCASIONS.map((occasion) => (
                    <label
                      key={occasion}
                      className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[10px] border-2 border-chocolat/30 px-4 py-2 has-[:checked]:border-chocolat has-[:checked]:bg-creme"
                    >
                      <input type="radio" value={occasion} {...register("occasion")} className="size-5 accent-[var(--ohm-chocolat)]" />
                      {occasion}
                    </label>
                  ))}
                </div>
                {values.occasion === "Autre occasion" && (
                  <Field id="occasionDetail" label="Laquelle ?" error={errorOf("occasionDetail")}>
                    {({ id, describedBy, invalid }) => <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} {...register("occasionDetail")} />}
                  </Field>
                )}
              </>
            )}

            {step.id === "date" && (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="eventDate" label="Date" hint="Au moins 2 jours à l'avance." error={errorOf("eventDate")}>
                  {({ id, describedBy, invalid }) => (
                    <TextInput id={id} type="date" min={minDate()} aria-describedby={describedBy} aria-invalid={invalid} {...register("eventDate")} />
                  )}
                </Field>
                <OhmegatoSelect
                  id="eventTime"
                  label="Heure souhaitée"
                  value={values.eventTime || null}
                  onValueChange={(time) => setValue("eventTime", time, { shouldDirty: true })}
                  options={TIMES.map((t) => ({ value: t, label: t.replace(":", " h ") }))}
                  placeholder="Choisir l'heure"
                  error={errorOf("eventTime")}
                />
              </div>
            )}

            {step.id === "invites" && (
              <Field id="guests" label="Nombre de personnes" error={errorOf("guests")}>
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                    className="max-w-40"
                    {...register("guests", { setValueAs: (v: string) => (v === "" ? null : Number(v)) })}
                  />
                )}
              </Field>
            )}

            {step.id === "produits" && (
              <fieldset id="kinds" tabIndex={-1} className="outline-none">
                <legend className="mb-3 text-encre-douce">Plusieurs choix possibles.</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CUSTOM_KINDS.map((kind) => (
                    <label
                      key={kind.value}
                      className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[10px] border-2 border-chocolat/30 px-4 py-2 has-[:checked]:border-chocolat has-[:checked]:bg-creme"
                    >
                      <input
                        type="checkbox"
                        checked={values.kinds.includes(kind.value)}
                        onChange={() => toggleKind(kind.value)}
                        className="size-5 accent-[var(--ohm-chocolat)]"
                      />
                      {kind.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {step.id === "details" && (
              <div className="flex flex-col gap-6">
                {values.kinds.map((kind) => (
                  <fieldset key={kind} className="flex min-w-0 flex-col gap-4 rounded-[12px] border-2 border-chocolat/20 p-4">
                    <legend className="px-1 font-display text-[1.3rem]">{customKindLabel(kind)}</legend>
                    <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
                      <Field id={`items.${kind}.quantity`} label="Quantité" error={errorOf(`items.${kind}.quantity`)}>
                        {({ id, describedBy, invalid }) => (
                          <TextInput
                            id={id}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            aria-describedby={describedBy}
                            aria-invalid={invalid}
                            {...register(`items.${kind}.quantity` as never, { setValueAs: (v: string) => (v === "" ? null : Number(v)) })}
                          />
                        )}
                      </Field>
                      <Field id={`items.${kind}.format`} label="Format souhaité" optional hint="Ex. box de 6, gâteau pour 20 parts…">
                        {({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} {...register(`items.${kind}.format` as never)} />}
                      </Field>
                    </div>
                    <Field id={`items.${kind}.flavors`} label="Parfums" optional>
                      {({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} {...register(`items.${kind}.flavors` as never)} />}
                    </Field>
                    <Field
                      id={`items.${kind}.description`}
                      label={kind === "creation" ? "Votre idée" : "Précisions"}
                      optional={kind !== "creation"}
                      error={errorOf(`items.${kind}.description`)}
                    >
                      {({ id, describedBy, invalid }) => (
                        <TextArea id={id} rows={3} aria-describedby={describedBy} aria-invalid={invalid} {...register(`items.${kind}.description` as never)} />
                      )}
                    </Field>
                  </fieldset>
                ))}
              </div>
            )}

            {step.id === "ambiance" && (
              <>
                <Field id="ambiance" label="Ambiance, couleurs, thème" optional>
                  {({ id, describedBy }) => <TextArea id={id} rows={3} aria-describedby={describedBy} {...register("ambiance")} />}
                </Field>
                <Field id="personalization" label="Personnalisation" optional hint="Prénom, âge, message, initiales…">
                  {({ id, describedBy }) => <TextArea id={id} rows={3} aria-describedby={describedBy} {...register("personalization")} />}
                </Field>
              </>
            )}

            {step.id === "inspiration" && (
              <div className="flex flex-col gap-3">
                <p className="text-encre-douce">Facultatif. Une photo ou un PDF (JPEG, PNG, WebP, PDF — 5 Mo maximum).</p>
                <label className="flex min-h-12 w-fit cursor-pointer items-center rounded-[10px] border-2 border-chocolat px-5 font-bold focus-within:outline-[3px] focus-within:outline-rose-encre">
                  {file ? "Changer de fichier" : "Choisir un fichier"}
                  <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
                </label>
                {file && (
                  <p role="status" className="flex flex-wrap items-center gap-3">
                    <span className="font-bold break-all">{file.name}</span>
                    <button type="button" className="min-h-11 underline decoration-caramel decoration-2 underline-offset-4" onClick={() => setFile(null)}>
                      Retirer
                    </button>
                  </p>
                )}
                {fileError && <p className="font-bold text-erreur">{fileError}</p>}
                {file && <p className="text-[0.95rem] text-encre-douce">Le fichier sera joint à l&apos;envoi de la demande.</p>}
              </div>
            )}

            {step.id === "budget" && (
              <Field id="budgetFcfa" label="Budget indicatif (FCFA)" optional hint="Il nous aide à proposer la bonne formule. Le prix final est fixé par OHMEGATO.">
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={500}
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                    className="max-w-56"
                    {...register("budgetFcfa", { setValueAs: (v: string) => (v === "" ? null : Number(v)) })}
                  />
                )}
              </Field>
            )}

            {step.id === "reception" && (
              <>
                <div role="radiogroup" aria-label="Livraison ou retrait" id="fulfillment" className="grid gap-2 sm:grid-cols-2">
                  <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-[10px] border-2 border-chocolat/30 p-4 has-[:checked]:border-chocolat has-[:checked]:bg-creme">
                    <input type="radio" value="delivery" {...register("fulfillment")} className="mt-1 size-5 accent-[var(--ohm-chocolat)]" />
                    <span>
                      <strong>Livraison</strong>
                      <span className="block text-encre-douce">Dans Dakar. Frais réglés directement au livreur.</span>
                    </span>
                  </label>
                  <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-[10px] border-2 border-chocolat/30 p-4 has-[:checked]:border-chocolat has-[:checked]:bg-creme">
                    <input type="radio" value="pickup" {...register("fulfillment")} className="mt-1 size-5 accent-[var(--ohm-chocolat)]" />
                    <span>
                      <strong>Retrait gratuit</strong>
                      <span className="block text-encre-douce">{brand.pickupAddress}</span>
                    </span>
                  </label>
                </div>
                {values.fulfillment === "delivery" && <DeliveryFields savedAddresses={savedAddresses} />}
              </>
            )}

            {step.id === "coordonnees" && (
              <>
                <Field id="contact.name" label="Nom" error={errorOf("contact.name")}>
                  {({ id, describedBy, invalid }) => <TextInput id={id} autoComplete="name" aria-describedby={describedBy} aria-invalid={invalid} {...register("contact.name")} />}
                </Field>
                <Field id="contact.phone" label="Téléphone (WhatsApp de préférence)" hint="Ex. 77 123 45 67" error={errorOf("contact.phone")}>
                  {({ id, describedBy, invalid }) => (
                    <TextInput id={id} type="tel" inputMode="tel" autoComplete="tel" aria-describedby={describedBy} aria-invalid={invalid} {...register("contact.phone")} />
                  )}
                </Field>
                <Field id="contact.email" label="E-mail" optional error={errorOf("contact.email")}>
                  {({ id, describedBy, invalid }) => (
                    <TextInput id={id} type="email" autoComplete="email" aria-describedby={describedBy} aria-invalid={invalid} {...register("contact.email")} />
                  )}
                </Field>
                <Field id="notes" label="Autre chose à nous dire ?" optional>
                  {({ id, describedBy }) => <TextArea id={id} rows={3} aria-describedby={describedBy} {...register("notes")} />}
                </Field>
              </>
            )}

            {step.id === "resume" && (
              <div className="flex flex-col gap-4">
                <dl className="divide-y-2 divide-dashed divide-chocolat/20">
                  {[
                    ["Occasion", values.occasion === "Autre occasion" ? values.occasionDetail : values.occasion, 0],
                    [
                      "Date",
                      values.eventDate && values.eventTime ? `${formatDay(values.eventDate)}, ${values.eventTime.replace(":", " h ")}` : "—",
                      1,
                    ],
                    ["Personnes", values.guests ? String(values.guests) : "—", 2],
                    [
                      "Produits",
                      values.kinds
                        .map((k) => {
                          const item = values.items[k];
                          return `${customKindLabel(k)} × ${item?.quantity ?? "?"}${item?.format ? ` (${item.format})` : ""}${item?.flavors ? ` — ${item.flavors}` : ""}`;
                        })
                        .join(" · "),
                      4,
                    ],
                    ["Ambiance", [values.ambiance, values.personalization].filter(Boolean).join(" — ") || "—", 5],
                    ["Inspiration", file ? file.name : "Aucune", 6],
                    ["Budget indicatif", values.budgetFcfa ? formatFcfa(values.budgetFcfa) : "Non précisé", 7],
                    [
                      "Réception",
                      values.fulfillment === "pickup"
                        ? `Retrait gratuit — ${brand.pickupAddress}`
                        : `Livraison — ${values.delivery.addressLine}, ${values.delivery.district} (${values.delivery.landmark})`,
                      8,
                    ],
                    ["Contact", `${values.contact.name} · ${values.contact.phone}`, 9],
                  ].map(([label, value, index]) => (
                    <div key={label as string} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <dt className="font-bold">{label}</dt>
                      <dd className="flex min-w-0 flex-1 items-start justify-between gap-3 sm:text-right">
                        <span className="min-w-0 break-words sm:flex-1">{value}</span>
                        <button
                          type="button"
                          onClick={() => goTo(index as number)}
                          className="min-h-11 shrink-0 font-bold underline decoration-caramel decoration-2 underline-offset-4"
                          aria-label={`Modifier : ${label}`}
                        >
                          Modifier
                        </button>
                      </dd>
                    </div>
                  ))}
                </dl>
                {values.fulfillment === "delivery" && <DeliveryFeeNotice />}
                <p className="rounded-[10px] bg-creme p-3">
                  Ceci est une <strong>demande</strong>, pas une commande. OHMEGATO l&apos;étudie et vous envoie une proposition avec un prix. Le paiement
                  n&apos;est possible qu&apos;après votre accord sur cette proposition.
                </p>
                {sendError && (
                  <p role="alert" className="font-bold text-erreur">
                    {sendError}
                  </p>
                )}
              </div>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-3">
              {step.id === "resume" ? (
                <Button type="submit" state={sendState === "loading" ? "loading" : "idle"} loadingLabel="Envoi de la demande…">
                  Envoyer ma demande à OHMEGATO
                </Button>
              ) : (
                <Button type="submit">{step.id === "inspiration" && !file ? "Passer cette étape" : step.id === "budget" && values.budgetFcfa === null ? "Passer cette étape" : "Continuer"}</Button>
              )}
              {stepIndex > 0 && (
                <Button variant="text" onClick={() => goTo(stepIndex - 1)}>
                  Revenir à l&apos;étape précédente
                </Button>
              )}
            </div>
          </form>
        </div>

        {/* Le carnet : réponses déjà données */}
        <aside aria-label="Vos réponses" className="hidden lg:block">
          <div className="sticky top-24 rounded-[12px] border-2 border-chocolat/25 bg-blanc-casse p-4">
            <p className="font-script text-[1.35rem] text-caramel-encre">dans le carnet</p>
            <ol className="mt-2 flex flex-col gap-2">
              {STEPS.slice(0, -1).map((s, index) => (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={index > stepIndex}
                    onClick={() => goTo(index)}
                    className={cn(
                      "w-full rounded-[8px] px-2 py-1.5 text-left disabled:cursor-default disabled:text-encre-douce/60",
                      index === stepIndex && "bg-creme font-bold",
                    )}
                  >
                    {s.question}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </FormProvider>
  );
}
