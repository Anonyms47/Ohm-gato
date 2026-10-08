import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { isSameOriginJson, jsonError } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";

const schema = z.object({ fullName: z.string().trim().min(2).max(80) });

export async function POST(request: Request) {
  if (!isSameOriginJson(request)) return jsonError(403, "FORBIDDEN", "Requête refusée.");
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "UNAUTHENTICATED", "Connectez-vous.");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(422, "VALIDATION", "Indiquez votre nom.");
  const db = await supabaseServer();
  const { error } = await db.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", user.id);
  if (error) return jsonError(500, "SAVE_FAILED", "Enregistrement impossible.");
  return NextResponse.json({ ok: true });
}
