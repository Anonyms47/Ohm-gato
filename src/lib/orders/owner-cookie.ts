import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";

/**
 * Le navigateur qui a passé une commande (ou envoyé une demande) en garde la trace dans
 * un cookie signé, illisible en JavaScript. Les autres porteurs du lien de suivi voient
 * le statut, mais pas les informations personnelles : ils doivent se connecter avec le
 * numéro de la commande (code temporaire) pour les afficher.
 */
export type OwnerKind = "commandes" | "demandes";
const MAX_REFS = 12;

function sign(value: string): string {
  return createHmac("sha256", serverEnv().TRACKING_TOKEN_SECRET).update(`proprietaire:${value}`).digest("base64url");
}

function parse(raw: string | undefined): string[] {
  if (!raw) return [];
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return [];
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return [];
  return Buffer.from(payload, "base64url").toString("utf8").split(",").filter(Boolean);
}

export async function ownedReferences(kind: OwnerKind): Promise<string[]> {
  return parse((await cookies()).get(`ohm_${kind}`)?.value);
}

export async function rememberOwnership(response: NextResponse, kind: OwnerKind, reference: string) {
  const current = await ownedReferences(kind);
  const refs = [reference, ...current.filter((r) => r !== reference)].slice(0, MAX_REFS);
  const payload = Buffer.from(refs.join(","), "utf8").toString("base64url");
  response.cookies.set(`ohm_${kind}`, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: serverEnv().APP_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
}
