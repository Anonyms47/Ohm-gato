// Attribue le rôle administrateur au compte d'un numéro (la personne doit s'être
// connectée une fois sur le site). Usage : npm run admin:grant -- 77 123 45 67
// Variables lues : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY (.env.local ou environnement).
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const raw = process.argv.slice(2).join("").replace(/[\s.\-()]/g, "");
let digits = raw.replace(/^\+/, "").replace(/^00/, "");
if (digits.length === 9) digits = `221${digits}`;
if (!/^221\d{9}$/.test(digits)) {
  console.error("Numéro sénégalais attendu, ex. npm run admin:grant -- 77 123 45 67");
  process.exit(1);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const { data: profile, error } = await db.from("profiles").select("id").eq("phone", digits).maybeSingle();
if (error) throw error;
if (!profile) {
  console.error("Aucun compte avec ce numéro : connectez-vous d'abord une fois sur /connexion.");
  process.exit(1);
}
const { error: grantError } = await db.from("staff_roles").upsert({ user_id: profile.id, role: "admin" });
if (grantError) throw grantError;
await db.from("audit_logs").insert({ action: "role.grant", entity: "staff_roles", entity_id: profile.id, details: { role: "admin", via: "script" } });
console.log(`Rôle administrateur attribué à +${digits}.`);
