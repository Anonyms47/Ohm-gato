import { NextResponse } from "next/server";
import { z } from "zod";
import { otpMessages, verifyLoginCode } from "@/lib/auth/otp";
import { clientIp, isSameOriginJson, jsonError } from "@/lib/http";

const bodySchema = z.object({
  channel: z.enum(["phone", "email"]),
  destination: z.string().min(3).max(200),
  code: z.string().trim().max(12),
});

export async function POST(request: Request) {
  if (!isSameOriginJson(request)) return jsonError(403, "FORBIDDEN", "Requête refusée.");
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "CODE_INVALID", otpMessages.CODE_INVALID);

  const { channel, destination, code } = parsed.data;
  const result = await verifyLoginCode(channel, destination, code.replace(/\s/g, ""), clientIp(request));
  if (!result.ok) {
    const status = result.code === "RATE_LIMITED" || result.code === "TOO_MANY_ATTEMPTS" ? 429 : 422;
    return jsonError(status, result.code, otpMessages[result.code], result.attemptsLeft !== undefined ? { attemptsLeft: result.attemptsLeft } : undefined);
  }
  return NextResponse.json({ ok: true, isNew: result.isNew, needsName: result.needsName, claimedOrders: result.claimedOrders });
}
