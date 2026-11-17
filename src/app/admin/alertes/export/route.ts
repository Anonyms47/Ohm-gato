import { exportSubscribersCsv } from "@/lib/admin/alerts";
import { getCurrentUser } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Export de la liste des inscrits aux alertes (données personnelles : administratrices uniquement, action journalisée). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return new Response("Accès refusé.", { status: 403, headers: { "Cache-Control": "no-store" } });
  await supabaseAdmin().rpc("write_audit", { p_actor: user.id, p_action: "alert.export", p_entity: "batch_alert_subscribers", p_entity_id: null, p_details: {} });
  return new Response(await exportSubscribersCsv(), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="inscrits-alertes-ohmegato.csv"', "Cache-Control": "no-store" },
  });
}
