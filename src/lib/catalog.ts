import "server-only";
import { cache } from "react";
import type { AllergenDef, AllergenStatus, WorkshopTraces } from "@/lib/allergens";
import { availableUnits, productAvailability } from "@/lib/availability";
import { orderKindFor } from "@/lib/cycle-status";
import type {
  Accent,
  Catalog,
  CatalogProduct,
  CycleSummary,
  SlotSummary,
} from "@/lib/catalog-types";
import { serverEnv } from "@/lib/env";
import type { StorageRule } from "@/lib/storage";
import { supabasePublic } from "@/lib/supabase/public";

interface CycleRow {
  id: string;
  number: number;
  title: string;
  message: string | null;
  opens_at: string;
  closes_at: string;
  production_date: string;
  production_days: number | null;
  production_dates: string[];
  fulfillment_date: string;
  status: string;
  surplus_ends_at: string | null;
  surplus_delivery_allowed: boolean;
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
  storage_rule: StorageRule | null;
  storage_note: string | null;
  storage_confirmed: boolean;
  pairing_slugs: string[];
  sort_order: number;
  product_variants: { id: string; label: string; units_consumed: number; price_fcfa: number; sort_order: number }[];
  product_flavors: { sort_order: number; flavors: { id: string; slug: string; name: string } | null }[];
  product_allergen_statuses: { flavor_id: string | null; allergen_id: string; status: AllergenStatus }[];
  product_recipe_notes: { flavor_id: string | null; label: string; sort_order: number }[];
  product_images: { storage_path: string; alt: string; width: number; height: number; role: "cutout" | "scene" | "detail"; sort_order: number }[];
}

export function toCycleSummary(row: CycleRow, now: number): CycleSummary {
  const base = {
    status: row.status,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    surplusEndsAt: row.surplus_ends_at,
  };
  const orderKind = orderKindFor(base, now);
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    message: row.message,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    productionDate: row.production_date,
    productionDays: row.production_days,
    productionDates: row.production_dates ?? [],
    fulfillmentDate: row.fulfillment_date,
    status: row.status,
    surplusEndsAt: row.surplus_ends_at,
    surplusDeliveryAllowed: row.surplus_delivery_allowed,
    isOpen: orderKind !== null,
    orderKind,
    featuredProductSlug: row.featured?.slug ?? null,
    palette: row.palette,
  };
}
const toCycle = toCycleSummary;

export const CYCLE_SELECT =
  "id, number, title, message, opens_at, closes_at, production_date, production_days, production_dates, fulfillment_date, status, surplus_ends_at, surplus_delivery_allowed, palette, featured:products!production_cycles_featured_product_id_fkey(slug)";

/** Fournée à mettre en avant : ouverte, sinon la prochaine programmée, sinon la plus récente. */
export const getCurrentCycle = cache(async (): Promise<CycleSummary | null> => {
  const { data, error } = await supabasePublic()
    .from("production_cycles")
    .select(CYCLE_SELECT)
    .in("status", ["scheduled", "open", "closed", "preparing", "delivering", "surplus"])
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

/** Fournées programmées après la fournée mise en avant (la prochaine en premier). */
export const getUpcomingCycles = cache(async (excludeId: string | null): Promise<CycleSummary[]> => {
  const { data, error } = await supabasePublic()
    .from("production_cycles")
    .select(CYCLE_SELECT)
    .eq("status", "scheduled")
    .gt("opens_at", new Date().toISOString())
    .order("opens_at", { ascending: true })
    .limit(4)
    .returns<CycleRow[]>();
  if (error) throw error;
  return (data ?? []).filter((row) => row.id !== excludeId).map((row) => toCycle(row, Date.now()));
});

export interface ArchivedCycle extends CycleSummary {
  productNames: string[];
}

/** Archives du journal : fournées terminées ou annulées, avec ce qui était au programme. */
export const getArchivedCycles = cache(async (): Promise<ArchivedCycle[]> => {
  const { data, error } = await supabasePublic()
    .from("production_cycles")
    .select(`${CYCLE_SELECT}, cycle_products(sort_order, products(name))`)
    .in("status", ["done", "cancelled"])
    .order("opens_at", { ascending: false })
    .limit(24)
    .returns<(CycleRow & { cycle_products: { sort_order: number; products: { name: string } | null }[] })[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...toCycle(row, Date.now()),
    productNames: [...row.cycle_products]
      .sort((a, b) => a.sort_order - b.sort_order)
      .flatMap((cp) => (cp.products ? [cp.products.name] : [])),
  }));
});

/** Chemin local (« /products/… », livré avec le site) ou objet du bucket Supabase « products ». */
function imageUrl(path: string): string {
  if (path.startsWith("/")) return path;
  return `${serverEnv().NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/products/${path}`;
}

export const getCatalog = cache(async (): Promise<Catalog> => {
  const db = supabasePublic();
  const current = await getCurrentCycle();
  const cycle = current ? { ...current } : null;

  const productsQuery = db
    .from("products")
    .select(
      `id, slug, name, short_description, description, tips, unit_label, unit_label_plural, staging, accent,
       storage_rule, storage_note, storage_confirmed, pairing_slugs, sort_order,
       product_variants(id, label, units_consumed, price_fcfa, sort_order),
       product_flavors(sort_order, flavors(id, slug, name)),
       product_allergen_statuses(flavor_id, allergen_id, status),
       product_recipe_notes(flavor_id, label, sort_order),
       product_images(storage_path, alt, width, height, role, sort_order)`,
    )
    .eq("is_active", true)
    .eq("product_variants.is_active", true)
    .order("sort_order")
    .returns<ProductRow[]>();

  const [productsRes, cycleProductsRes, inventoryRes, allergensRes, settings] = await Promise.all([
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
    db.from("allergens").select("id, slug, sentence_label, no_added_text, sort_order").eq("is_active", true).order("sort_order"),
    getPublicSettings(),
  ]);
  if (productsRes.error) throw productsRes.error;
  if (allergensRes.error) throw allergensRes.error;
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
      allergenInfo: {
        entries: p.product_allergen_statuses.map((e) => ({ allergenId: e.allergen_id, flavorId: e.flavor_id, status: e.status })),
        recipeNotes: p.product_recipe_notes.map((n) => ({ flavorId: n.flavor_id, label: n.label, sortOrder: n.sort_order })),
      },
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
        // Surplus : seule la quantité réelle restante est affichée, sans « presque épuisé ».
        surplus: cycle?.orderKind === "surplus",
      }),
    };
  });

  // Surplus épuisé : la fournée se ferme d'elle-même (aucune commande possible).
  if (cycle?.orderKind === "surplus" && !products.some((p) => p.inCycle && p.availability === "available")) {
    cycle.isOpen = false;
    cycle.orderKind = null;
    cycle.surplusExhausted = true;
  }

  const allergenDefs: AllergenDef[] = (
    allergensRes.data as { id: string; slug: string; sentence_label: string | null; no_added_text: string | null; sort_order: number }[]
  ).map((a) => ({
    id: a.id,
    slug: a.slug,
    sentenceLabel: a.sentence_label ?? a.slug,
    noAddedText: a.no_added_text ?? "",
    sortOrder: a.sort_order,
  }));

  return { cycle, products, allergenDefs, workshopTraces: parseWorkshopTraces(settings["allergens.workshop_traces"]) };
});

function parseWorkshopTraces(value: unknown): WorkshopTraces {
  const v = value as Partial<WorkshopTraces> | null | undefined;
  const allergens = Array.isArray(v?.allergens) ? v.allergens.filter((a): a is string => typeof a === "string") : [];
  return { enabled: v?.enabled === true && allergens.length > 0, allergens };
}

/** Créneaux d'une phase : précommande (jour principal) ou surplus (commandes tardives). */
/** Une fournée publiée par son numéro (page de détail). */
export const getCycleByNumber = cache(async (number: number): Promise<CycleSummary | null> => {
  const { data, error } = await supabasePublic()
    .from("production_cycles")
    .select(CYCLE_SELECT)
    .eq("number", number)
    .neq("status", "draft")
    .maybeSingle<CycleRow>();
  if (error) throw error;
  return data ? toCycle(data, Date.now()) : null;
});

/** Produits au programme d'une fournée (archives, fournée à venir). */
export async function getCycleProductNames(cycleId: string): Promise<string[]> {
  const { data, error } = await supabasePublic()
    .from("cycle_products")
    .select("sort_order, products(name)")
    .eq("cycle_id", cycleId)
    .order("sort_order")
    .returns<{ sort_order: number; products: { name: string } | null }[]>();
  if (error) throw error;
  return (data ?? []).flatMap((cp) => (cp.products ? [cp.products.name] : []));
}

export async function getSlots(cycleId: string, phase: "preorder" | "surplus" = "preorder"): Promise<SlotSummary[]> {
  const db = supabasePublic();
  const [slotsRes, statusRes] = await Promise.all([
    db
      .from("delivery_slots")
      .select("id, kind, starts_at, ends_at")
      .eq("cycle_id", cycleId)
      .eq("is_active", true)
      .eq("phase", phase)
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


/** Réglages publics (note d'Alima, message d'accueil…). Les valeurs nulles ne sont jamais affichées. */
export const getPublicSettings = cache(async (): Promise<Record<string, unknown>> => {
  const { data, error } = await supabasePublic().from("site_settings").select("key, value").eq("is_public", true);
  if (error) throw error;
  return Object.fromEntries((data as { key: string; value: unknown }[]).map((s) => [s.key, s.value]));
});
