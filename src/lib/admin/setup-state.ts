import "server-only";
import { getPaymentSettings } from "@/lib/payments/settings";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { TaskInput } from "@/lib/admin/tasks";

/**
 * Éléments à compléter dans l'atelier. Une lecture qui échoue (table absente avant la migration, base lente) ne casse jamais
 * « Aujourd'hui » : les tâches correspondantes sont simplement omises.
 */
export async function getSetupState(openCycle: { id: string; number: number } | null): Promise<TaskInput["setup"]> {
  try {
    const db = supabaseAdmin();
    const head = { count: "exact" as const, head: true };
    const [zones, subscribers, review, announced, payments] = await Promise.all([
      db.from("delivery_zones").select("id", head).eq("is_active", true),
      db.from("batch_alert_subscribers").select("id", head).eq("status", "active"),
      db.from("batch_alert_sends").select("id", head).in("status", ["held", "failed"]),
      openCycle ? db.from("batch_alerts").select("id", head).eq("cycle_id", openCycle.id) : Promise.resolve({ count: 0, error: null }),
      getPaymentSettings(),
    ]);
    for (const r of [zones, subscribers, review, announced]) if (r.error) throw r.error;
    const withoutLink = (["wave", "orange_money"] as const).filter((p) => payments[p].enabled && !payments[p].merchantLink).map((p) => payments[p].displayName);
    return {
      zonesActive: zones.count ?? 0,
      paymentsWithoutLink: withoutLink,
      alerts: {
        activeSubscribers: subscribers.count ?? 0,
        sendsToReview: review.count ?? 0,
        openCycleNumber: openCycle?.number ?? null,
        openCycleAnnounced: (announced.count ?? 0) > 0,
      },
    };
  } catch (error) {
    console.error("État de configuration illisible", { reason: error instanceof Error ? error.message : "inconnue" });
    return undefined;
  }
}
