import { NextResponse } from "next/server";
import { subscribeToAlerts } from "@/lib/alerts/service";
import { clientIp, isSameOriginJson, jsonError } from "@/lib/http";

/** Inscription aux alertes « prochaine fournée » (même origine, JSON, limitation de débit). */
export async function POST(request: Request) {
  if (!isSameOriginJson(request)) return jsonError(403, "FORBIDDEN", "Requête refusée.");
  const body = await request.json().catch(() => null);
  const outcome = await subscribeToAlerts(body, clientIp(request));
  if (outcome.ok) return NextResponse.json({ ok: true });
  const status = outcome.code === "RATE_LIMITED" ? 429 : outcome.code === "INVALID" ? 400 : 503;
  return jsonError(status, outcome.code, outcome.message, outcome.field ? { field: outcome.field } : undefined);
}
