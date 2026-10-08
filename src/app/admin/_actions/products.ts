"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { AdminState } from "@/lib/admin/errors";
import { requireAdmin } from "@/lib/auth/session";
import { sniffType } from "@/lib/file-type";
import { supabaseAdmin } from "@/lib/supabase/admin";

async function audit(actor: string, action: string, entityId: string, details: unknown) {
  await supabaseAdmin().rpc("write_audit", { p_actor: actor, p_action: action, p_entity: "products", p_entity_id: entityId, p_details: details });
}

function refresh(productId?: string) {
  revalidatePath("/admin/produits", "layout");
  if (productId) revalidatePath(`/admin/produits/${productId}`);
  revalidatePath("/", "layout");
}

function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export async function createProduct(_: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) return { ok: false, message: "Indiquez le nom du produit." };
  const slug = slugify(name);
  if (!slug) return { ok: false, message: "Nom invalide." };
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("products")
    .insert({
      slug,
      name,
      short_description: "",
      description: "",
      unit_label: "pièce",
      unit_label_plural: "pièces",
      staging: "standard",
      is_active: false,
      sort_order: 100,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.code === "23505" ? "Un produit porte déjà ce nom." : "Création impossible." };
  await audit(admin.id, "product.create", data.id, { name });
  redirect(`/admin/produits/${data.id}`);
}

const productSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2).max(80),
  category: z.string().trim().regex(/^[a-z0-9-]+$/, "Catégorie : lettres minuscules, chiffres et tirets."),
  shortDescription: z.string().trim().max(200),
  description: z.string().trim().max(2000),
  tips: z.string().trim().max(500).optional(),
  unitLabel: z.string().trim().min(1).max(30),
  unitLabelPlural: z.string().trim().min(1).max(30),
  accent: z.enum(["caramel", "chocolate", "orange", "rose"]),
  sortOrder: z.coerce.number().int(),
  storageRule: z.enum(["", "refrigerated_48h", "ambient_airtight_48h", "cool_wrapped_1w"]),
  storageNote: z.string().trim().max(300).optional(),
  storageConfirmed: z.literal("on").optional(),
  isActive: z.literal("on").optional(),
});

export async function updateProduct(_: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const parsed = productSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  const p = parsed.data;
  if (p.isActive && (!p.shortDescription || !p.description)) {
    return { ok: false, message: "Ajoutez une description courte et une description avant de publier." };
  }
  const update = {
    name: p.name,
    category: p.category,
    short_description: p.shortDescription,
    description: p.description,
    tips: p.tips || null,
    unit_label: p.unitLabel,
    unit_label_plural: p.unitLabelPlural,
    accent: p.accent,
    sort_order: p.sortOrder,
    storage_rule: p.storageRule || null,
    storage_note: p.storageNote || null,
    storage_confirmed: Boolean(p.storageConfirmed) && Boolean(p.storageRule),
    is_active: Boolean(p.isActive),
  };
  const { error } = await supabaseAdmin().from("products").update(update).eq("id", p.id);
  if (error) return { ok: false, message: "Enregistrement impossible." };
  await audit(admin.id, "product.update", p.id, update);
  refresh(p.id);
  return { ok: true, message: "Produit enregistré." };
}

const variantSchema = z.object({
  productId: z.uuid(),
  id: z.union([z.literal(""), z.uuid()]).optional(),
  label: z.string().trim().min(1, "Nom du format requis.").max(60),
  unitsConsumed: z.coerce.number().int().min(1, "Unités consommées : au moins 1."),
  priceFcfa: z.coerce.number().int().min(0, "Prix invalide."),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.literal("on").optional(),
});

export async function saveVariant(_: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const parsed = variantSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  const v = parsed.data;
  const row = {
    product_id: v.productId,
    label: v.label,
    units_consumed: v.unitsConsumed,
    price_fcfa: v.priceFcfa,
    sort_order: v.sortOrder,
    is_active: Boolean(v.isActive),
  };
  const db = supabaseAdmin();
  const { error } = v.id ? await db.from("product_variants").update(row).eq("id", v.id) : await db.from("product_variants").insert(row);
  if (error) return { ok: false, message: error.code === "23505" ? "Ce format existe déjà." : "Enregistrement impossible." };
  await audit(admin.id, v.id ? "variant.update" : "variant.create", v.productId, row);
  refresh(v.productId);
  return { ok: true, message: "Format enregistré." };
}

export async function saveFlavors(productId: string, flavorIds: string[], newFlavor: string): Promise<AdminState> {
  const admin = await requireAdmin();
  const db = supabaseAdmin();
  const ids = [...flavorIds];
  const name = newFlavor.trim();
  if (name) {
    const slug = slugify(name);
    const { data, error } = await db.from("flavors").upsert({ slug, name }, { onConflict: "slug" }).select("id").single();
    if (error) return { ok: false, message: "Parfum impossible à créer." };
    ids.push(data.id as string);
  }
  await db.from("product_flavors").delete().eq("product_id", productId);
  if (ids.length > 0) {
    const { error } = await db.from("product_flavors").insert([...new Set(ids)].map((flavor_id, index) => ({ product_id: productId, flavor_id, sort_order: index })));
    if (error) return { ok: false, message: "Enregistrement impossible." };
  }
  await audit(admin.id, "product.flavors", productId, { flavors: ids.length });
  refresh(productId);
  return { ok: true, message: "Parfums enregistrés." };
}

export async function saveAllergens(productId: string, allergens: { id: string; confirmed: boolean }[]): Promise<AdminState> {
  const admin = await requireAdmin();
  const db = supabaseAdmin();
  await db.from("product_allergens").delete().eq("product_id", productId);
  if (allergens.length > 0) {
    const { error } = await db
      .from("product_allergens")
      .insert(allergens.map((a) => ({ product_id: productId, allergen_id: a.id, confirmed: a.confirmed })));
    if (error) return { ok: false, message: "Enregistrement impossible." };
  }
  await audit(admin.id, "product.allergens", productId, allergens);
  refresh(productId);
  return { ok: true, message: "Allergènes enregistrés. Seuls les allergènes confirmés sont affichés aux clients." };
}

function imageSize(bytes: Uint8Array, mime: string): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mime === "image/png") return { width: view.getUint32(16), height: view.getUint32(20) };
  if (mime === "image/webp") {
    const chunk = String.fromCharCode(...bytes.slice(12, 16));
    if (chunk === "VP8X") return { width: 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16)), height: 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16)) };
    if (chunk === "VP8 ") return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    if (chunk === "VP8L") {
      const b = view.getUint32(21, true);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
  }
  if (mime === "image/jpeg") {
    let offset = 2;
    while (offset < bytes.length) {
      if (bytes[offset] !== 0xff) return null;
      const marker = bytes[offset + 1]!;
      const length = view.getUint16(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc3) return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
      offset += 2 + length;
    }
  }
  return null;
}

export async function uploadProductImage(_: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const productId = String(form.get("productId") ?? "");
  const alt = String(form.get("alt") ?? "").trim();
  const role = String(form.get("role") ?? "cutout");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choisissez une photo." };
  if (file.size > 5 * 1024 * 1024) return { ok: false, message: "La photo dépasse 5 Mo." };
  if (alt.length < 5) return { ok: false, message: "Décrivez la photo (texte alternatif) pour les lecteurs d'écran." };
  if (!["cutout", "scene", "detail"].includes(role)) return { ok: false, message: "Rôle de photo invalide." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffType(bytes);
  if (!type || type.mime === "application/pdf") return { ok: false, message: "Formats acceptés : WebP, PNG ou JPEG." };
  const size = imageSize(bytes, type.mime);
  if (!size || size.width < 1 || size.height < 1) return { ok: false, message: "Dimensions de l'image illisibles." };
  const db = supabaseAdmin();
  const path = `${productId}/${randomUUID()}.${type.ext}`;
  const { error: uploadError } = await db.storage.from("products").upload(path, bytes, { contentType: type.mime });
  if (uploadError) return { ok: false, message: "Envoi de la photo impossible." };
  const { error } = await db.from("product_images").insert({ product_id: productId, storage_path: path, alt, width: size.width, height: size.height, role, sort_order: 10 });
  if (error) return { ok: false, message: "Enregistrement impossible." };
  await audit(admin.id, "product.image.add", productId, { path });
  refresh(productId);
  return { ok: true, message: "Photo ajoutée." };
}

export async function deleteProductImage(imageId: string, productId: string): Promise<AdminState> {
  const admin = await requireAdmin();
  const db = supabaseAdmin();
  const { data } = await db.from("product_images").select("storage_path").eq("id", imageId).single();
  const { error } = await db.from("product_images").delete().eq("id", imageId);
  if (error) return { ok: false, message: "Suppression impossible." };
  const path = data?.storage_path as string | undefined;
  if (path && !path.startsWith("/")) await db.storage.from("products").remove([path]);
  await audit(admin.id, "product.image.delete", productId, { path });
  refresh(productId);
  return { ok: true, message: "Photo supprimée." };
}
