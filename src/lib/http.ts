import "server-only";
import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Protection CSRF des routes qui modifient des données : même origine et JSON uniquement. */
export function isSameOriginJson(request: Request): boolean {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("application/json")) return false;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const expected = new URL(serverEnv().NEXT_PUBLIC_SITE_URL).origin;
  return origin === expected || origin === new URL(request.url).origin;
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "inconnue";
}

export function jsonError(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, code, message, ...extra }, { status });
}

/** Limitation de débit persistée en base (fonctionne sur plusieurs instances). */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc("check_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw error;
  return data === true;
}
