"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";

const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ?? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export interface MapStop {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  tone: "todo" | "out" | "done";
}

const colors = { todo: "#4a2a1c", out: "#c27a2e", done: "#2f6b3a" };

function icon(tone: MapStop["tone"], selected: boolean, label: string) {
  const size = selected ? 40 : 30;
  return L.divIcon({
    className: "",
    html: `<span style="display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${colors[tone]};border:3px solid ${selected ? "#d96590" : "#fbf6ee"};box-shadow:0 3px 0 #24140d"><span style="transform:rotate(45deg);color:#fbf6ee;font:700 12px sans-serif">${label}</span></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

/** Carte des positions de livraison (lecture seule) : un repère par commande. */
export default function DeliveryMap({ stops, selectedId, onSelect, label }: { stops: MapStop[]; selectedId: string | null; onSelect?: (id: string) => void; label: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [14.6928, -17.4467], zoom: 12, scrollWheelZoom: false });
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.stop();
      map.off();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    stops.forEach((stop, index) => {
      L.marker([stop.latitude, stop.longitude], { icon: icon(stop.tone, stop.id === selectedId, String(index + 1)), title: stop.label, keyboard: true })
        .on("click", () => onSelectRef.current?.(stop.id))
        .addTo(layer);
    });
    if (stops.length === 1) map.setView([stops[0]!.latitude, stops[0]!.longitude], 16, { animate: false });
    else if (stops.length > 1) map.fitBounds(L.latLngBounds(stops.map((s) => [s.latitude, s.longitude] as L.LatLngTuple)), { padding: [30, 30], animate: false });
  }, [stops, selectedId]);

  return <div ref={containerRef} role="application" aria-label={label} className="h-80 w-full overflow-hidden rounded-[12px] border-2 border-chocolat/35 md:h-[28rem]" />;
}
