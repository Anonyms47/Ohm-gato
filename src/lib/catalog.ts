import "server-only";
import { cache } from "react";
import { availableUnits, productAvailability } from "@/lib/availability";
import type {
  Accent,
  Catalog,
  CatalogProduct,
  CycleSummary,
  SlotSummary,
  ZoneSummary,
} from "@/lib/catalog-types";
import { serverEnv } from "@/lib/env";
import { supabasePublic } from "@/lib/supabase/public";

interface CycleRow {
  id: string;
  number: number;
  title: string;
  message: string | null;
  opens_at: string;
  closes_at: string;
  production_date: string;
  fulfillment_date: string;
  status: string;
  palette: Accent;
  featured: { slug: string } | null;
}

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  description: string;
  tips: string | null;
  unit_label: string;
  unit_label_plural: string;
  staging: string;
  accent: Accent;
  storage_rule: "refrigerated_48h" | "ambient_airtight_48h" | null;
  storage_note: string | null;
  storage_confirmed: boolean;
  pairing_slugs: string[];
  sort_order: number;
  product_variants: { id: string; label: string; units_consumed: number; price_fcfa: number; sort_order: number }[];
  product_flavors: { sort_order: number; flavors: { id: string; slug: string; name: string } | null }[];
  product_allergens: { allergens: { slug: string; name: string } | null }[];
  product_images: { storage_path: string; alt: string; width: number; height: number; role: "cutout" | "scene" | "detail"; sort_order: number }[];
}

function toCycle(row: CycleRow, now: number): CycleSummary {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    message: row.message,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    productionDate: row.production_date,
    fulfillmentDate: row.fulfillment_date,
    status: row.status,
    isOpen:
      row.status === "open" && Date.parse(row.opens_at) <= now && now < Date.parse(row.closes_at),
    featuredProductSlug: row.featured?.slug ?? null,
    palette: row.palette,
  };
}

const CYCLE_SELECT =
  "id, number, title, message, opens_at, closes_at, production_date, fulfillment_date, status, palette, featured:products!production_cycles_featured_product_id_fkey(slug)";

/** Fournée à mettre en avant : ouverte, sinon la prochaine programmée, sinon la plus récente. */
export const getCurrentCycle = cache(async (): Promise<CycleSummary | null> => {
  const { data, error } = await supabasePublic()
    .from("production_cycles")
    .select(CYCLE_SELECT)
    .in("status", ["scheduled", "open", "closed", "preparing", "delivering"])
    .order("opens_at", { ascending: false })
    .limit(10)
    .returns<CycleRow[]>();
  if (error) throw error;
  const now = Date.now();
  const cycles = (data ?? []).map((row) => toCycle(row, now));
  return (
    cycles.find((c) => c.isOpen) ??
    cycles
      .filter((c) => c.status === "scheduled" && Date.parse(c.opensAt) > now)
      .sort((a, b) => Date.parse(a.opensAt) - Date.parse(b.opensAt))[0] ??
    cycles[0] ??
    null
  );
});

export const getArchivedCycles = cache(async (): Promise<CycleSummary[]> => {
  const { data, error } = await supabasePublic()
    .from("production_cycles")
    .select(CYCLE_SELECT)
    .eq("status", "done")
    .order("opens_at", { ascending: false })
    .limit(24)
    .returns<CycleRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => toCycle(row, Date.now()));
});

function imageUrl(path: string): string {
  return `${serverEnv().NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/products/${path}`;
}

export const getCatalog = cache(async (): Promise<Catalog> => {
  const db = supabasePublic();
  const cycle = await getCurrentCycle();

  const productsQuery = db
    .from("products")
    .select(
      `id, slug, name, short_description, description, tips, unit_label, unit_label_plural, staging, accent,
       storage_rule, storage_note, storage_confirmed, pairing_slugs, sort_order,
       product_variants(id, label, units_consumed, price_fcfa, sort_order),
       product_flavors(sort_order, flavors(id, slug, name)),
       product_allergens(allergens(slug, name)),
       product_images(storage_path, alt, width, height, role, sort_order)`,
    )
    .eq("is_active", true)
    .eq("product_variants.is_active", true)
    .order("sort_order")
    .returns<ProductRow[]>();

  const [productsRes, cycleProductsRes, inventoryRes] = await Promise.all([
    productsQuery,
    cycle
      ? db
          .from("cycle_products")
          .select("product_id, disabled_variant_ids, available_flavor_ids")
          .eq("cycle_id", cycle.id)
      : Promise.resolve({ data: [], error: null }),
    cycle
      ? db
          .from("inventory_units")
          .select("product_id, total_units, reserved_units, sold_units")
          .eq("cycle_id", cycle.id)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (productsRes.error) throw productsRes.error;
  if (cycleProductsRes.error) throw cycleProductsRes.error;
  if (inventoryRes.error) throw inventoryRes.error;

  const inCycle = new Map(
    (cycleProductsRes.data as { product_id: string; disabled_variant_ids: string[]; available_flavor_ids: string[] | null }[]).map(
      (cp) => [cp.product_id, cp],
    ),
  );
  const stock = new Map(
    (inventoryRes.data as { product_id: string; total_units: number; reserved_units: number; sold_units: number }[]).map(
      (s) => [s.product_id, { totalUnits: s.total_units, reservedUnits: s.reserved_units, soldUnits: s.sold_units }],
    ),
  );

  const products: CatalogProduct[] = (productsRes.data ?? []).map((p) => {
    const cp = inCycle.get(p.id);
    const variants = [...p.product_variants]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => ({
        id: v.id,
        label: v.label,
        unitsConsumed: v.units_consumed,
        priceFcfa: v.price_fcfa,
        enabledInCycle: Boolean(cp) && !cp!.disabled_variant_ids.includes(v.id),
      }));
    const flavors = [...p.product_flavors]
      .sort((a, b) => a.sort_order - b.sort_order)
      .flatMap((pf) => (pf.flavors ? [pf.flavors] : []))
      .map((f) => ({
        ...f,
        availableInCycle: Boolean(cp) && (cp!.available_flavor_ids === null || cp!.available_flavor_ids.includes(f.id)),
      }));
    const productStock = stock.get(p.id) ?? null;
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      shortDescription: p.short_description,
      description: p.description,
      tips: p.tips,
      unitLabel: p.unit_label,
      unitLabelPlural: p.unit_label_plural,
      staging: p.staging,
      accent: p.accent,
      storage:
        p.storage_confirmed && p.storage_rule ? { rule: p.storage_rule, note: p.storage_note } : null,
      allergens: p.product_allergens.flatMap((pa) => (pa.allergens ? [pa.allergens] : [])),
      pairingSlugs: p.pairing_slugs,
      images: [...p.product_images]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((img) => ({ url: imageUrl(img.storage_path), alt: img.alt, width: img.width, height: img.height, role: img.role })),
      variants,
      flavors,
      inCycle: Boolean(cp),
      unitsLeft: cp && productStock ? availableUnits(productStock) : null,
      availability: productAvailability({
        cycleIsOpen: cycle?.isOpen ?? false,
        inCycle: Boolean(cp),
        stock: productStock,
        variants: variants.filter((v) => v.enabledInCycle),
      }),
    };
  });

  return { cycle, products };
});

export async function getSlots(cycleId: string): Promise<SlotSummary[]> {
  const db = supabasePublic();
  const [slotsRes, statusRes] = await Promise.all([
    db
      .from("delivery_slots")
      .select("id, kind, starts_at, ends_at")
      .eq("cycle_id", cycleId)
      .eq("is_active", true)
      .order("starts_at"),
    db.rpc("cycle_slot_status", { p_cycle_id: cycleId }),
  ]);
  if (slotsRes.error) throw slotsRes.error;
  if (statusRes.error) throw statusRes.error;
  const full = new Map(
    (statusRes.data as { slot_id: string; is_full: boolean }[]).map((s) => [s.slot_id, s.is_full]),
  );
  return (slotsRes.data as { id: string; kind: SlotSummary["kind"]; starts_at: string; ends_at: string }[]).map((s) => ({
    id: s.id,
    kind: s.kind,
    startsAt: s.starts_at,
    endsAt: s.ends_at,
    isFull: full.get(s.id) ?? false,
  }));
}

export async function getZones(): Promise<ZoneSummary[]> {
  const { data, error } = await supabasePublic()
    .from("delivery_zones")
    .select("id, name, districts, fee_fcfa")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return (data as { id: string; name: string; districts: string[]; fee_fcfa: number | null }[]).map((z) => ({
    id: z.id,
    name: z.name,
    districts: z.districts,
    feeFcfa: z.fee_fcfa,
  }));
}

/** Réglages publics (note d'Alima, message d'accueil…). Les valeurs nulles ne sont jamais affichées. */
export const getPublicSettings = cache(async (): Promise<Record<string, unknown>> => {
  const { data, error } = await supabasePublic().from("site_settings").select("key, value").eq("is_public", true);
  if (error) throw error;
  return Object.fromEntries((data as { key: string; value: unknown }[]).map((s) => [s.key, s.value]));
});
