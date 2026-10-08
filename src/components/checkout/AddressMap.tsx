"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";

/** Centre de Dakar (Place de l'Indépendance) — point de départ quand aucun repère n'est posé. */
const DAKAR: L.LatLngTuple = [14.6928, -17.4467];

const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ?? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const markerIcon = L.divIcon({
  className: "",
  html: '<span style="display:block;width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#4a2a1c;border:3px solid #fbf6ee;box-shadow:0 3px 0 #24140d"></span>',
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

/**
 * Carte de livraison : le client pose ou déplace le repère (clic, glisser, ou bouton
 * « Placer le repère ici » au clavier). Chargée uniquement à la demande.
 */
export default function AddressMap({
  position,
  onChange,
  label,
}: {
  position: { lat: number; lng: number } | null;
  onChange: (position: { lat: number; lng: number }) => void;
  label: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: position ? [position.lat, position.lng] : DAKAR,
      zoom: position ? 17 : 13,
      keyboard: true,
      scrollWheelZoom: false,
    });
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
    map.on("click", (event: L.LeafletMouseEvent) => onChangeRef.current({ lat: event.latlng.lat, lng: event.latlng.lng }));
    mapRef.current = map;
    return () => {
      map.stop(); // une animation en cours ne doit pas survivre à la carte
      map.off();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // La carte est créée une seule fois ; les mises à jour passent par l'effet suivant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!position) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const latLng: L.LatLngTuple = [position.lat, position.lng];
    if (!markerRef.current) {
      markerRef.current = L.marker(latLng, { draggable: true, icon: markerIcon, keyboard: false, title: "Repère de livraison" })
        .addTo(map)
        .on("dragend", (event) => {
          const { lat, lng } = (event.target as L.Marker).getLatLng();
          onChangeRef.current({ lat, lng });
        });
      map.setView(latLng, Math.max(map.getZoom(), 16), { animate: false });
    } else {
      markerRef.current.setLatLng(latLng);
    }
  }, [position]);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        role="application"
        aria-label={label}
        className="h-72 w-full overflow-hidden rounded-[12px] border-2 border-chocolat/35 sm:h-80"
      />
      <button
        type="button"
        onClick={() => {
          const center = mapRef.current?.getCenter();
          if (center) onChangeRef.current({ lat: center.lat, lng: center.lng });
        }}
        className="min-h-11 self-start font-bold underline decoration-caramel decoration-2 underline-offset-4"
      >
        Placer le repère au centre de la carte
      </button>
    </div>
  );
}
