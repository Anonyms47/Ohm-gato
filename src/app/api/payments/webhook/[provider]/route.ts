import { after, NextResponse } from "next/server";
import { processOutbox } from "@/lib/email/outbox";
import { handlePaymentWebhook } from "@/lib/orders/webhook";
import type { ProviderId } from "@/lib/payments/types";

const PROVIDERS = new Set<ProviderId>(["wave", "orange_money", "test"]);

export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!PROVIDERS.has(provider as ProviderId)) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  // Corps brut indispensable : la signature porte sur les octets exacts reçus.
  const rawBody = await request.text();
  if (rawBody.length > 64_000) return NextResponse.json({ ok: false }, { status: 413 });

  const { httpStatus, outcome } = await handlePaymentWebhook(provider as ProviderId, rawBody, request.headers);
  // E-mail « paiement confirmé » mis en file par la base : envoyé juste après la réponse.
  after(() => processOutbox().catch(() => undefined));
  return NextResponse.json({ ok: httpStatus === 200, outcome }, { status: httpStatus });
}
