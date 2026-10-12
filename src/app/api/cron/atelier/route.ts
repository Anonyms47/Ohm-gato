import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runAutomations } from "@/lib/admin/automations";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

function authorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Passage quotidien des automatisations (planificateur Vercel, en-tête Authorization: Bearer CRON_SECRET).
 * Idempotent : un double appel ne crée ni notification, ni e-mail en double.
 */
export async function GET(request: Request) {
  const secret = serverEnv().CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET non configuré." }, { status: 503 });
  if (!authorized(request.headers.get("authorization"), secret)) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const result = await runAutomations("cron");
  return NextResponse.json({ ok: true, result }, { headers: { "Cache-Control": "no-store" } });
}
