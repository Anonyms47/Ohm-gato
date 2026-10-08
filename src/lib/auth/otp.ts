import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { rateLimit } from "@/lib/http";
import { deliverLoginCode, MessagingUnavailableError } from "@/lib/messaging";
import { normalizeSenegalPhone } from "@/lib/phone";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

/** Durée de validité d'un code, côté OHMEGATO (Supabase applique aussi la sienne). */
export const OTP_TTL_SECONDS = 600;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_SECONDS = 30;

export type Channel = "phone" | "email";

export type OtpFailure =
  | "INVALID_DESTINATION"
  | "RATE_LIMITED"
  | "RESEND_TOO_SOON"
  | "SEND_FAILED"
  | "NO_CODE"
  | "CODE_INVALID"
  | "CODE_EXPIRED"
  | "TOO_MANY_ATTEMPTS";

export const otpMessages: Record<OtpFailure, string> = {
  INVALID_DESTINATION: "Ce numéro ou cette adresse n'est pas valide.",
  RATE_LIMITED: "Trop de demandes en peu de temps. Patientez quelques minutes avant de réessayer.",
  RESEND_TOO_SOON: "Un code vient d'être envoyé. Patientez quelques secondes avant d'en demander un autre.",
  SEND_FAILED:
    "Le code n'a pas pu être envoyé. Réessayez dans un instant, utilisez l'e-mail, ou écrivez-nous sur WhatsApp.",
  NO_CODE: "Aucun code en cours pour ce contact. Demandez un nouveau code.",
  CODE_INVALID: "Ce code ne correspond pas.",
  CODE_EXPIRED: "Ce code a expiré. Demandez-en un nouveau.",
  TOO_MANY_ATTEMPTS: "Trop de codes incorrects. Demandez un nouveau code.",
};

const emailSchema = z.email().max(200);

export function normalizeDestination(channel: Channel, raw: string): string | null {
  if (channel === "phone") return normalizeSenegalPhone(raw);
  const parsed = emailSchema.safeParse(raw.trim().toLowerCase());
  return parsed.success ? parsed.data : null;
}

function destinationHash(channel: Channel, destination: string) {
  return createHash("sha256").update(`${channel}:${destination}`, "utf8").digest("hex");
}

/** Client sans session ni cookie : seulement pour déclencher l'envoi du code. */
function authClient() {
  const env = serverEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function latestRequest(channel: Channel, destination: string) {
  const { data, error } = await supabaseAdmin()
    .from("otp_requests")
    .select("id, failed_attempts, consumed_at, created_at")
    .eq("destination_hash", destinationHash(channel, destination))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; failed_attempts: number; consumed_at: string | null; created_at: string }>();
  if (error) throw error;
  return data;
}

export type RequestCodeResult =
  | { ok: true; destination: string; resendAfter: number; testCode?: string }
  | { ok: false; code: OtpFailure; retryAfter?: number };

export async function requestLoginCode(channel: Channel, raw: string, ip: string): Promise<RequestCodeResult> {
  const destination = normalizeDestination(channel, raw);
  if (!destination) return { ok: false, code: "INVALID_DESTINATION" };

  const previous = await latestRequest(channel, destination);
  if (previous) {
    const elapsed = (Date.now() - Date.parse(previous.created_at)) / 1000;
    if (elapsed < OTP_RESEND_SECONDS) {
      return { ok: false, code: "RESEND_TOO_SOON", retryAfter: Math.ceil(OTP_RESEND_SECONDS - elapsed) };
    }
  }

  const hash = destinationHash(channel, destination);
  const [ipOk, destinationOk] = await Promise.all([
    rateLimit(`otp:ip:${ip}`, 10, 600),
    rateLimit(`otp:dest:${hash}`, 5, 900),
  ]);
  if (!ipOk || !destinationOk) return { ok: false, code: "RATE_LIMITED" };

  const env = serverEnv();
  let testCode: string | undefined;

  if (channel === "phone") {
    const { error } = await authClient().auth.signInWithOtp({ phone: destination, options: { shouldCreateUser: true } });
    if (error) return { ok: false, code: error.status === 429 ? "RATE_LIMITED" : "SEND_FAILED" };
    // Le hook a déposé le code : on le remet tout de suite, puis on l'efface.
    const admin = supabaseAdmin();
    const digits = destination.replace(/^\+/, "");
    const { data: outbox, error: outboxError } = await admin
      .from("otp_outbox")
      .select("id, otp")
      .eq("phone", digits)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: number; otp: string }>();
    if (outboxError || !outbox) return { ok: false, code: "SEND_FAILED" };
    await admin.from("otp_outbox").delete().eq("phone", digits);
    try {
      const delivered = await deliverLoginCode(destination, outbox.otp);
      testCode = delivered.testCode;
    } catch (cause) {
      console.error("Envoi du code impossible", { reason: cause instanceof Error ? cause.message : "inconnue" });
      if (cause instanceof MessagingUnavailableError) return { ok: false, code: "SEND_FAILED" };
      throw cause;
    }
  } else if (env.OTP_TEST_MODE) {
    // Mode test : le compte est créé si besoin et le code affiché, sans e-mail réel.
    const admin = supabaseAdmin();
    await admin.auth.admin.createUser({ email: destination, email_confirm: true });
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: destination });
    if (error || !data.properties?.email_otp) return { ok: false, code: "SEND_FAILED" };
    testCode = data.properties.email_otp;
  } else {
    const { error } = await authClient().auth.signInWithOtp({ email: destination, options: { shouldCreateUser: true } });
    if (error) return { ok: false, code: error.status === 429 ? "RATE_LIMITED" : "SEND_FAILED" };
  }

  const { error: insertError } = await supabaseAdmin().from("otp_requests").insert({ channel, destination_hash: hash });
  if (insertError) throw insertError;
  return { ok: true, destination, resendAfter: OTP_RESEND_SECONDS, testCode };
}

export type VerifyCodeResult =
  | { ok: true; userId: string; isNew: boolean; needsName: boolean; claimedOrders: number }
  | { ok: false; code: OtpFailure; attemptsLeft?: number };

export async function verifyLoginCode(channel: Channel, raw: string, code: string, ip: string): Promise<VerifyCodeResult> {
  const destination = normalizeDestination(channel, raw);
  if (!destination) return { ok: false, code: "INVALID_DESTINATION" };
  if (!(await rateLimit(`otp:verify:${ip}`, 30, 600))) return { ok: false, code: "RATE_LIMITED" };

  const request = await latestRequest(channel, destination);
  if (!request || request.consumed_at) return { ok: false, code: "NO_CODE" };
  if (request.failed_attempts >= OTP_MAX_ATTEMPTS) return { ok: false, code: "TOO_MANY_ATTEMPTS" };
  if (Date.now() - Date.parse(request.created_at) > OTP_TTL_SECONDS * 1000) return { ok: false, code: "CODE_EXPIRED" };
  if (!/^\d{6}$/.test(code)) return registerFailure(request.id);

  const db = await supabaseServer();
  const { data, error } =
    channel === "phone"
      ? await db.auth.verifyOtp({ phone: destination, token: code, type: "sms" })
      : await db.auth.verifyOtp({ email: destination, token: code, type: "email" });
  if (error || !data.user) {
    if (error?.status === 429) return { ok: false, code: "RATE_LIMITED" };
    return registerFailure(request.id);
  }

  const admin = supabaseAdmin();
  await admin.from("otp_requests").update({ consumed_at: new Date().toISOString() }).eq("id", request.id);

  const user = data.user;
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, created_at")
    .eq("id", user.id)
    .maybeSingle<{ full_name: string | null; created_at: string }>();
  let claimedOrders = 0;
  if (user.phone) {
    const { data: claimed } = await admin.rpc("claim_guest_orders", { p_user_id: user.id, p_phone: `+${user.phone.replace(/^\+/, "")}` });
    claimedOrders = typeof claimed === "number" ? claimed : 0;
  }
  const isNew = Date.now() - Date.parse(profile?.created_at ?? user.created_at) < 15 * 60 * 1000 && !profile?.full_name;
  return { ok: true, userId: user.id, isNew, needsName: !profile?.full_name, claimedOrders };
}

async function registerFailure(requestId: string): Promise<VerifyCodeResult> {
  const { data } = await supabaseAdmin().rpc("otp_register_failure", { p_request_id: requestId });
  const attempts = typeof data === "number" ? data : OTP_MAX_ATTEMPTS;
  if (attempts >= OTP_MAX_ATTEMPTS) return { ok: false, code: "TOO_MANY_ATTEMPTS" };
  return { ok: false, code: "CODE_INVALID", attemptsLeft: OTP_MAX_ATTEMPTS - attempts };
}
