"use server";

import { revalidatePath } from "next/cache";
import { adminErrorMessage, type AdminState } from "@/lib/admin/errors";
import { requireAdmin } from "@/lib/auth/session";
import { normalizePlace, parseDistricts } from "@/lib/delivery/zones";
import { parseZonesCsv, type ZonesCsvResult } from "@/lib/delivery/zones-csv";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function audit(actor: string, action: string, id: string | null, details: unknown) {
  await supabaseAdmin().rpc("write_audit", { p_actor: actor, p_action: action, p_entity: "delivery_zones", p_entity_id: id, p_details: details });
}

function refresh() {
  revalidatePath("/admin/zones");
  revalidatePath("/commande");
}

function parseFee(raw: string): { ok: true; value: number | null } | { ok: false } {
  const cleaned = raw.replace(/fcfa|cfa/gi, "").replace(/[\s  ]/g, "");
  if (cleaned === "") return { ok: true, value: null };
  return /^\d{1,7}$/.test(cleaned) ? { ok: true, value: Number(cleaned) } : { ok: false };
}

/** Création ou modification d'une zone. Un tarif vide = « tarif confirmé selon la position ». */
export async function saveZone(_: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "") || null;
  const name = String(form.get("name") ?? "").replace(/\s+/g, " ").trim();
  const fee = parseFee(String(form.get("fee") ?? ""));
  const districts = parseDistricts(String(form.get("districts") ?? ""));
  const sortOrder = Number.parseInt(String(form.get("sortOrder") ?? "0"), 10);
  const note = String(form.get("note") ?? "").trim().slice(0, 200) || null;
  const isActive = form.get("active") === "on";
  if (name.length < 1 || name.length > 80) return { ok: false, message: "Donnez un nom à la zone (80 caractères au plus)." };
  if (!fee.ok) return { ok: false, message: "Le tarif doit être un nombre entier de FCFA (ou rester vide)." };
  if (districts.some((d) => d.length > 80)) return { ok: false, message: "Un nom de quartier dépasse 80 caractères." };
  if (!Number.isFinite(sortOrder) || sortOrder < 0 || sortOrder > 9999) return { ok: false, message: "L'ordre d'affichage doit être un nombre entre 0 et 9999." };

  const row = { name, districts, fee_fcfa: fee.value, sort_order: sortOrder, note, is_active: isActive };
  const db = supabaseAdmin();
  const { data, error } = id ? await db.from("delivery_zones").update(row).eq("id", id).select("id").maybeSingle() : await db.from("delivery_zones").insert(row).select("id").single();
  if (error) return { ok: false, message: error.code === "23505" && error.message !== "ZONE_DISTRICT_CLASH" ? "Une zone porte déjà ce nom." : adminErrorMessage(error) };
  await audit(admin.id, id ? "zone.update" : "zone.create", data?.id ?? id, { name, districts: districts.length, fee: fee.value, active: isActive });
  refresh();
  return { ok: true, message: id ? "Zone enregistrée." : "Zone créée." };
}

/** Copie désactivée (jamais deux zones actives pour le même quartier) : à modifier puis activer. */
export async function duplicateZone(id: string): Promise<AdminState> {
  const admin = await requireAdmin();
  const db = supabaseAdmin();
  const { data: source } = await db.from("delivery_zones").select("name, districts, fee_fcfa, sort_order, note").eq("id", id).maybeSingle();
  if (!source) return { ok: false, message: "Zone introuvable." };
  const { data: names } = await db.from("delivery_zones").select("name");
  const taken = new Set((names ?? []).map((n) => normalizePlace(n.name as string)));
  let name = `${source.name} (copie)`;
  for (let n = 2; taken.has(normalizePlace(name)); n++) name = `${source.name} (copie ${n})`;
  const { error } = await db
    .from("delivery_zones")
    .insert({ name: name.slice(0, 80), districts: source.districts, fee_fcfa: source.fee_fcfa, sort_order: (source.sort_order as number) + 1, note: source.note, is_active: false });
  if (error) return { ok: false, message: adminErrorMessage(error) };
  await audit(admin.id, "zone.duplicate", id, { name });
  refresh();
  return { ok: true, message: `Copie « ${name} » créée, désactivée : ajustez-la puis activez-la.` };
}

export async function setZoneActive(id: string, active: boolean): Promise<AdminState> {
  const admin = await requireAdmin();
  const { error } = await supabaseAdmin().from("delivery_zones").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, message: adminErrorMessage(error) };
  await audit(admin.id, active ? "zone.activate" : "zone.deactivate", id, {});
  refresh();
  return { ok: true, message: active ? "Zone activée." : "Zone désactivée : les anciennes commandes gardent leur tarif." };
}

/** Réorganisation : la zone monte ou descend d'un rang, l'ordre est renuméroté proprement. */
export async function moveZone(id: string, direction: "up" | "down"): Promise<AdminState> {
  const admin = await requireAdmin();
  const db = supabaseAdmin();
  const { data, error } = await db.from("delivery_zones").select("id").order("sort_order").order("name");
  if (error || !data) return { ok: false, message: "Réorganisation impossible." };
  const ids = data.map((r) => r.id as string);
  const at = ids.indexOf(id);
  const to = direction === "up" ? at - 1 : at + 1;
  if (at < 0 || to < 0 || to >= ids.length) return { ok: true, message: "Déjà à cette place." };
  [ids[at], ids[to]] = [ids[to]!, ids[at]!];
  for (const [index, zoneId] of ids.entries()) {
    const { error: updateError } = await db.from("delivery_zones").update({ sort_order: (index + 1) * 10 }).eq("id", zoneId);
    if (updateError) return { ok: false, message: "Réorganisation impossible." };
  }
  await audit(admin.id, "zone.reorder", id, { direction });
  refresh();
  return { ok: true, message: "Ordre mis à jour." };
}

export interface ZonesImportPreview {
  ok: boolean;
  message: string;
  errors: { line: number; message: string }[];
  zones: number;
  districts: number;
  created: number;
  updated: number;
}

async function analyze(text: string): Promise<{ parsed: ZonesCsvResult; created: number; updated: number }> {
  const parsed = parseZonesCsv(text);
  const { data } = await supabaseAdmin().from("delivery_zones").select("name");
  const existing = new Set((data ?? []).map((z) => normalizePlace(z.name as string)));
  const updated = parsed.zones.filter((z) => existing.has(normalizePlace(z.name))).length;
  return { parsed, created: parsed.zones.length - updated, updated };
}

/** Aperçu avant import : rien n'est écrit. */
export async function previewZonesCsv(text: string): Promise<ZonesImportPreview> {
  await requireAdmin();
  const { parsed, created, updated } = await analyze(text);
  const districts = parsed.zones.reduce((n, z) => n + z.districts.length, 0);
  const ok = parsed.errors.length === 0 && parsed.zones.length > 0;
  return {
    ok,
    message: ok ? "Fichier valide." : parsed.errors.length ? "Le fichier contient des erreurs : corrigez-les puis réessayez." : "Aucune zone dans le fichier.",
    errors: parsed.errors.slice(0, 20),
    zones: parsed.zones.length,
    districts,
    created,
    updated,
  };
}

/** Import confirmé : tout ou rien. Les anciennes commandes ne changent jamais. */
export async function importZonesCsv(text: string): Promise<AdminState> {
  const admin = await requireAdmin();
  const { parsed } = await analyze(text);
  if (parsed.errors.length > 0 || parsed.zones.length === 0) return { ok: false, message: "Le fichier contient des erreurs : analysez-le d'abord." };
  const payload = parsed.zones.map((z) => ({ name: z.name, districts: z.districts, fee_fcfa: z.feeFcfa === null ? "" : String(z.feeFcfa), sort_order: z.sortOrder === null ? "" : String(z.sortOrder), is_active: z.isActive, note: z.note }));
  const { data, error } = await supabaseAdmin().rpc("admin_import_delivery_zones", { p_zones: payload, p_actor: admin.id });
  if (error) return { ok: false, message: adminErrorMessage(error) };
  const result = data as { created: number; updated: number };
  refresh();
  return { ok: true, message: `Import terminé : ${result.created} zone(s) créée(s), ${result.updated} mise(s) à jour.` };
}
