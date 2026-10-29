/**
 * Livraison par zones : un quartier appartient à une zone, la zone porte le tarif.
 * Les frais sont réglés directement au livreur : jamais ajoutés au paiement en ligne.
 * Fonctions pures, partagées navigateur / serveur ; la base recalcule toujours la zone à la commande.
 */
import { formatFcfa } from "@/lib/money";

export interface DeliveryZone {
  id: string;
  name: string;
  districts: string[];
  /** null = tarif confirmé selon la position. */
  feeFcfa: number | null;
  isActive: boolean;
  sortOrder: number;
  note: string | null;
  updatedAt?: string | null;
}

/** Même normalisation que public.normalize_place : sans accents ni majuscules, ponctuation réduite. */
export function normalizePlace(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Zone active d'un quartier (la première par ordre d'affichage). */
export function zoneForDistrict(zones: DeliveryZone[], district: string): DeliveryZone | null {
  const key = normalizePlace(district);
  if (!key) return null;
  const sorted = [...zones].filter((z) => z.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  return sorted.find((z) => z.districts.some((d) => normalizePlace(d) === key)) ?? null;
}

export const FEE_TO_CONFIRM = "Tarif confirmé selon votre position";
export const FEE_PAID_TO_COURIER = "à régler directement au livreur";

/** Ligne de frais affichée au client : montant de la zone, ou « tarif confirmé selon votre position ». */
export function deliveryFeeLine(feeFcfa: number | null | undefined): string {
  return typeof feeFcfa === "number" ? `Frais de livraison : ${formatFcfa(feeFcfa)} — ${FEE_PAID_TO_COURIER}.` : `${FEE_TO_CONFIRM}.`;
}

/** Quartiers de toutes les zones actives, avec la zone et le tarif : source de la liste déroulante. */
export function districtOptions(zones: DeliveryZone[]): { value: string; label: string; description: string; zoneId: string }[] {
  return [...zones]
    .filter((z) => z.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .flatMap((z) =>
      z.districts.map((district) => ({
        value: district,
        label: district,
        description: `${z.name} · ${typeof z.feeFcfa === "number" ? formatFcfa(z.feeFcfa) : FEE_TO_CONFIRM.toLowerCase()}`,
        zoneId: z.id,
      })),
    );
}

/** Quartiers saisis un par ligne (ou séparés par « ; » ou « , ») : nettoyés, sans doublon. */
export function parseDistricts(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\n;,]+/)) {
    const name = part.replace(/\s+/g, " ").trim();
    const key = normalizePlace(name);
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}
