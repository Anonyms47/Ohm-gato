import { NextResponse } from "next/server";
import { clientIp, isSameOriginJson, jsonError } from "@/lib/http";
import { placeOrder } from "@/lib/orders/place-order";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSameOriginJson(request)) return jsonError(403, "FORBIDDEN", "Requête refusée.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "BAD_REQUEST", "Requête illisible.");
  }

  const {
    data: { user },
  } = await (await supabaseServer()).auth.getUser();

  const result = await placeOrder(body, { ip: clientIp(request), userId: user?.id ?? null });
  if (!result.ok) {
    return jsonError(result.status, result.code, result.message, result.fieldErrors ? { fieldErrors: result.fieldErrors } : undefined);
  }
  return NextResponse.json(result, { status: 201 });
}
