"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { DeliveryFeeNotice } from "@/components/checkout/DeliveryFeeNotice";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import type { CheckoutFormValues } from "@/lib/validation/checkout-form";

const AddressMap = dynamic(() => import("@/components/checkout/AddressMap"), {
  ssr: false,
  loading: () => <p className="text-encre-douce">Chargement de la carte…</p>,
});

type GeoState = "idle" | "locating" | "denied" | "unavailable" | "outside";

const geoMessage: Record<Exclude<GeoState, "idle" | "locating">, string> = {
  denied: "Accès à la position refusé. Touchez la carte à l'endroit de livraison pour poser le repère.",
  unavailable: "Position introuvable pour le moment. Touchez la carte à l'endroit de livraison pour poser le repère.",
  outside: "Votre position semble hors de la région de Dakar. Placez le repère sur la carte à l'endroit de livraison.",
};

/**
 * Livraison : adresse écrite, quartier, point de repère, contact du destinataire et
 * position exacte sur la carte, transmise à OHMEGATO pour organiser la livraison.
 */
export function DeliveryFields() {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<CheckoutFormValues>();
  const [geo, setGeo] = useState<GeoState>("idle");

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

  // La position n'est demandée qu'après ce geste explicite du client.
  const locate = () => {
    if (!("geolocation" in navigator)) {
      setGeo("unavailable");
      return;
    }
    setGeo("locating");
    navigator.geolocation.getCurrentPosition(
      (result) => {
        const { latitude: lat, longitude: lng } = result.coords;
        if (lat < 14.4 || lat > 15 || lng < -17.6 || lng > -16.9) {
          setGeo("outside");
          return;
        }
        setPosition({ lat, lng });
        setGeo("idle");
      },
      (error) => setGeo(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <DeliveryFeeNotice />

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

      <fieldset
        id="delivery.latitude"
        tabIndex={-1}
        aria-describedby={positionError ? "position-erreur" : undefined}
        className="flex flex-col gap-3 rounded-[12px] border-2 border-chocolat/20 p-4 outline-none aria-[describedby]:border-erreur"
      >
        <legend className="px-1 font-bold">Position exacte de livraison</legend>
        <p className="text-encre-douce">
          Touchez la carte à l&apos;endroit exact de livraison, ou utilisez votre position. Elle est transmise à OHMEGATO pour organiser la
          livraison.
        </p>
        <button
          type="button"
          onClick={locate}
          disabled={geo === "locating"}
          className="min-h-11 self-start rounded-[10px] border-2 border-chocolat px-4 font-bold disabled:opacity-60"
        >
          {geo === "locating" ? "Recherche de votre position…" : "Utiliser ma position"}
        </button>
        {geo !== "idle" && geo !== "locating" && (
          <p role="status" className="font-bold text-orange-encre">
            {geoMessage[geo]}
          </p>
        )}
        <AddressMap position={position} onChange={setPosition} label="Carte de Dakar : touchez l'endroit de livraison pour poser le repère" />
        {position ? (
          <p role="status" className="font-bold text-succes">
            Repère placé. Vous pouvez le déplacer pour l&apos;ajuster.
          </p>
        ) : (
          positionError && (
            <p id="position-erreur" className="flex items-start gap-1.5 font-bold text-erreur">
              <span aria-hidden>✕</span>
              {positionError}
            </p>
          )
        )}
      </fieldset>

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
