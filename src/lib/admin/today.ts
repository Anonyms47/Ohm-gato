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
    db().from("custom_requests").select("created_at").in("status", ["received", "studying"]),
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
  const reminderEnd = new Date(now + settings.slotReminderHours * 3_600_000).toISOString();
  const [soon, noSlot] = await Promise.all([
    db()
      .from("orders")
      .select("id, delivery_slots!inner(starts_at)", head)
      .eq("payment_status", "paid")
      .in("status", ["confirmed", "preparing", "finishing"])
      .gte("delivery_slots.starts_at", new Date(now).toISOString())
      .lt("delivery_slots.starts_at", reminderEnd),
    db().from("orders").select("id", head).eq("status", "ready").is("slot_id", null),
  ]);
  if (soon.error) throw soon.error;
  if (noSlot.error) throw noSlot.error;
  const customRows = (custom.data ?? []) as { created_at: string }[];
  const customOverdue = customRows.filter((r) => now - Date.parse(r.created_at) >= settings.customAnswerHours * 3_600_000).length;

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
  // Import différé : le module des e-mails dépend lui-même des réglages de l'atelier.
  const emails = await (await import("@/lib/email/health")).getEmailAlertState().catch(() => undefined);

  const tasks = buildTasks({
    now,
    cycle: taskCycle,
    needsAttention: attention.count ?? 0,
    waveToVerify: { count: waveRows.length, oldestAt: waveRows[0]?.createdAt ?? null },
    paymentAlertHours: settings.paymentAlertHours,
    toPrepare: prepare.count ?? 0,
    ready: { pickup: readyRows.filter((r) => r.fulfillment === "pickup").length, delivery: readyRows.filter((r) => r.fulfillment === "delivery").length },
    incompleteAddresses: incomplete.count ?? 0,
    customToAnswer: { overdue: customOverdue, fresh: customRows.length - customOverdue },
    customAnswerHours: settings.customAnswerHours,
    slotSoonNotReady: soon.count ?? 0,
    slotReminderHours: settings.slotReminderHours,
    readyWithoutSlot: noSlot.count ?? 0,
    allergensToVerify: toVerifyCount(activeProducts),
    identityMissing: missingIdentityFields(legal.identity).length > 0,
    emails,
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
  const [wave, attention, custom, unread] = await Promise.all([
    db().from("orders").select("id", head).eq("payment_status", "pending").not("status", "in", "(pending_payment,cancelled,expired,refunded)"),
    db().from("orders").select("id", head).eq("status", "needs_attention"),
    db().from("custom_requests").select("id", head).in("status", ["received", "studying"]),
    db().from("admin_notifications").select("id", head).is("done_at", null).is("read_at", null),
  ]);
  const waveCount = wave.count ?? 0;
  const attentionCount = attention.count ?? 0;
  return {
    "/admin": waveCount + attentionCount,
    "/admin/paiements": waveCount,
    "/admin/commandes": attentionCount,
    "/admin/sur-mesure": custom.count ?? 0,
    "/admin/notifications": unread.count ?? 0,
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

export interface VerifiedPayment {
  orderId: string;
  reference: string;
  customerName: string;
  totalFcfa: number;
  verifiedAt: string;
  verifiedBy: string | null;
}

/** Paiements Wave vérifiés aujourd'hui (journal d'audit : qui et quand). */
export async function listVerifiedToday(): Promise<VerifiedPayment[]> {
  const { start, end } = dakarDayBounds();
  const { data, error } = await db()
    .from("audit_logs")
    .select("entity_id, actor_id, created_at")
    .eq("action", "order.payment_recorded")
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as { entity_id: string; actor_id: string | null; created_at: string }[];
  if (rows.length === 0) return [];
  const [orders, profiles] = await Promise.all([
    db().from("orders").select("id, reference, customer_name, total_fcfa").in("id", rows.map((r) => r.entity_id)),
    db().from("profiles").select("id, full_name, phone").in("id", rows.map((r) => r.actor_id).filter((x): x is string => Boolean(x))),
  ]);
  if (orders.error) throw orders.error;
  const byId = new Map(((orders.data ?? []) as { id: string; reference: string; customer_name: string; total_fcfa: number }[]).map((o) => [o.id, o]));
  const names = new Map(((profiles.data ?? []) as { id: string; full_name: string | null; phone: string | null }[]).map((p) => [p.id, p.full_name || (p.phone ? `+${p.phone}` : "Équipe")]));
  return rows
    .filter((r) => byId.has(r.entity_id))
    .map((r) => {
      const o = byId.get(r.entity_id)!;
      return { orderId: o.id, reference: o.reference, customerName: o.customer_name, totalFcfa: o.total_fcfa, verifiedAt: r.created_at, verifiedBy: r.actor_id ? (names.get(r.actor_id) ?? "Équipe") : null };
    });
}
