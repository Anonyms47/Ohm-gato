"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { DeliveryFeeNotice } from "@/components/checkout/DeliveryFeeNotice";
import { PositionPicker } from "@/components/checkout/PositionPicker";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { OhmegatoCombobox } from "@/components/ui/select/OhmegatoCombobox";
import { OhmegatoSelect } from "@/components/ui/select/OhmegatoSelect";
import { deliveryFeeLine, districtOptions, normalizePlace, zoneForDistrict, type DeliveryZone } from "@/lib/delivery/zones";
import type { CheckoutFormValues } from "@/lib/validation/checkout-form";

export interface SavedAddress {
  id: string;
  label: string | null;
  recipientName: string;
  recipientPhone: string;
  addressLine: string;
  district: string | null;
  landmark: string | null;
  floorDoor: string | null;
  instructions: string | null;
  latitude: number | null;
  longitude: number | null;
}

export function DeliveryFields({ savedAddresses = [], zones = [] }: { savedAddresses?: SavedAddress[]; zones?: DeliveryZone[] }) {
  const {
    register,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useFormContext<{ delivery: CheckoutFormValues["delivery"] }>();

  const district = watch("delivery.district") ?? "";
  const options = useMemo(() => districtOptions(zones), [zones]);
  const hasZones = options.length > 0;
  const zone = hasZones ? zoneForDistrict(zones, district) : null;
  // « Mon quartier n'est pas dans la liste » : saisie libre, tarif confirmé selon la position.
  const [manual, setManual] = useState(false);
  const selectedOption = options.find((o) => normalizePlace(o.value) === normalizePlace(district));
  const latitude = watch("delivery.latitude");
  const longitude = watch("delivery.longitude");
  const position = latitude !== null && longitude !== null ? { lat: latitude, lng: longitude } : null;
  const deliveryErrors = errors.delivery;
  const positionError = deliveryErrors?.latitude?.message ?? deliveryErrors?.longitude?.message;

  const setPosition = (next: { lat: number; lng: number }) => {
    const options = { shouldDirty: true, shouldValidate: Boolean(positionError) };
    setValue("delivery.latitude", Math.round(next.lat * 1e6) / 1e6, options);
    setValue("delivery.longitude", Math.round(next.lng * 1e6) / 1e6, options);
  };

  // Adresse et quartier pré-remplis depuis la position (sans jamais écraser ce que la personne a écrit).
  const autoFilled = useRef({ addressLine: "", district: "" });
  useEffect(() => {
    if (latitude === null || longitude === null) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/adresse/inverse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: latitude, lng: longitude }),
          signal: controller.signal,
        });
        const body = (await response.json().catch(() => null)) as { place?: { addressLine: string; district: string } } | null;
        if (!response.ok || !body?.place) return;
        for (const field of ["addressLine", "district"] as const) {
          const current = getValues(`delivery.${field}`).trim();
          let next = body.place[field];
          // Avec des zones, le quartier se choisit dans la liste : on ne remplit que si la position correspond à un quartier connu.
          if (field === "district" && hasZones) next = options.find((o) => normalizePlace(o.value) === normalizePlace(next ?? ""))?.value ?? "";
          if (next && (current === "" || current === autoFilled.current[field])) {
            setValue(`delivery.${field}`, next, { shouldDirty: true });
            autoFilled.current[field] = next;
          }
        }
      } catch {
        // Adresse indisponible : la position exacte suffit, les champs restent facultatifs.
      }
    }, 700);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [latitude, longitude, getValues, setValue, hasZones, options]);

  const applySaved = (id: string) => {
    const saved = savedAddresses.find((a) => a.id === id);
    if (!saved) return;
    const options = { shouldDirty: true };
    setValue("delivery.addressLine", saved.addressLine, options);
    setValue("delivery.district", saved.district ?? "", options);
    setValue("delivery.landmark", saved.landmark ?? "", options);
    setValue("delivery.floorDoor", saved.floorDoor ?? "", options);
    setValue("delivery.recipientName", saved.recipientName, options);
    setValue("delivery.recipientPhone", saved.recipientPhone, options);
    setValue("delivery.instructions", saved.instructions ?? "", options);
    if (saved.latitude !== null && saved.longitude !== null) setPosition({ lat: saved.latitude, lng: saved.longitude });
  };

  return (
    <div className="flex flex-col gap-5">
      <DeliveryFeeNotice />
      {savedAddresses.length > 0 && (
        <OhmegatoSelect
          label="Adresse enregistrée"
          optional
          hint="Remplit les champs ci-dessous ; vous pouvez ensuite les ajuster."
          value={null}
          onValueChange={applySaved}
          placeholder="Choisir dans mon carnet d'adresses"
          options={savedAddresses.map((a) => ({
            value: a.id,
            label: a.label || a.addressLine,
            description: [a.district, a.landmark].filter(Boolean).join(" · ") || undefined,
          }))}
        />
      )}

      {hasZones && (
        <div className="flex flex-col gap-3" data-testid="choix-quartier">
          {manual ? (
            <Field id="delivery.district" label="Quartier" hint="Saisissez votre quartier : le tarif sera confirmé selon votre position." error={deliveryErrors?.district?.message}>
              {({ id, describedBy, invalid }) => <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} autoComplete="address-level3" {...register("delivery.district")} />}
            </Field>
          ) : (
            <OhmegatoCombobox
              id="delivery.district"
              label="Quartier"
              hint="Choisissez votre quartier : la zone et le tarif de livraison s'affichent aussitôt."
              value={selectedOption?.value ?? null}
              displayValue={district || undefined}
              onValueChange={(value) => setValue("delivery.district", value, { shouldDirty: true })}
              options={options}
              placeholder="Choisir mon quartier"
              searchPlaceholder="Rechercher mon quartier…"
              emptyLabel="Aucun quartier ne correspond."
              error={deliveryErrors?.district?.message}
              footer={(close) => (
                <button
                  type="button"
                  className="min-h-11 w-full border-t-2 border-chocolat/15 px-4 text-left font-bold underline decoration-caramel decoration-2 underline-offset-4"
                  onClick={() => {
                    setManual(true);
                    setValue("delivery.district", "", { shouldDirty: true });
                    close();
                  }}
                >
                  Mon quartier n&apos;est pas dans la liste
                </button>
              )}
            />
          )}
          {manual && (
            <button type="button" className="min-h-11 self-start font-bold underline decoration-caramel decoration-2 underline-offset-4" onClick={() => { setManual(false); setValue("delivery.district", "", { shouldDirty: true }); }}>
              Choisir dans la liste des quartiers
            </button>
          )}
          <div className="rounded-[10px] border-2 border-caramel-encre bg-blanc-casse px-3 py-2" data-testid="tarif-livraison" aria-live="polite">
            {zone && <p className="text-[0.95rem] text-encre-douce">Zone : {zone.name}{zone.note ? ` · ${zone.note}` : ""}</p>}
            <p className="font-bold text-caramel-encre">{deliveryFeeLine(zone ? zone.feeFcfa : null)}</p>
          </div>
        </div>
      )}

      <PositionPicker id="delivery.latitude" position={position} onChange={setPosition} error={positionError} />

      <p className="text-encre-douce">Les champs ci-dessous sont facultatifs : ils se remplissent depuis la position quand c&apos;est possible. Complétez-les si besoin.</p>
      <Field id="delivery.addressLine" label="Adresse" optional hint="Rue, numéro de villa, immeuble…" error={deliveryErrors?.addressLine?.message}>
        {({ id, describedBy, invalid }) => (
          <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} autoComplete="street-address" {...register("delivery.addressLine")} />
        )}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        {!hasZones && (
          <Field id="delivery.district" label="Quartier" optional error={deliveryErrors?.district?.message}>
            {({ id, describedBy, invalid }) => (
              <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} autoComplete="address-level3" {...register("delivery.district")} />
            )}
          </Field>
        )}
        <Field id="delivery.floorDoor" label="Étage ou porte" optional error={deliveryErrors?.floorDoor?.message}>
          {({ id, describedBy, invalid }) => (
            <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} {...register("delivery.floorDoor")} />
          )}
        </Field>
      </div>
      <Field id="delivery.landmark" label="Point de repère" optional hint="Ex. en face de la pharmacie, à côté de la mosquée…" error={deliveryErrors?.landmark?.message}>
        {({ id, describedBy, invalid }) => (
          <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} {...register("delivery.landmark")} />
        )}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="delivery.recipientName" label="Qui réceptionne ?" error={deliveryErrors?.recipientName?.message}>
          {({ id, describedBy, invalid }) => (
            <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} autoComplete="name" {...register("delivery.recipientName")} />
          )}
        </Field>
        <Field id="delivery.recipientPhone" label="Son numéro" hint="Ex. 77 123 45 67" error={deliveryErrors?.recipientPhone?.message}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              {...register("delivery.recipientPhone")}
            />
          )}
        </Field>
      </div>
      <Field id="delivery.instructions" label="Instructions pour le livreur" optional error={deliveryErrors?.instructions?.message}>
        {({ id, describedBy, invalid }) => (
          <TextArea id={id} aria-describedby={describedBy} aria-invalid={invalid} rows={3} {...register("delivery.instructions")} />
        )}
      </Field>
    </div>
  );
}
