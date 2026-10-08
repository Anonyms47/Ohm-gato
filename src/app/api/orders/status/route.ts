import { NextResponse } from "next/server";
import { clientIp, isSameOriginJson, jsonError, rateLimit } from "@/lib/http";
import { getOrderStatusByToken } from "@/lib/orders/get-order";

/** Interrogation du statut réel (le jeton voyage dans le corps, pas dans l'URL). */
export async function POST(request: Request) {
  if (!isSameOriginJson(request)) return jsonError(403, "FORBIDDEN", "Requête refusée.");
  if (!(await rateLimit(`status:${clientIp(request)}`, 120, 60))) {
    return jsonError(429, "RATE_LIMITED", "Trop de requêtes.");
  }
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  if (typeof body?.token !== "string") return jsonError(400, "BAD_REQUEST", "Requête illisible.");
  const status = await getOrderStatusByToken(body.token);
  if (!status) return jsonError(404, "NOT_FOUND", "Commande introuvable.");
  return NextResponse.json({ ok: true, ...status }, { headers: { "Cache-Control": "no-store" } });
}
