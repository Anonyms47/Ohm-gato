"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { OhmegatoCombobox } from "@/components/ui/select/OhmegatoCombobox";
import type { ZoneSummary } from "@/lib/catalog-types";
import { formatFcfa } from "@/lib/money";
import type { CheckoutFormValues } from "@/lib/validation/checkout-form";

const AddressMap = dynamic(() => import("@/components/checkout/AddressMap"), {
  ssr: false,
  loading: () => <p className="text-encre-douce">Chargement de la carte…</p>,
});

/** Valeur d'une option du combobox : « zoneId|quartier ». */
type GeoState = "idle" | "locating" | "denied" | "unavailable" | "outside";

export function DeliveryFields({ zones }: { zones: ZoneSummary[] }) {
  const {
    register,
    control,
    setValue,
    watch,
    getValues,
    formState: { errors },
  } = useFormContext<CheckoutFormValues>();
  const [showMap, setShowMap] = useState(false);
  const [geo, setGeo] = useState<GeoState>("idle");
  const [manualDistrict, setManualDistrict] = useState(() => getValues("delivery.zoneId") === null && getValues("delivery.district") !== "");

  const latitude = watch("delivery.latitude");
  const longitude = watch("delivery.longitude");
  const position = latitude !== null && longitude !== null ? { lat: latitude, lng: longitude } : null;
  const deliveryErrors = errors.delivery;

  const districtOptions = zones.flatMap((zone) =>
    zone.districts.map((district) => ({
      value: `${zone.id}|${district}`,
      label: district,
      group: zone.name,
      description: zone.feeFcfa === null ? "Tarif confirmé par l'équipe avant paiement" : `Livraison ${formatFcfa(zone.feeFcfa)}`,
      keywords: [zone.name],
    })),
  );

  const setPosition = (next: { lat: number; lng: number }) => {
    setValue("delivery.latitude", Math.round(next.lat * 1e6) / 1e6, { shouldDirty: true });
    setValue("delivery.longitude", Math.round(next.lng * 1e6) / 1e6, { shouldDirty: true });
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
        setShowMap(true);
        setGeo("idle");
      },
      (error) => setGeo(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  };

  const geoMessage: Record<Exclude<GeoState, "idle" | "locating">, string> = {
    denied: "Accès à la position refusé. Placez le repère sur la carte ou décrivez simplement l'adresse.",
    unavailable: "Position introuvable pour le moment. Placez le repère sur la carte ou décrivez l'adresse.",
    outside: "Votre position semble hors de la région de Dakar. Vérifiez le repère sur la carte.",
  };

  return (
    <div className="flex flex-col gap-5">
      {!manualDistrict ? (
        <Controller
          control={control}
          name="delivery.district"
          render={({ field }) => {
            const zoneId = getValues("delivery.zoneId");
            const value = zoneId && field.value ? `${zoneId}|${field.value}` : null;
            return (
              <OhmegatoCombobox
                id="delivery.district"
                label="Quartier"
                placeholder="Choisir votre quartier"
                searchPlaceholder="Rechercher un quartier…"
                emptyLabel="Quartier introuvable dans la liste."
                hint="Les frais de livraison dépendent de la zone."
                value={value}
                displayValue={field.value || undefined}
                options={districtOptions}
                error={deliveryErrors?.district?.message}
                onValueChange={(selected) => {
                  const [id, district] = selected.split("|");
                  setValue("delivery.zoneId", id ?? null, { shouldDirty: true });
                  field.onChange(district ?? "");
                  field.onBlur();
                }}
                footer={(close) => (
                  <button
                    type="button"
                    className="min-h-11 w-full rounded-[8px] px-3 text-left font-bold underline decoration-caramel decoration-2 underline-offset-4"
                    onClick={() => {
                      setValue("delivery.zoneId", null);
                      setValue("delivery.district", "");
                      setManualDistrict(true);
                      close();
                    }}
                  >
                    Mon quartier n&apos;est pas dans la liste
                  </button>
                )}
              />
            );
          }}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <Field id="delivery.district" label="Quartier" error={deliveryErrors?.district?.message} hint="L'équipe confirmera le tarif de livraison avant le paiement.">
            {({ id, describedBy, invalid }) => (
              <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} autoComplete="address-level3" {...register("delivery.district")} />
            )}
          </Field>
          <button
            type="button"
            onClick={() => {
              setManualDistrict(false);
              setValue("delivery.district", "");
            }}
            className="min-h-11 self-start font-bold underline decoration-caramel decoration-2 underline-offset-4"
          >
            Revenir à la liste des quartiers
          </button>
        </div>
      )}

      <Field id="delivery.addressLine" label="Adresse" hint="Rue, numéro de villa, immeuble…" error={deliveryErrors?.addressLine?.message}>
        {({ id, describedBy, invalid }) => (
          <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} autoComplete="street-address" {...register("delivery.addressLine")} />
        )}
      </Field>
      <Field id="delivery.landmark" label="Point de repère" optional hint="Ex. en face de la pharmacie, à côté de la mosquée…" error={deliveryErrors?.landmark?.message}>
        {({ id, describedBy, invalid }) => (
          <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} {...register("delivery.landmark")} />
        )}
      </Field>
      <Field id="delivery.floorDoor" label="Étage ou porte" optional error={deliveryErrors?.floorDoor?.message}>
        {({ id, describedBy, invalid }) => (
          <TextInput id={id} aria-describedby={describedBy} aria-invalid={invalid} {...register("delivery.floorDoor")} />
        )}
      </Field>

      <fieldset className="flex flex-col gap-3 rounded-[12px] border-2 border-chocolat/20 p-4">
        <legend className="px-1 font-bold">Repère sur la carte (facultatif)</legend>
        <p className="text-encre-douce">Un repère précis aide le livreur. Vous pouvez aussi vous en passer.</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={locate}
            disabled={geo === "locating"}
            className="min-h-11 rounded-[10px] border-2 border-chocolat px-4 font-bold disabled:opacity-60"
          >
            {geo === "locating" ? "Recherche de votre position…" : "Utiliser ma position"}
          </button>
          {!showMap && (
            <button type="button" onClick={() => setShowMap(true)} className="min-h-11 rounded-[10px] border-2 border-chocolat/35 px-4 font-bold">
              Placer le repère moi-même
            </button>
          )}
        </div>
        {geo !== "idle" && geo !== "locating" && (
          <p role="status" className="font-bold text-orange-encre">
            {geoMessage[geo]}
          </p>
        )}
        {showMap && <AddressMap position={position} onChange={setPosition} label="Carte de Dakar : touchez l'endroit de livraison pour poser le repère" />}
        {position && (
          <p role="status" className="flex flex-wrap items-center gap-3">
            <span>Repère enregistré.</span>
            <button
              type="button"
              onClick={() => {
                setValue("delivery.latitude", null);
                setValue("delivery.longitude", null);
              }}
              className="min-h-11 font-bold text-erreur underline decoration-2 underline-offset-4"
            >
              Retirer le repère
            </button>
          </p>
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
