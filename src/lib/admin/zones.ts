import "server-only";
import { toZone, type ZoneRow } from "@/lib/catalog";
import type { DeliveryZone } from "@/lib/delivery/zones";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Toutes les zones (actives et désactivées), avec le nombre de commandes qui les ont utilisées. */
export async function listAllZones(): Promise<(DeliveryZone & { orders: number })[]> {
  const db = supabaseAdmin();
  const [{ data, error }, { data: used }] = await Promise.all([
    db.from("delivery_zones").select("id, name, districts, fee_fcfa, is_active, sort_order, note, updated_at").order("sort_order").order("name"),
    db.from("orders").select("zone_id").not("zone_id", "is", null),
  ]);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of (used ?? []) as { zone_id: string }[]) counts.set(row.zone_id, (counts.get(row.zone_id) ?? 0) + 1);
  return (data as ZoneRow[]).map((row) => ({ ...toZone(row), orders: counts.get(row.id) ?? 0 }));
}
