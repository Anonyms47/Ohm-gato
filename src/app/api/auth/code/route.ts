import { NextResponse } from "next/server";
import { z } from "zod";
import { otpMessages, requestLoginCode } from "@/lib/auth/otp";
import { clientIp, isSameOriginJson, jsonError } from "@/lib/http";

const bodySchema = z.object({ channel: z.enum(["phone", "email"]), destination: z.string().min(3).max(200) });

export async function POST(request: Request) {
  if (!isSameOriginJson(request)) return jsonError(403, "FORBIDDEN", "Requête refusée.");
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "INVALID_DESTINATION", otpMessages.INVALID_DESTINATION);

  const result = await requestLoginCode(parsed.data.channel, parsed.data.destination, clientIp(request));
  if (!result.ok) {
    const status = result.code === "RATE_LIMITED" || result.code === "RESEND_TOO_SOON" ? 429 : result.code === "SEND_FAILED" ? 503 : 422;
    return jsonError(status, result.code, otpMessages[result.code], result.retryAfter ? { retryAfter: result.retryAfter } : undefined);
  }
  return NextResponse.json({ ok: true, resendAfter: result.resendAfter, testCode: result.testCode ?? null });
}
