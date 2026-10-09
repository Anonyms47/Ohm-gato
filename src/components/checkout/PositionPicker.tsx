"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { TextInput } from "@/components/ui/Field";

const AddressMap = dynamic(() => import("@/components/checkout/AddressMap"), {
  ssr: false,
  loading: () => <p className="text-encre-douce">Chargement de la carte…</p>,
});

type Place = { label: string; lat: number; lng: number };
type SearchState =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "results"; places: Place[] }
  | { kind: "error"; message: string };

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
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState>({ kind: "idle" });
  const [focus, setFocus] = useState<Place | null>(null);
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

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 3) {
      setSearch({ kind: "error", message: "Saisissez au moins 3 caractères (quartier, rue, lieu connu)." });
      return;
    }
    setSearch({ kind: "searching" });
    try {
      const response = await fetch("/api/adresse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q }),
      });
      const body = (await response.json().catch(() => null)) as { places?: Place[]; message?: string } | null;
      if (!response.ok || !body?.places) {
        setSearch({ kind: "error", message: body?.message ?? "Recherche indisponible. Placez le repère directement sur la carte." });
        return;
      }
      setSearch(
        body.places.length
          ? { kind: "results", places: body.places }
          : { kind: "error", message: "Aucun lieu trouvé dans la région de Dakar. Essayez un quartier ou un lieu connu proche." },
      );
    } catch {
      setSearch({ kind: "error", message: "Recherche indisponible. Placez le repère directement sur la carte." });
    }
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
        Cherchez votre quartier puis touchez la carte à l&apos;endroit exact de livraison, ou utilisez votre position. Elle est transmise à OHMEGATO pour organiser la
        livraison.
      </p>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-recherche`} className="font-bold">
          Chercher un quartier ou un lieu
        </label>
        <div className="flex gap-2">
          <TextInput
            id={`${id}-recherche`}
            type="search"
            value={query}
            maxLength={120}
            autoComplete="off"
            placeholder="Ex. Sacré-Cœur 3, Mermoz, Cité Keur Gorgui…"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault(); // ne pas envoyer le bon de fournée
                void runSearch();
              }
            }}
            className="min-w-0 flex-1"
          />
          <button
            type="button"
            onClick={() => void runSearch()}
            disabled={search.kind === "searching"}
            className="min-h-12 shrink-0 rounded-[10px] border-2 border-chocolat px-4 font-bold disabled:opacity-60"
          >
            {search.kind === "searching" ? "Recherche…" : "Chercher"}
          </button>
        </div>
        {search.kind === "error" && (
          <p role="status" className="font-bold text-orange-encre">
            {search.message}
          </p>
        )}
        {search.kind === "results" && (
          <ul aria-label="Lieux trouvés" className="flex flex-col gap-1">
            {search.places.map((place) => (
              <li key={`${place.lat},${place.lng}`}>
                <button
                  type="button"
                  onClick={() => {
                    setFocus(place);
                    setSearch({ kind: "idle" });
                  }}
                  className="min-h-11 w-full rounded-[10px] border-2 border-chocolat/20 px-3 py-2 text-left hover:border-chocolat"
                >
                  {place.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        {focus && !position && (
          <p role="status" className="font-bold">
            Carte centrée sur « {focus.label} ». Touchez maintenant l&apos;endroit exact de livraison.
          </p>
        )}
      </div>
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
      <AddressMap position={position} onChange={onChange} focus={focus} label="Carte de Dakar : touchez l'endroit de livraison pour poser le repère" />
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
