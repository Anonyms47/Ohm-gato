import { NextResponse } from "next/server";
import { z } from "zod";
import { insideDakar, reversePlace } from "@/lib/geo/search";
import { clientIp, isSameOriginJson, jsonError, rateLimit } from "@/lib/http";

const bodySchema = z.object({ lat: z.number().finite(), lng: z.number().finite() });

/** Adresse et quartier d'une position posée sur la carte (pré-remplissage du bon de fournée). */
export async function POST(request: Request) {
  if (!isSameOriginJson(request)) return jsonError(403, "FORBIDDEN", "Requête refusée.");
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !insideDakar(parsed.data.lat, parsed.data.lng)) return jsonError(400, "INVALID_POSITION", "Position hors de la région de Dakar.");

  // Par visiteur, et globalement : le service public d'OpenStreetMap limite à une requête par seconde.
  const [perIp, global] = await Promise.all([rateLimit(`geo:ip:${clientIp(request)}`, 20, 600), rateLimit("geo:global", 1, 1)]);
  if (!perIp || !global) return jsonError(429, "RATE_LIMITED", "Trop de demandes. Réessayez dans un instant.");

  try {
    return NextResponse.json({ ok: true, place: await reversePlace(parsed.data.lat, parsed.data.lng) });
  } catch {
    return jsonError(503, "UNAVAILABLE", "Adresse indisponible pour le moment.");
  }
}
