"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
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
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const watchRef = useRef<{ id: number; timer: number } | null>(null);
  const errorId = `${id}-erreur`;

  const stopWatching = () => {
    if (!watchRef.current) return;
    navigator.geolocation.clearWatch(watchRef.current.id);
    window.clearTimeout(watchRef.current.timer);
    watchRef.current = null;
  };
  useEffect(() => stopWatching, []);

  /**
   * Position précise : le premier relevé d'un téléphone est souvent approximatif (antennes, Wi-Fi).
   * On écoute le GPS quelques secondes et on garde le relevé le plus précis (arrêt dès ± 20 m).
   */
  const locate = () => {
    if (!("geolocation" in navigator)) {
      setGeo("unavailable");
      return;
    }
    stopWatching();
    setGeo("locating");
    setAccuracy(null);
    let best: GeolocationCoordinates | null = null;
    const finish = () => {
      stopWatching();
      if (!best) {
        setGeo("unavailable");
        return;
      }
      const { latitude: lat, longitude: lng } = best;
      if (lat < 14.4 || lat > 15 || lng < -17.6 || lng > -16.9) {
        setGeo("outside");
        return;
      }
      onChange({ lat, lng });
      setFocus({ label: "Ma position", lat, lng });
      setAccuracy(Math.round(best.accuracy));
      setGeo("idle");
    };
    const watchId = navigator.geolocation.watchPosition(
      (result) => {
        if (!best || result.coords.accuracy < best.accuracy) best = result.coords;
        if (best.accuracy <= 20) finish();
      },
      (failure) => {
        if (failure.code === failure.PERMISSION_DENIED) {
          stopWatching();
          setGeo("denied");
        }
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
    watchRef.current = { id: watchId, timer: window.setTimeout(finish, 15_000) };
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
        Le plus simple : utilisez votre position GPS sur place. Sinon, cherchez votre quartier puis touchez la carte à l&apos;endroit exact. La position est transmise
        à OHMEGATO pour organiser la livraison.
      </p>
      <button
        type="button"
        onClick={locate}
        disabled={geo === "locating"}
        className="min-h-12 self-start rounded-[10px] border-2 border-chocolat bg-chocolat px-5 font-bold text-creme disabled:opacity-60"
      >
        {geo === "locating" ? "Recherche précise de votre position…" : "Utiliser ma position (GPS)"}
      </button>
      {geo !== "idle" && geo !== "locating" && (
        <p role="status" className="font-bold text-orange-encre">
          {geoMessage[geo]}
        </p>
      )}
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
        {focus && !position && focus.label !== "Ma position" && (
          <p role="status" className="font-bold">
            Carte centrée sur « {focus.label} ». Touchez maintenant l&apos;endroit exact de livraison.
          </p>
        )}
      </div>
      <AddressMap
        position={position}
        onChange={(next) => {
          setAccuracy(null);
          onChange(next);
        }}
        focus={focus}
        label="Carte de Dakar : touchez l'endroit de livraison pour poser le repère"
      />
      {position ? (
        <p role="status" className={accuracy !== null && accuracy > 100 ? "font-bold text-orange-encre" : "font-bold text-succes"}>
          {accuracy === null
            ? "Repère placé. Vous pouvez le déplacer pour l'ajuster."
            : accuracy > 100
              ? `Position approximative (à ± ${accuracy} m) : vérifiez sur la carte et déplacez le repère sur votre porte.`
              : `Position trouvée (à ± ${accuracy} m près). Vous pouvez déplacer le repère pour l'ajuster.`}
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
