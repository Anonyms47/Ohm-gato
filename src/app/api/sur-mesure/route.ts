import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createCustomRequest } from "@/lib/custom/service";
import { clientIp, isSameOriginJson, jsonError } from "@/lib/http";
import { rememberOwnership } from "@/lib/orders/owner-cookie";

/** Envoi d'une demande sur-mesure. Ce n'est jamais une commande : aucun paiement ici. */
export async function POST(request: Request) {
  if (!isSameOriginJson(request)) return jsonError(403, "FORBIDDEN", "Requête refusée.");
  const body = await request.json().catch(() => null);
  if (!body) return jsonError(400, "BAD_REQUEST", "Requête illisible.");
  const user = await getCurrentUser();
  const result = await createCustomRequest(body, { ip: clientIp(request), userId: user?.id ?? null });
  if (!result.ok) return jsonError(result.status, result.code, result.message, result.fieldErrors ? { fieldErrors: result.fieldErrors } : undefined);
  const response = NextResponse.json({ ok: true, reference: result.data.reference, token: result.data.token }, { status: 201 });
  await rememberOwnership(response, "demandes", result.data.reference);
  return response;
}
