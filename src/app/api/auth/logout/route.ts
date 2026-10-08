import { NextResponse } from "next/server";
import { isSameOriginJson, jsonError } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSameOriginJson(request)) return jsonError(403, "FORBIDDEN", "Requête refusée.");
  const body = (await request.json().catch(() => ({}))) as { scope?: string };
  const db = await supabaseServer();
  await db.auth.signOut({ scope: body.scope === "others" ? "others" : body.scope === "global" ? "global" : "local" });
  return NextResponse.json({ ok: true });
}
