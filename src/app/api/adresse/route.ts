import { NextResponse } from "next/server";
import { z } from "zod";
import { searchPlaces } from "@/lib/geo/search";
import { clientIp, isSameOriginJson, jsonError, rateLimit } from "@/lib/http";

const bodySchema = z.object({ q: z.string().trim().min(3).max(120) });

export async function POST(request: Request) {
  if (!isSameOriginJson(request)) return jsonError(403, "FORBIDDEN", "Requête refusée.");
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "INVALID_QUERY", "Saisissez au moins 3 caractères.");

  // Par visiteur, et globalement : le service public d'OpenStreetMap limite à une requête par seconde.
  const [perIp, global] = await Promise.all([
    rateLimit(`geo:ip:${clientIp(request)}`, 20, 600),
    rateLimit("geo:global", 1, 1),
  ]);
  if (!perIp || !global) return jsonError(429, "RATE_LIMITED", "Trop de recherches. Réessayez dans un instant.");

  try {
    const places = await searchPlaces(parsed.data.q);
    return NextResponse.json({ ok: true, places });
  } catch {
    return jsonError(503, "UNAVAILABLE", "Recherche indisponible. Placez le repère directement sur la carte.");
  }
}
