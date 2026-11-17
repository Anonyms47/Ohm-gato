import { NextResponse } from "next/server";
import { isWellFormedAlertToken, unsubscribeFromAlerts } from "@/lib/alerts/service";

/**
 * Désinscription en un clic demandée par le client de messagerie (en-tête List-Unsubscribe-Post).
 * Le jeton personnel suffit ; la réponse ne révèle rien d'autre.
 */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("jeton") ?? "";
  if (!isWellFormedAlertToken(token)) return NextResponse.json({ ok: false }, { status: 400 });
  await unsubscribeFromAlerts(token);
  return NextResponse.json({ ok: true });
}
