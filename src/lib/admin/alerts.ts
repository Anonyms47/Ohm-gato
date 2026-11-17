import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

const db = () => supabaseAdmin();

export interface AlertSubscriberRow {
  id: string;
  email: string;
  status: "active" | "inactive";
  source: string;
  consentAt: string;
  unsubscribedAt: string | null;
  unsubscribedBy: string | null;
}

export interface AlertHistoryRow {
  id: string;
  cycleNumber: number | null;
  createdAt: string;
  recipients: number;
  sent: number;
  pending: number;
  held: number;
  failed: number;
  skipped: number;
  lastError: string | null;
}

export interface AlertsOverview {
  active: number;
  inactive: number;
  subscribers: AlertSubscriberRow[];
  truncated: boolean;
  history: AlertHistoryRow[];
  /** Fournée ouverte à annoncer (null si aucune fournée n'est ouverte). */
  openCycle: { id: string; number: number; alertId: string | null } | null;
}

/** Échappe les jokers du filtre (une recherche est un texte, pas un motif). */
function likeEscape(q: string) {
  return q.replace(/[\\%_,()]/g, " ").trim();
}

export async function getAlertsOverview(query: string): Promise<AlertsOverview> {
  const q = likeEscape(query.slice(0, 80));
  const [active, inactive, open, alerts] = await Promise.all([
    db().from("batch_alert_subscribers").select("id", { count: "exact", head: true }).eq("status", "active"),
    db().from("batch_alert_subscribers").select("id", { count: "exact", head: true }).eq("status", "inactive"),
    db().from("production_cycles").select("id, number").eq("status", "open").order("number", { ascending: false }).limit(1).maybeSingle(),
    db().from("batch_alerts").select("id, cycle_id, created_at, recipients, production_cycles(number)").order("created_at", { ascending: false }).limit(20),
  ]);
  for (const r of [active, inactive, open, alerts]) if (r.error) throw r.error;

  let list = db()
    .from("batch_alert_subscribers")
    .select("id, email, status, source, consent_at, unsubscribed_at, unsubscribed_by")
    .order("created_at", { ascending: false })
    .limit(51);
  if (q) list = list.ilike("email", `%${q}%`);
  const { data: subs, error } = await list;
  if (error) throw error;

  const alertRows = (alerts.data ?? []) as unknown as { id: string; cycle_id: string; created_at: string; recipients: number; production_cycles: { number: number } | null }[];
  const counts = new Map<string, Record<string, number>>();
  const errors = new Map<string, string>();
  if (alertRows.length) {
    const { data: sends } = await db().from("batch_alert_sends").select("alert_id, status, last_error").in("alert_id", alertRows.map((a) => a.id));
    for (const s of (sends ?? []) as { alert_id: string; status: string; last_error: string | null }[]) {
      const c = counts.get(s.alert_id) ?? {};
      c[s.status] = (c[s.status] ?? 0) + 1;
      counts.set(s.alert_id, c);
      if (s.last_error && (s.status === "failed" || s.status === "held")) errors.set(s.alert_id, s.last_error);
    }
  }
  const openRow = open.data as { id: string; number: number } | null;
  return {
    active: active.count ?? 0,
    inactive: inactive.count ?? 0,
    subscribers: ((subs ?? []) as Record<string, unknown>[]).slice(0, 50).map((s) => ({
      id: s.id as string,
      email: s.email as string,
      status: s.status as "active" | "inactive",
      source: s.source as string,
      consentAt: s.consent_at as string,
      unsubscribedAt: s.unsubscribed_at as string | null,
      unsubscribedBy: s.unsubscribed_by as string | null,
    })),
    truncated: (subs ?? []).length > 50,
    history: alertRows.map((a) => {
      const c = counts.get(a.id) ?? {};
      return {
        id: a.id,
        cycleNumber: a.production_cycles?.number ?? null,
        createdAt: a.created_at,
        recipients: a.recipients,
        sent: c.sent ?? 0,
        pending: (c.pending ?? 0) + (c.sending ?? 0),
        held: c.held ?? 0,
        failed: c.failed ?? 0,
        skipped: c.skipped ?? 0,
        lastError: errors.get(a.id) ?? null,
      };
    }),
    openCycle: openRow ? { id: openRow.id, number: openRow.number, alertId: alertRows.find((a) => a.cycle_id === openRow.id)?.id ?? null } : null,
  };
}

/** Export de la liste (administratrices uniquement) : adresse, statut, source et dates de consentement. */
export async function exportSubscribersCsv(): Promise<string> {
  const { data, error } = await db().from("batch_alert_subscribers").select("email, status, source, consent_at, unsubscribed_at").order("created_at");
  if (error) throw error;
  const cell = (v: string | null) => (v === null ? "" : /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = [["adresse", "statut", "source", "consentement_le", "desinscrit_le"], ...((data ?? []) as { email: string; status: string; source: string; consent_at: string; unsubscribed_at: string | null }[]).map((r) => [r.email, r.status, r.source, r.consent_at, r.unsubscribed_at])];
  return "﻿" + rows.map((r) => r.map((c) => cell(c)).join(";")).join("\r\n") + "\r\n";
}
