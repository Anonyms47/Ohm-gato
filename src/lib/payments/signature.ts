import { createHmac, timingSafeEqual } from "node:crypto";

export function hmacSha256Hex(secret: string, message: string): string {
  return createHmac("sha256", secret).update(message, "utf8").digest("hex");
}

/** Comparaison en temps constant de deux signatures hexadécimales. */
export function safeEqualHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b)) return false;
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * En-tête de la forme « t=1700000000,v1=abcd… » (format Wave et fournisseur de test).
 * La signature couvre `${t}${corps brut}` ; les horodatages trop anciens sont refusés (rejeu).
 */
export function verifyTimestampedSignature(
  header: string | null,
  rawBody: string,
  secret: string,
  toleranceSeconds = 300,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!header) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const timestamp = parts.find(([k]) => k === "t")?.[1];
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v ?? "");
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > toleranceSeconds) return false;
  const expected = hmacSha256Hex(secret, `${timestamp}${rawBody}`);
  return signatures.some((s) => safeEqualHex(s, expected));
}

export function signTimestamped(rawBody: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): string {
  return `t=${nowSeconds},v1=${hmacSha256Hex(secret, `${nowSeconds}${rawBody}`)}`;
}
