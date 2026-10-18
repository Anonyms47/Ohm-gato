import "server-only";
import { z } from "zod";
import { serverEnv } from "@/lib/env";

/** Région de Dakar (mêmes bornes que la position de l'appareil dans PositionPicker). */
export const DAKAR_BOUNDS = { south: 14.4, north: 15, west: -17.6, east: -16.9 } as const;

export interface PlaceResult {
  label: string;
  lat: number;
  lng: number;
}

const nominatimSchema = z.array(
  z.object({
    display_name: z.string(),
    lat: z.coerce.number(),
    lon: z.coerce.number(),
  }),
);

export function insideDakar(lat: number, lng: number): boolean {
  return lat >= DAKAR_BOUNDS.south && lat <= DAKAR_BOUNDS.north && lng >= DAKAR_BOUNDS.west && lng <= DAKAR_BOUNDS.east;
}

/** Libellé court : on retire le pays et les doublons consécutifs (« Dakar, Dakar »). */
export function shortLabel(displayName: string): string {
  const parts = displayName
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && part !== "Sénégal" && !/^\d{5}$/.test(part));
  return parts.filter((part, index) => part !== parts[index - 1]).slice(0, 4).join(", ");
}

export function parsePlaces(payload: unknown): PlaceResult[] {
  const parsed = nominatimSchema.safeParse(payload);
  if (!parsed.success) return [];
  const seen = new Set<string>();
  const places: PlaceResult[] = [];
  for (const item of parsed.data) {
    if (!Number.isFinite(item.lat) || !Number.isFinite(item.lon) || !insideDakar(item.lat, item.lon)) continue;
    const label = shortLabel(item.display_name);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    places.push({ label, lat: item.lat, lng: item.lon });
  }
  return places.slice(0, 5);
}

const cache = new Map<string, { at: number; places: PlaceResult[] }>();
const CACHE_MS = 24 * 60 * 60 * 1000;

/**
 * Recherche d'un lieu dans la région de Dakar (OpenStreetMap Nominatim, appelé depuis le
 * serveur uniquement, sur demande explicite du client — jamais en saisie automatique).
 */
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const key = query.toLocaleLowerCase("fr").replace(/\s+/g, " ").trim();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.places;

  const env = serverEnv();
  const url = new URL("/search", env.GEOCODER_URL);
  url.search = new URLSearchParams({
    q: query,
    format: "jsonv2",
    countrycodes: "sn",
    viewbox: `${DAKAR_BOUNDS.west},${DAKAR_BOUNDS.north},${DAKAR_BOUNDS.east},${DAKAR_BOUNDS.south}`,
    bounded: "1",
    limit: "8",
    "accept-language": "fr",
  }).toString();

  const response = await fetch(url, {
    headers: { "User-Agent": `OHMEGATO (${env.NEXT_PUBLIC_SITE_URL})`, Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Recherche d'adresse indisponible (${response.status}).`);
  const places = parsePlaces(await response.json());

  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), places });
  return places;
}

export interface ReversePlace {
  /** Rue et numéro quand OpenStreetMap les connaît, sinon le lieu le plus précis. */
  addressLine: string;
  district: string;
}

const reverseSchema = z.object({
  name: z.string().optional(),
  address: z.record(z.string(), z.string()).optional(),
});

/** Adresse lisible d'une position (rue, quartier) ; champs vides si OpenStreetMap ne les connaît pas. */
export function parseReverse(payload: unknown): ReversePlace {
  const parsed = reverseSchema.safeParse(payload);
  if (!parsed.success) return { addressLine: "", district: "" };
  const a = parsed.data.address ?? {};
  const street = [a.house_number, a.road ?? a.pedestrian ?? a.footway].filter(Boolean).join(" ");
  const district = a.neighbourhood ?? a.quarter ?? a.suburb ?? a.city_district ?? a.village ?? a.town ?? "";
  const place = parsed.data.name && parsed.data.name !== a.road ? parsed.data.name : "";
  return { addressLine: (street || place).slice(0, 200), district: district.slice(0, 80) };
}

const reverseCache = new Map<string, { at: number; place: ReversePlace }>();

/** Adresse d'une position de la région de Dakar (OpenStreetMap Nominatim, côté serveur). */
export async function reversePlace(lat: number, lng: number): Promise<ReversePlace> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const hit = reverseCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.place;

  const env = serverEnv();
  const url = new URL("/reverse", env.GEOCODER_URL);
  url.search = new URLSearchParams({ lat: String(lat), lon: String(lng), format: "jsonv2", zoom: "18", addressdetails: "1", "accept-language": "fr" }).toString();
  const response = await fetch(url, {
    headers: { "User-Agent": `OHMEGATO (${env.NEXT_PUBLIC_SITE_URL})`, Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Adresse indisponible (${response.status}).`);
  const place = parseReverse(await response.json());

  if (reverseCache.size > 500) reverseCache.clear();
  reverseCache.set(key, { at: Date.now(), place });
  return place;
}
