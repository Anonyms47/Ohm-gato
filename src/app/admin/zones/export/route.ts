import { listAllZones } from "@/lib/admin/zones";
import { getCurrentUser } from "@/lib/auth/session";
import { zonesToCsv } from "@/lib/delivery/zones-csv";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Export CSV de la grille de livraison (administratrices uniquement). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return new Response("Accès refusé.", { status: 403, headers: { "Cache-Control": "no-store" } });
  const zones = await listAllZones();
  await supabaseAdmin().rpc("write_audit", { p_actor: user.id, p_action: "zones.export", p_entity: "delivery_zones", p_entity_id: null, p_details: { zones: zones.length } });
  return new Response(zonesToCsv(zones), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="zones-de-livraison-ohmegato.csv"', "Cache-Control": "no-store" },
  });
}
