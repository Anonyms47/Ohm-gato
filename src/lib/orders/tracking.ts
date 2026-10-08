import "server-only";
import { createHash, createHmac } from "node:crypto";
import { serverEnv } from "@/lib/env";

/**
 * Lien de suivi personnel : 256 bits dérivés de la clé d'idempotence (aléatoire,
 * connue du seul navigateur) et d'un secret serveur. Un double envoi retrouve donc
 * exactement le même lien. Seul le hachage SHA-256 est stocké en base.
 */
export function generateTrackingToken(
  idempotencyKey: string,
  purpose: "suivi" | "sur-mesure" = "suivi",
): { token: string; hash: string } {
  const token = createHmac("sha256", serverEnv().TRACKING_TOKEN_SECRET)
    .update(`${purpose}:${idempotencyKey}`, "utf8")
    .digest("base64url");
  return { token, hash: hashTrackingToken(token) };
}

export function hashTrackingToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isWellFormedToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
