/**
 * Import / export CSV de la grille de livraison.
 * Une ligne par quartier : zone ; quartier ; tarif_fcfa ; ordre ; actif ; note.
 * Séparateur « ; » (Excel en français), « , » ou tabulation acceptés à l'import. Aucune valeur n'est inventée :
 * un tarif vide reste « tarif confirmé selon la position ».
 */
import { normalizePlace, type DeliveryZone } from "@/lib/delivery/zones";

export const ZONES_CSV_HEADER = ["zone", "quartier", "tarif_fcfa", "ordre", "actif", "note"] as const;
export const MAX_ZONES_CSV_BYTES = 300_000;
const MAX_ROWS = 3000;
const MAX_ZONES = 200;

export interface ParsedZone {
  name: string;
  districts: string[];
  feeFcfa: number | null;
  sortOrder: number | null;
  isActive: boolean;
  note: string | null;
}

export interface ZonesCsvResult {
  zones: ParsedZone[];
  errors: { line: number; message: string }[];
}

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else current += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      cells.push(current);
      current = "";
    } else current += ch;
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

function parseBool(raw: string): boolean | null {
  const v = normalizePlace(raw);
  if (["oui", "o", "1", "true", "vrai", "actif", "yes"].includes(v)) return true;
  if (["non", "n", "0", "false", "faux", "inactif", "no"].includes(v)) return false;
  return null;
}

function parseInteger(raw: string): number | null {
  const cleaned = raw.replace(/fcfa|cfa|f\b/gi, "").replace(/[\s  .]/g, "");
  return /^\d{1,7}$/.test(cleaned) ? Number(cleaned) : null;
}

export function parseZonesCsv(input: string): ZonesCsvResult {
  const errors: ZonesCsvResult["errors"] = [];
  const text = input.replace(/^﻿/, "");
  if (new TextEncoder().encode(text).length > MAX_ZONES_CSV_BYTES) return { zones: [], errors: [{ line: 0, message: "Fichier trop volumineux (300 Ko au plus)." }] };
  const lines = text.split(/\r\n|\n|\r/).map((l, i) => ({ text: l, line: i + 1 })).filter((l) => l.text.trim() !== "");
  if (lines.length === 0) return { zones: [], errors: [{ line: 0, message: "Le fichier est vide." }] };
  if (lines.length > MAX_ROWS + 1) return { zones: [], errors: [{ line: 0, message: `Trop de lignes (${MAX_ROWS} au plus).` }] };

  const first = lines[0]!.text;
  const delimiter = [";", "\t", ","].map((d) => ({ d, n: first.split(d).length })).sort((a, b) => b.n - a.n)[0]!.d;
  const header = splitLine(first, delimiter).map((h) => normalizePlace(h).replace(/ /g, "_"));
  const col = (name: string, aliases: string[] = []) => header.findIndex((h) => h === name || aliases.includes(h));
  const idx = {
    zone: col("zone", ["nom_de_la_zone", "nom"]),
    district: col("quartier", ["quartiers"]),
    fee: col("tarif_fcfa", ["tarif", "prix", "frais", "tarif_livraison"]),
    order: col("ordre", ["ordre_d_affichage", "position"]),
    active: col("actif", ["active", "statut"]),
    note: col("note", ["delai", "remarque"]),
  };
  if (idx.zone < 0 || idx.district < 0) {
    return { zones: [], errors: [{ line: 1, message: "En-tête attendu : zone ; quartier ; tarif_fcfa ; ordre ; actif ; note." }] };
  }

  const byName = new Map<string, ParsedZone & { line: number }>();
  for (const { text: raw, line } of lines.slice(1)) {
    const cells = splitLine(raw, delimiter);
    const cell = (i: number) => (i >= 0 ? (cells[i] ?? "") : "");
    const name = cell(idx.zone).replace(/\s+/g, " ").trim();
    const district = cell(idx.district).replace(/\s+/g, " ").trim();
    if (!name) {
      errors.push({ line, message: "Nom de zone manquant." });
      continue;
    }
    if (name.length > 80 || district.length > 80) {
      errors.push({ line, message: "Nom de zone ou de quartier trop long (80 caractères au plus)." });
      continue;
    }
    let fee: number | null = null;
    if (cell(idx.fee) !== "") {
      fee = parseInteger(cell(idx.fee));
      if (fee === null) {
        errors.push({ line, message: `Tarif « ${cell(idx.fee)} » invalide : indiquez un nombre entier de FCFA (ou laissez vide).` });
        continue;
      }
    }
    let order: number | null = null;
    if (cell(idx.order) !== "") {
      order = parseInteger(cell(idx.order));
      if (order === null) {
        errors.push({ line, message: `Ordre « ${cell(idx.order)} » invalide : nombre entier attendu.` });
        continue;
      }
    }
    let active: boolean | null = null;
    if (cell(idx.active) !== "") {
      active = parseBool(cell(idx.active));
      if (active === null) {
        errors.push({ line, message: `Statut « ${cell(idx.active)} » invalide : oui ou non.` });
        continue;
      }
    }
    const note = cell(idx.note).slice(0, 200) || null;

    const key = normalizePlace(name);
    let zone = byName.get(key);
    if (!zone) {
      zone = { name, districts: [], feeFcfa: fee, sortOrder: order, isActive: active ?? true, note, line };
      byName.set(key, zone);
    } else {
      // Les valeurs d'une même zone doivent concorder (la première ligne qui en donne une fait foi).
      const conflict = (a: unknown, b: unknown) => a !== null && b !== null && a !== b;
      if (conflict(zone.feeFcfa, fee)) errors.push({ line, message: `Zone « ${name} » : tarif différent de celui de la ligne ${zone.line}.` });
      if (conflict(zone.sortOrder, order)) errors.push({ line, message: `Zone « ${name} » : ordre différent de celui de la ligne ${zone.line}.` });
      if (active !== null && zone.isActive !== active) errors.push({ line, message: `Zone « ${name} » : statut différent de celui de la ligne ${zone.line}.` });
      zone.feeFcfa ??= fee;
      zone.sortOrder ??= order;
      zone.note ??= note;
    }
    if (district && !zone.districts.some((d) => normalizePlace(d) === normalizePlace(district))) zone.districts.push(district);
  }

  if (byName.size > MAX_ZONES) errors.push({ line: 0, message: `Trop de zones (${MAX_ZONES} au plus).` });

  // Un quartier actif n'appartient qu'à une seule zone.
  const owner = new Map<string, string>();
  for (const zone of byName.values()) {
    if (!zone.isActive) continue;
    for (const d of zone.districts) {
      const k = normalizePlace(d);
      const other = owner.get(k);
      if (other && other !== zone.name) errors.push({ line: zone.line, message: `Quartier « ${d} » présent dans deux zones actives (« ${other} » et « ${zone.name} »).` });
      owner.set(k, zone.name);
    }
  }

  const zones: ParsedZone[] = [...byName.values()].map((zone) => ({ name: zone.name, districts: zone.districts, feeFcfa: zone.feeFcfa, sortOrder: zone.sortOrder, isActive: zone.isActive, note: zone.note }));
  return { zones, errors };
}

function cellOut(value: string): string {
  return /[;"\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Export : une ligne par quartier (une ligne sans quartier pour une zone vide), prêt pour Excel. */
export function zonesToCsv(zones: DeliveryZone[]): string {
  const rows: string[][] = [[...ZONES_CSV_HEADER]];
  for (const z of [...zones].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "fr"))) {
    const base = [z.name, "", z.feeFcfa === null ? "" : String(z.feeFcfa), String(z.sortOrder), z.isActive ? "oui" : "non", z.note ?? ""];
    if (z.districts.length === 0) rows.push(base);
    for (const d of z.districts) rows.push([base[0]!, d, ...base.slice(2)]);
  }
  return "﻿" + rows.map((r) => r.map(cellOut).join(";")).join("\r\n") + "\r\n";
}
