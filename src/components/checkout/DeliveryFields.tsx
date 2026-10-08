"use client";

import { useFormContext } from "react-hook-form";
import { DeliveryFeeNotice } from "@/components/checkout/DeliveryFeeNotice";
import { PositionPicker } from "@/components/checkout/PositionPicker";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { OhmegatoSelect } from "@/components/ui/select/OhmegatoSelect";
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

export function DeliveryFields({ savedAddresses = [] }: { savedAddresses?: SavedAddress[] }) {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<{ delivery: CheckoutFormValues["delivery"] }>();

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

      <Field id="delivery.addressLine" label="Adresse" hint="Rue, numéro de villa, immeuble…" error={deliveryErrors?.addressLine?.message}>
        {({ id, describedBy, invalid }) => (
          <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} autoComplete="street-address" {...register("delivery.addressLine")} />
        )}
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="delivery.district" label="Quartier" error={deliveryErrors?.district?.message}>
          {({ id, describedBy, invalid }) => (
            <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} autoComplete="address-level3" {...register("delivery.district")} />
          )}
        </Field>
        <Field id="delivery.floorDoor" label="Étage ou porte" optional error={deliveryErrors?.floorDoor?.message}>
          {({ id, describedBy, invalid }) => (
            <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} {...register("delivery.floorDoor")} />
          )}
        </Field>
      </div>
      <Field id="delivery.landmark" label="Point de repère" hint="Ex. en face de la pharmacie, à côté de la mosquée…" error={deliveryErrors?.landmark?.message}>
        {({ id, describedBy, invalid }) => (
          <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} {...register("delivery.landmark")} />
        )}
      </Field>

      <PositionPicker id="delivery.latitude" position={position} onChange={setPosition} error={positionError} />

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
