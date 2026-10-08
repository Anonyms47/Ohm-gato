import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  phone: string | null;
  email: string | null;
  fullName: string | null;
  /** Prénom ou, à défaut, numéro / e-mail : jamais vide. */
  displayName: string;
  isAdmin: boolean;
}

/** Utilisateur connecté, vérifié auprès de Supabase Auth (jamais lu depuis un cookie brut). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: roles }] = await Promise.all([
    db.from("profiles").select("full_name").eq("id", user.id).maybeSingle<{ full_name: string | null }>(),
    // Le rôle est relu côté serveur, avec la clé service : jamais déduit du navigateur.
    supabaseAdmin().from("staff_roles").select("role").eq("user_id", user.id),
  ]);
  const phone = user.phone ? `+${user.phone.replace(/^\+/, "")}` : null;
  const fullName = profile?.full_name ?? null;
  return {
    id: user.id,
    phone,
    email: user.email ?? null,
    fullName,
    displayName: fullName?.split(" ")[0] || phone || user.email || "Mon carnet",
    isAdmin: (roles ?? []).some((r) => r.role === "admin"),
  };
});

/** Page réservée aux membres : redirige vers la connexion en gardant la destination. */
export async function requireUser(next: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?suite=${encodeURIComponent(next)}`);
  return user;
}

export class ForbiddenError extends Error {
  constructor() {
    super("Accès réservé à l'équipe OHMEGATO.");
  }
}

/** Contrôle du rôle administrateur, à appeler en tête de chaque page et action /admin. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?suite=/admin");
  if (!user.isAdmin) throw new ForbiddenError();
  return user;
}

/** Destination de retour sûre : chemin interne uniquement. */
export function safeNext(value: string | null | undefined, fallback = "/compte"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}
