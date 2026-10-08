"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

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
 * Position exacte de livraison : repère posé sur la carte ou position de l'appareil
 * (demandée uniquement après un geste explicite). Transmise à OHMEGATO.
 */
export function PositionPicker({
  id,
  position,
  onChange,
  error,
  legend = "Position exacte de livraison",
}: {
  id: string;
  position: { lat: number; lng: number } | null;
  onChange: (position: { lat: number; lng: number }) => void;
  error?: string;
  legend?: string;
}) {
  const [geo, setGeo] = useState<GeoState>("idle");
  const errorId = `${id}-erreur`;

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
        onChange({ lat, lng });
        setGeo("idle");
      },
      (failure) => setGeo(failure.code === failure.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  };

  return (
    <fieldset
      id={id}
      tabIndex={-1}
      aria-describedby={error && !position ? errorId : undefined}
      className="flex min-w-0 flex-col gap-3 rounded-[12px] border-2 border-chocolat/20 p-4 outline-none aria-[describedby]:border-erreur"
    >
      <legend className="px-1 font-bold">{legend}</legend>
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
      <AddressMap position={position} onChange={onChange} label="Carte de Dakar : touchez l'endroit de livraison pour poser le repère" />
      {position ? (
        <p role="status" className="font-bold text-succes">
          Repère placé. Vous pouvez le déplacer pour l&apos;ajuster.
        </p>
      ) : (
        error && (
          <p id={errorId} className="flex items-start gap-1.5 font-bold text-erreur">
            <span aria-hidden>✕</span>
            {error}
          </p>
        )
      )}
    </fieldset>
  );
}
