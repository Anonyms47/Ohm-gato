import "server-only";
import type { AdminTask } from "@/lib/admin/tasks";
import { dakarDayBounds, getAutomationSettings, loadToday } from "@/lib/admin/today";
import { brand } from "@/config/brand";
import { processOutbox, emailChannel, type OutboxResult } from "@/lib/email/outbox";
import { supabaseAdmin } from "@/lib/supabase/admin";

const db = () => supabaseAdmin();

/** Délai minimal entre deux recalculs déclenchés par une visite de l'atelier. */
const VISIT_THROTTLE_MS = 5 * 60_000;

export interface NotificationSync {
  opened: number;
  updated: number;
  closed: number;
}

/**
 * Notifications de l'atelier = tâches réellement nécessaires, une par sujet (clé stable).
 * Une tâche qui disparaît est marquée terminée ; si elle revient, elle est rouverte.
 * Rejouer la synchronisation ne crée jamais de doublon (clé unique en base).
 */
export async function syncNotifications(tasks: AdminTask[]): Promise<NotificationSync> {
  const result: NotificationSync = { opened: 0, updated: 0, closed: 0 };
  const now = new Date().toISOString();
  const { data, error } = await db().from("admin_notifications").select("id, dedupe_key, title, detail, priority, done_at");
  if (error) throw error;
  const existing = new Map(((data ?? []) as { id: number; dedupe_key: string; title: string; detail: string | null; priority: string; done_at: string | null }[]).map((n) => [n.dedupe_key, n]));
  const current = new Set<string>();

  for (const task of tasks) {
    const key = `task:${task.key}`;
    current.add(key);
    const row = existing.get(key);
    const values = { kind: "task", priority: task.priority, title: task.title, detail: task.detail ?? null, href: task.href, updated_at: now };
    if (!row) {
      const { error: insertError } = await db().from("admin_notifications").upsert({ dedupe_key: key, ...values }, { onConflict: "dedupe_key", ignoreDuplicates: true });
      if (insertError) throw insertError;
      result.opened += 1;
    } else if (row.done_at) {
      // Le sujet revient : nouvelle notification non lue.
      await db().from("admin_notifications").update({ ...values, done_at: null, read_at: null, created_at: now }).eq("id", row.id);
      result.opened += 1;
    } else if (row.title !== task.title || row.detail !== (task.detail ?? null) || row.priority !== task.priority) {
      await db().from("admin_notifications").update(values).eq("id", row.id);
      result.updated += 1;
    }
  }
  const toClose = [...existing.values()].filter((n) => n.dedupe_key.startsWith("task:") && !n.done_at && !current.has(n.dedupe_key)).map((n) => n.id);
  if (toClose.length) {
    await db().from("admin_notifications").update({ done_at: now }).in("id", toClose);
    result.closed = toClose.length;
  }
  return result;
}

/** Résumé quotidien pour l'équipe (si activé et si un service d'e-mail est configuré) : une fois par jour au plus. */
async function queueDailyDigest(tasks: AdminTask[]): Promise<boolean> {
  const settings = await getAutomationSettings();
  if (!settings.dailyDigest || emailChannel() === "none") return false;
  const day = dakarDayBounds().start.slice(0, 10);
  const { error } = await db()
    .from("email_outbox")
    .upsert(
      { idempotency_key: `digest:${day}`, template: "admin_digest", to_email: brand.email, payload: { date: day, lines: tasks.map((t) => t.title) } },
      { onConflict: "idempotency_key", ignoreDuplicates: true },
    );
  if (error) throw error;
  return true;
}

export interface AutomationResult {
  skipped?: "recent";
  notifications?: NotificationSync;
  emails?: OutboxResult;
  digest?: boolean;
}

/**
 * Automatisations de l'atelier, toutes idempotentes et à l'heure du serveur (Dakar, UTC+0) :
 * tâches et alertes recalculées, notifications synchronisées, e-mails en attente envoyés.
 * Aucune n'agit sur une commande, un paiement, un stock ou une fournée.
 */
export async function runAutomations(trigger: "cron" | "visite" | "action"): Promise<AutomationResult> {
  if (trigger === "visite") {
    const { data } = await db().from("automation_runs").select("started_at").eq("job", "atelier").order("started_at", { ascending: false }).limit(1).maybeSingle();
    if (data && Date.now() - Date.parse(data.started_at as string) < VISIT_THROTTLE_MS) return { skipped: "recent" };
  }
  const { data: run, error } = await db().from("automation_runs").insert({ job: "atelier", trigger }).select("id").single();
  if (error) throw error;
  const result: AutomationResult = {};
  try {
    const today = await loadToday();
    result.notifications = await syncNotifications(today.tasks);
    if (trigger === "cron") result.digest = await queueDailyDigest(today.tasks);
    result.emails = await processOutbox(50);
  } finally {
    await db().from("automation_runs").update({ finished_at: new Date().toISOString(), result }).eq("id", run.id);
  }
  return result;
}
