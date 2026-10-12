import "server-only";
import { AUTOMATION_SETTINGS_KEY, parseAutomationSettings, type AutomationSettings } from "@/lib/admin/automation-settings";
import { toVerifyCount } from "@/lib/admin/allergen-review";
import { activeCycle, listProducts, type AdminCycle } from "@/lib/admin/data";
import { getLegalSettings, missingIdentityFields } from "@/lib/admin/legal";
import { buildTasks, nextCycleStep, type AdminTask, type NextStep, type TaskInput } from "@/lib/admin/tasks";
import { supabaseAdmin } from "@/lib/supabase/admin";

const db = () => supabaseAdmin();

/** Jour de Dakar (UTC+0, sans heure d'été) : bornes [début, lendemain). */
export function dakarDayBounds(now = new Date()): { start: string; end: string } {
  const day = now.toISOString().slice(0, 10);
  const next = new Date(`${day}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { start: `${day}T00:00:00Z`, end: next.toISOString() };
}

export async function getAutomationSettings(): Promise<AutomationSettings> {
  const { data, error } = await db().from("site_settings").select("value").eq("key", AUTOMATION_SETTINGS_KEY).maybeSingle();
  if (error) throw error;
  return parseAutomationSettings(data?.value);
}

export interface WaveToVerify {
  id: string;
  reference: string;
  customerName: string;
  customerPhone: string;
  totalFcfa: number;
  createdAt: string;
}

export interface TodaySummary {
  newOrders: number;
  waveToVerify: number;
  confirmedFcfa: number;
  toPrepare: number;
  pickupsToday: number;
  deliveriesToday: number;
}

export interface TodayData {
  now: number;
  cycle: AdminCycle | null;
  tasks: AdminTask[];
  next: NextStep;
  summary: TodaySummary;
  wave: WaveToVerify[];
}

const ACTIVE = ["confirmed", "preparing", "finishing", "ready", "out_for_delivery"];

/** Données de la page d'accueil de l'administration : uniquement des comptes réels. */
export async function loadToday(): Promise<TodayData> {
  const now = Date.now();
  const { start, end } = dakarDayBounds(new Date(now));
  const [cycle, settings, legal, products] = await Promise.all([activeCycle(), getAutomationSettings(), getLegalSettings(), listProducts()]);

  const head = { count: "exact" as const, head: true };
  const [attention, wave, prepare, ready, incomplete, custom, todayOrders, paidToday, slotsToday, produced] = await Promise.all([
    db().from("orders").select("id", head).eq("status", "needs_attention"),
    db()
      .from("orders")
      .select("id, reference, customer_name, customer_phone, total_fcfa, created_at")
      .eq("payment_status", "pending")
      .not("status", "in", "(pending_payment,cancelled,expired,refunded)")
      .order("created_at"),
    db().from("orders").select("id", head).eq("payment_status", "paid").in("status", ["confirmed", "preparing", "finishing"]),
    db().from("orders").select("fulfillment").eq("status", "ready"),
    db()
      .from("orders")
      .select("id", head)
      .eq("fulfillment", "delivery")
      .in("status", ACTIVE)
      .is("latitude", null)
      .or("landmark.is.null,landmark.eq."),
    db().from("custom_requests").select("id", head).in("status", ["received", "studying"]),
    db().from("orders").select("id", head).gte("created_at", start).lt("created_at", end),
    db().from("payments").select("amount_fcfa").eq("status", "paid").gte("paid_at", start).lt("paid_at", end),
    db()
      .from("orders")
      .select("fulfillment, delivery_slots!inner(starts_at)")
      .in("status", [...ACTIVE, "delivered", "picked_up"])
      .gte("delivery_slots.starts_at", start)
      .lt("delivery_slots.starts_at", end),
    cycle
      ? db().from("inventory_units").select("product_id", head).eq("cycle_id", cycle.id).not("produced_units", "is", null)
      : Promise.resolve({ count: 0, error: null }),
  ]);
  for (const r of [attention, wave, prepare, ready, incomplete, custom, todayOrders, paidToday, slotsToday, produced]) if (r.error) throw r.error;

  const waveRows: WaveToVerify[] = ((wave.data ?? []) as { id: string; reference: string; customer_name: string; customer_phone: string; total_fcfa: number; created_at: string }[]).map((o) => ({
    id: o.id,
    reference: o.reference,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    totalFcfa: o.total_fcfa,
    createdAt: o.created_at,
  }));
  const readyRows = (ready.data ?? []) as { fulfillment: string }[];
  const slotRows = (slotsToday.data ?? []) as { fulfillment: string }[];

  const taskCycle: TaskInput["cycle"] = cycle
    ? {
        id: cycle.id,
        number: cycle.number,
        status: cycle.status,
        opensAt: cycle.opensAt,
        closesAt: cycle.closesAt,
        fulfillmentDate: cycle.fulfillmentDate,
        surplusEndsAt: cycle.surplusEndsAt,
        productionRecorded: (produced.count ?? 0) > 0,
      }
    : null;
  const activeProducts = products.filter((p) => p.isActive);

  const tasks = buildTasks({
    now,
    cycle: taskCycle,
    needsAttention: attention.count ?? 0,
    waveToVerify: { count: waveRows.length, oldestAt: waveRows[0]?.createdAt ?? null },
    paymentAlertHours: settings.paymentAlertHours,
    toPrepare: prepare.count ?? 0,
    ready: { pickup: readyRows.filter((r) => r.fulfillment === "pickup").length, delivery: readyRows.filter((r) => r.fulfillment === "delivery").length },
    incompleteAddresses: incomplete.count ?? 0,
    customToAnswer: custom.count ?? 0,
    allergensToVerify: toVerifyCount(activeProducts),
    identityMissing: missingIdentityFields(legal.identity).length > 0,
  });

  return {
    now,
    cycle,
    tasks,
    next: nextCycleStep(taskCycle, waveRows.length, now),
    wave: waveRows,
    summary: {
      newOrders: todayOrders.count ?? 0,
      waveToVerify: waveRows.length,
      confirmedFcfa: ((paidToday.data ?? []) as { amount_fcfa: number }[]).reduce((s, p) => s + p.amount_fcfa, 0),
      toPrepare: prepare.count ?? 0,
      pickupsToday: slotRows.filter((r) => r.fulfillment === "pickup").length,
      deliveriesToday: slotRows.filter((r) => r.fulfillment === "delivery").length,
    },
  };
}

/** Pastilles de navigation : quelques comptes légers, recalculés à chaque page. */
export async function navBadges(): Promise<Record<string, number>> {
  const head = { count: "exact" as const, head: true };
  const [wave, attention, custom] = await Promise.all([
    db().from("orders").select("id", head).eq("payment_status", "pending").not("status", "in", "(pending_payment,cancelled,expired,refunded)"),
    db().from("orders").select("id", head).eq("status", "needs_attention"),
    db().from("custom_requests").select("id", head).in("status", ["received", "studying"]),
  ]);
  const waveCount = wave.count ?? 0;
  const attentionCount = attention.count ?? 0;
  return {
    "/admin": waveCount + attentionCount,
    "/admin/paiements": waveCount,
    "/admin/commandes": attentionCount,
    "/admin/sur-mesure": custom.count ?? 0,
  };
}

/** File des paiements Wave à vérifier, du plus ancien au plus récent. */
export async function listWaveToVerify(): Promise<WaveToVerify[]> {
  const { data, error } = await db()
    .from("orders")
    .select("id, reference, customer_name, customer_phone, total_fcfa, created_at")
    .eq("payment_status", "pending")
    .not("status", "in", "(pending_payment,cancelled,expired,refunded)")
    .order("created_at");
  if (error) throw error;
  return ((data ?? []) as { id: string; reference: string; customer_name: string; customer_phone: string; total_fcfa: number; created_at: string }[]).map((o) => ({
    id: o.id,
    reference: o.reference,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    totalFcfa: o.total_fcfa,
    createdAt: o.created_at,
  }));
}

/** Heure du serveur (référence des délais affichés dans l'atelier). */
export function serverNow(): number {
  return Date.now();
}
