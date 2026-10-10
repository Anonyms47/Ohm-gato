"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminErrorMessage, type AdminState } from "@/lib/admin/errors";
import { requireAdmin } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

const cycleSchema = z
  .object({
    number: z.coerce.number().int().min(1, "Numéro invalide."),
    title: z.string().trim().min(2, "Indiquez un titre.").max(80),
    message: z.string().trim().max(400).optional(),
    opensAt: z.string().min(1, "Date d'ouverture requise."),
    closesAt: z.string().min(1, "Date de clôture requise."),
    productionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Début de la période de production requis."),
    productionDays: z.union([z.literal(""), z.coerce.number().int().min(1).max(7)]).optional(),
    fulfillmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de livraison requise."),
    capacityUnits: z.union([z.literal(""), z.coerce.number().int().min(0)]).optional(),
    palette: z.enum(["caramel", "chocolate", "orange", "rose"]),
    featuredProductId: z.union([z.literal(""), z.uuid()]).optional(),
  })
  .refine((v) => Date.parse(`${v.closesAt}Z`) > Date.parse(`${v.opensAt}Z`), { message: "La clôture doit suivre l'ouverture.", path: ["closesAt"] })
  .refine((v) => v.fulfillmentDate >= v.productionDate, { message: "La livraison ne peut pas précéder la préparation.", path: ["fulfillmentDate"] });

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function readCycle(form: FormData) {
  return cycleSchema.safeParse(Object.fromEntries(form.entries()));
}

/** Dates exactes de production (facultatives) : jamais inventées, seulement celles saisies. */
function readProductionDates(form: FormData): string[] | null {
  const dates = form
    .getAll("productionDates")
    .map((v) => String(v).trim())
    .filter(Boolean);
  if (dates.some((d) => !isoDate.test(d))) return null;
  return [...new Set(dates)].sort().slice(0, 7);
}

/** Les champs date-heure du formulaire sont saisis à l'heure de Dakar (UTC+0). */
function toIso(local: string) {
  return new Date(`${local.length === 16 ? `${local}:00` : local}Z`).toISOString();
}

function row(data: z.infer<typeof cycleSchema>, productionDates: string[]) {
  return {
    production_days: data.productionDays === "" || data.productionDays === undefined ? null : data.productionDays,
    production_dates: productionDates,
    number: data.number,
    title: data.title,
    message: data.message || null,
    opens_at: toIso(data.opensAt),
    closes_at: toIso(data.closesAt),
    production_date: data.productionDate,
    fulfillment_date: data.fulfillmentDate,
    capacity_units: data.capacityUnits === "" || data.capacityUnits === undefined ? null : data.capacityUnits,
    palette: data.palette,
    featured_product_id: data.featuredProductId || null,
  };
}

export async function createCycle(_: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const parsed = readCycle(form);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  const dates = readProductionDates(form);
  if (!dates) return { ok: false, message: "Une date de production est invalide." };
  const db = supabaseAdmin();
  const { data, error } = await db.from("production_cycles").insert({ ...row(parsed.data, dates), status: "draft" }).select("id").single();
  if (error) return { ok: false, message: error.code === "23505" ? "Ce numéro de fournée existe déjà." : "Création impossible." };
  await db.rpc("write_audit", { p_actor: admin.id, p_action: "cycle.create", p_entity: "production_cycles", p_entity_id: data.id, p_details: { number: parsed.data.number } });
  redirect(`/admin/fournees/${data.id}`);
}

export async function updateCycle(_: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const parsed = readCycle(form);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  const dates = readProductionDates(form);
  if (!dates) return { ok: false, message: "Une date de production est invalide." };
  const db = supabaseAdmin();
  const { data: before } = await db.from("production_cycles").select("opens_at, closes_at, production_date, fulfillment_date, production_dates").eq("id", id).maybeSingle();
  const values = row(parsed.data, dates);
  const { error } = await db.from("production_cycles").update(values).eq("id", id);
  if (error) return { ok: false, message: error.code === "23505" ? "Ce numéro de fournée existe déjà." : "Enregistrement impossible." };
  await db.rpc("write_audit", { p_actor: admin.id, p_action: "cycle.update", p_entity: "production_cycles", p_entity_id: id, p_details: { before, after: values } });
  revalidatePath("/admin/fournees");
  revalidatePath("/", "layout");
  return { ok: true, message: "Fournée enregistrée." };
}

export async function setCycleStatus(cycleId: string, status: string): Promise<AdminState> {
  const admin = await requireAdmin();
  const { error } = await supabaseAdmin().rpc("admin_set_cycle_status", { p_cycle_id: cycleId, p_status: status, p_actor: admin.id });
  if (error) return { ok: false, message: adminErrorMessage(error) };
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
  return { ok: true, message: "Statut de la fournée mis à jour." };
}

const setupSchema = z.array(
  z.object({
    productId: z.uuid(),
    included: z.boolean(),
    disabledVariantIds: z.array(z.uuid()),
    availableFlavorIds: z.array(z.uuid()).nullable(),
    sortOrder: z.number().int(),
  }),
);

/** Produits, formats et parfums de la fournée (précommande sans limite de quantité). */
export async function saveCycleProducts(cycleId: string, payload: unknown): Promise<AdminState> {
  const admin = await requireAdmin();
  const parsed = setupSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: "Données invalides." };
  const db = supabaseAdmin();
  const { data: inventory } = await db.from("inventory_units").select("product_id, reserved_units, sold_units").eq("cycle_id", cycleId);
  const committed = new Map((inventory ?? []).map((i) => [i.product_id as string, (i.reserved_units as number) + (i.sold_units as number)]));

  for (const item of parsed.data) {
    if (!item.included) {
      if ((committed.get(item.productId) ?? 0) > 0) {
        return { ok: false, message: "Un produit déjà réservé ou vendu ne peut pas être retiré de la fournée." };
      }
      await db.from("cycle_products").delete().eq("cycle_id", cycleId).eq("product_id", item.productId);
      continue;
    }
    const { error } = await db.from("cycle_products").upsert({
      cycle_id: cycleId,
      product_id: item.productId,
      disabled_variant_ids: item.disabledVariantIds,
      available_flavor_ids: item.availableFlavorIds,
      sort_order: item.sortOrder,
    });
    if (error) return { ok: false, message: "Enregistrement impossible." };
  }
  await db.rpc("write_audit", { p_actor: admin.id, p_action: "cycle.products", p_entity: "production_cycles", p_entity_id: cycleId, p_details: { products: parsed.data.filter((p) => p.included).length } });
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
  return { ok: true, message: "Produits de la fournée enregistrés." };
}

const slotSchema = z.object({
  cycleId: z.uuid(),
  kind: z.enum(["delivery", "pickup", "both"]),
  phase: z.enum(["preorder", "surplus"]).default("preorder"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date requise."),
  start: z.string().regex(/^\d{2}:\d{2}$/, "Heure de début requise."),
  end: z.string().regex(/^\d{2}:\d{2}$/, "Heure de fin requise."),
  capacity: z.union([z.literal(""), z.coerce.number().int().min(1)]).optional(),
});

export async function addSlot(_: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const parsed = slotSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  const s = parsed.data;
  if (s.end <= s.start) return { ok: false, message: "L'heure de fin doit suivre l'heure de début." };
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("delivery_slots")
    .insert({
      cycle_id: s.cycleId,
      kind: s.kind,
      phase: s.phase,
      starts_at: `${s.date}T${s.start}:00Z`,
      ends_at: `${s.date}T${s.end}:00Z`,
      capacity_orders: s.capacity === "" || s.capacity === undefined ? null : s.capacity,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: "Créneau impossible à créer." };
  await db.rpc("write_audit", { p_actor: admin.id, p_action: "slot.create", p_entity: "delivery_slots", p_entity_id: data.id, p_details: s });
  revalidatePath(`/admin/fournees/${s.cycleId}`);
  return { ok: true, message: "Créneau ajouté." };
}

export async function toggleSlot(slotId: string, active: boolean): Promise<AdminState> {
  const admin = await requireAdmin();
  const db = supabaseAdmin();
  const { error } = await db.from("delivery_slots").update({ is_active: active }).eq("id", slotId);
  if (error) return { ok: false, message: "Action impossible." };
  await db.rpc("write_audit", { p_actor: admin.id, p_action: active ? "slot.enable" : "slot.disable", p_entity: "delivery_slots", p_entity_id: slotId, p_details: {} });
  revalidatePath("/admin/fournees", "layout");
  return { ok: true, message: active ? "Créneau réactivé." : "Créneau désactivé." };
}

export async function deleteSlot(slotId: string): Promise<AdminState> {
  const admin = await requireAdmin();
  const db = supabaseAdmin();
  const { count } = await db.from("orders").select("id", { count: "exact", head: true }).eq("slot_id", slotId);
  if ((count ?? 0) > 0) return { ok: false, message: "Des commandes utilisent ce créneau : désactivez-le plutôt." };
  const { error } = await db.from("delivery_slots").delete().eq("id", slotId);
  if (error) return { ok: false, message: "Suppression impossible." };
  await db.rpc("write_audit", { p_actor: admin.id, p_action: "slot.delete", p_entity: "delivery_slots", p_entity_id: slotId, p_details: {} });
  revalidatePath("/admin/fournees", "layout");
  return { ok: true, message: "Créneau supprimé." };
}

export async function setStock(cycleId: string, productId: string, total: number, reason: string): Promise<AdminState> {
  const admin = await requireAdmin();
  if (!reason.trim()) return { ok: false, message: "Indiquez la raison de l'ajustement." };
  const { error } = await supabaseAdmin().rpc("admin_set_stock", {
    p_cycle_id: cycleId,
    p_product_id: productId,
    p_total: total,
    p_reason: reason.trim().slice(0, 200),
    p_actor: admin.id,
  });
  if (error) return { ok: false, message: adminErrorMessage(error) };
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
  return { ok: true, message: "Stock ajusté." };
}

const units = z.number().int().min(0).max(100000);

/** Quantité supplémentaire décidée par Alima, en plus de la demande confirmée. */
export async function planExtra(cycleId: string, productId: string, extra: number): Promise<AdminState> {
  const admin = await requireAdmin();
  if (!z.uuid().safeParse(cycleId).success || !z.uuid().safeParse(productId).success || !units.safeParse(extra).success) {
    return { ok: false, message: "Quantité invalide." };
  }
  const { error } = await supabaseAdmin().rpc("admin_plan_extra", { p_cycle_id: cycleId, p_product_id: productId, p_extra: extra, p_actor: admin.id });
  if (error) return { ok: false, message: adminErrorMessage(error) };
  revalidatePath(`/admin/fournees/${cycleId}`);
  return { ok: true, message: "Quantité supplémentaire enregistrée." };
}

const productionSchema = z.object({
  produced: units,
  lost: units,
  note: z.string().trim().max(500),
});

/** Production réelle, pertes et note interne (jamais visibles des clients). */
export async function recordProduction(cycleId: string, productId: string, input: z.input<typeof productionSchema>): Promise<AdminState> {
  const admin = await requireAdmin();
  const parsed = productionSchema.safeParse(input);
  if (!parsed.success || !z.uuid().safeParse(cycleId).success || !z.uuid().safeParse(productId).success) {
    return { ok: false, message: "Vérifiez les quantités saisies." };
  }
  if (parsed.data.lost > parsed.data.produced) return { ok: false, message: "Les pertes ne peuvent pas dépasser la production." };
  const { error } = await supabaseAdmin().rpc("admin_record_production", {
    p_cycle_id: cycleId,
    p_product_id: productId,
    p_produced: parsed.data.produced,
    p_lost: parsed.data.lost,
    p_note: parsed.data.note,
    p_actor: admin.id,
  });
  if (error) return { ok: false, message: adminErrorMessage(error) };
  revalidatePath(`/admin/fournees/${cycleId}`);
  return { ok: true, message: "Production enregistrée. Rien n'est publié tant que vous ne publiez pas le surplus." };
}

const publishSchema = z.object({
  items: z.array(z.object({ productId: z.uuid(), units })).max(50),
  endsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Indiquez la dernière date de vente du surplus."),
  deliveryAllowed: z.boolean(),
});

/** Publication explicite du surplus par Alima (jamais automatique). */
export async function publishSurplus(cycleId: string, input: z.input<typeof publishSchema>): Promise<AdminState> {
  const admin = await requireAdmin();
  const parsed = publishSchema.safeParse(input);
  if (!parsed.success || !z.uuid().safeParse(cycleId).success) {
    return { ok: false, message: parsed.success ? "Fournée introuvable." : parsed.error.issues[0]!.message };
  }
  const { error } = await supabaseAdmin().rpc("admin_publish_surplus", {
    p_cycle_id: cycleId,
    p_items: parsed.data.items.filter((i) => i.units > 0).map((i) => ({ product_id: i.productId, units: i.units })),
    p_ends_at: toIso(parsed.data.endsAt),
    p_delivery_allowed: parsed.data.deliveryAllowed,
    p_actor: admin.id,
  });
  if (error) return { ok: false, message: adminErrorMessage(error) };
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
  return { ok: true, message: "Surplus publié : les douceurs indiquées sont en vente, dans la limite de ces quantités." };
}

/** Retirer un produit du surplus : ses unités restantes repassent en stock interne. */
export async function withdrawSurplus(cycleId: string, productId: string): Promise<AdminState> {
  const admin = await requireAdmin();
  const { error } = await supabaseAdmin().rpc("admin_withdraw_surplus", { p_cycle_id: cycleId, p_product_id: productId, p_actor: admin.id });
  if (error) return { ok: false, message: adminErrorMessage(error) };
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
  return { ok: true, message: "Produit retiré du surplus." };
}
