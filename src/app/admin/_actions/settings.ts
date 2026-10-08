"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { AdminState } from "@/lib/admin/errors";
import { requireAdmin } from "@/lib/auth/session";
import { sniffType } from "@/lib/file-type";
import { serverEnv } from "@/lib/env";
import { normalizeSenegalPhone } from "@/lib/phone";
import { supabaseAdmin } from "@/lib/supabase/admin";

const TEXT_KEYS = ["home.alima_note", "story.quote"] as const;

async function audit(actor: string, action: string, id: string, details: unknown) {
  await supabaseAdmin().rpc("write_audit", { p_actor: actor, p_action: action, p_entity: "site_settings", p_entity_id: id, p_details: details });
}

/** Textes éditoriaux. Vide = rien n'est affiché (jamais de texte inventé). */
export async function saveTextSetting(key: string, value: string): Promise<AdminState> {
  const admin = await requireAdmin();
  if (!(TEXT_KEYS as readonly string[]).includes(key)) return { ok: false, message: "Réglage inconnu." };
  const text = value.trim().slice(0, 600);
  const { error } = await supabaseAdmin().from("site_settings").upsert({ key, value: text || null, is_public: true });
  if (error) return { ok: false, message: "Enregistrement impossible." };
  await audit(admin.id, "settings.update", key, { length: text.length });
  revalidatePath("/", "layout");
  return { ok: true, message: "Enregistré." };
}

function publicUrl(path: string) {
  return `${serverEnv().NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site/${path}`;
}

function sniffAudio(bytes: Uint8Array): { mime: string; ext: string } | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0)) return { mime: "audio/mpeg", ext: "mp3" };
  if (ascii(4, 8) === "ftyp") return { mime: "audio/mp4", ext: "m4a" };
  if (ascii(0, 4) === "OggS") return { mime: "audio/ogg", ext: "ogg" };
  return null;
}

/** Photos d'archives, photo d'Alima et audio de « Notre histoire ». */
export async function uploadStoryMedia(_: AdminState, form: FormData): Promise<AdminState> {
  const admin = await requireAdmin();
  const kind = String(form.get("kind") ?? "");
  const file = form.get("file");
  const alt = String(form.get("alt") ?? "").trim().slice(0, 200);
  const caption = String(form.get("caption") ?? "").trim().slice(0, 160);
  const transcript = String(form.get("transcript") ?? "").trim().slice(0, 5000);
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choisissez un fichier." };
  if (file.size > 10 * 1024 * 1024) return { ok: false, message: "Le fichier dépasse 10 Mo." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const db = supabaseAdmin();

  if (kind === "audio") {
    const type = sniffAudio(bytes);
    if (!type) return { ok: false, message: "Formats audio acceptés : MP3, M4A, OGG." };
    if (transcript.length < 10) return { ok: false, message: "Ajoutez la transcription de l'audio (accessibilité)." };
    const path = `histoire/audio-${randomUUID()}.${type.ext}`;
    const { error } = await db.storage.from("site").upload(path, bytes, { contentType: type.mime });
    if (error) return { ok: false, message: "Envoi impossible." };
    await db.from("site_settings").upsert({ key: "story.audio", value: { url: publicUrl(path), transcript }, is_public: true });
  } else {
    const type = sniffType(bytes);
    if (!type || type.mime === "application/pdf") return { ok: false, message: "Formats acceptés : WebP, PNG ou JPEG." };
    if (alt.length < 5) return { ok: false, message: "Décrivez la photo (texte alternatif)." };
    const path = `histoire/${kind}-${randomUUID()}.${type.ext}`;
    const { error } = await db.storage.from("site").upload(path, bytes, { contentType: type.mime });
    if (error) return { ok: false, message: "Envoi impossible." };
    const photo = { url: publicUrl(path), alt, caption: caption || undefined };
    if (kind === "alima") {
      await db.from("site_settings").upsert({ key: "story.alima_photo", value: photo, is_public: true });
    } else if (kind === "archive") {
      const { data } = await db.from("site_settings").select("value").eq("key", "story.archive_photos").maybeSingle();
      const list = Array.isArray(data?.value) ? (data.value as unknown[]) : [];
      await db.from("site_settings").upsert({ key: "story.archive_photos", value: [...list, photo].slice(-12), is_public: true });
    } else {
      return { ok: false, message: "Type de média inconnu." };
    }
  }
  await audit(admin.id, "story.media.add", kind, {});
  revalidatePath("/notre-histoire");
  revalidatePath("/admin/reglages");
  return { ok: true, message: "Média ajouté à « Notre histoire »." };
}

export async function removeStoryMedia(kind: "archive" | "alima" | "audio", url: string | null): Promise<AdminState> {
  const admin = await requireAdmin();
  const db = supabaseAdmin();
  if (kind === "archive") {
    const { data } = await db.from("site_settings").select("value").eq("key", "story.archive_photos").maybeSingle();
    const list = Array.isArray(data?.value) ? (data.value as { url: string }[]) : [];
    await db.from("site_settings").upsert({ key: "story.archive_photos", value: list.filter((p) => p.url !== url), is_public: true });
  } else {
    await db.from("site_settings").delete().eq("key", kind === "alima" ? "story.alima_photo" : "story.audio");
  }
  const prefix = `${serverEnv().NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/site/`;
  if (url?.startsWith(prefix)) await db.storage.from("site").remove([url.slice(prefix.length)]);
  await audit(admin.id, "story.media.remove", kind, { url });
  revalidatePath("/notre-histoire");
  revalidatePath("/admin/reglages");
  return { ok: true, message: "Média retiré." };
}

/** Rôles : accordés à un compte existant (la personne s'est connectée au moins une fois). */
export async function grantRole(phoneInput: string, role: string): Promise<AdminState> {
  const admin = await requireAdmin();
  if (role !== "admin" && role !== "courier") return { ok: false, message: "Rôle inconnu." };
  const phone = normalizeSenegalPhone(phoneInput);
  if (!phone) return { ok: false, message: "Numéro invalide." };
  const db = supabaseAdmin();
  const { data: profile } = await db.from("profiles").select("id").eq("phone", phone.replace(/^\+/, "")).maybeSingle();
  if (!profile) return { ok: false, message: "Aucun compte avec ce numéro : la personne doit d'abord se connecter une fois sur le site." };
  const { error } = await db.from("staff_roles").upsert({ user_id: profile.id, role, granted_by: admin.id });
  if (error) return { ok: false, message: "Attribution impossible." };
  await audit(admin.id, "role.grant", profile.id as string, { role });
  revalidatePath("/admin/reglages");
  return { ok: true, message: "Rôle attribué." };
}

export async function revokeRole(userId: string, role: string): Promise<AdminState> {
  const admin = await requireAdmin();
  const db = supabaseAdmin();
  if (role === "admin") {
    const { count } = await db.from("staff_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) <= 1) return { ok: false, message: "Impossible de retirer le dernier administrateur." };
  }
  const { error } = await db.from("staff_roles").delete().eq("user_id", userId).eq("role", role);
  if (error) return { ok: false, message: "Retrait impossible." };
  await audit(admin.id, "role.revoke", userId, { role });
  revalidatePath("/admin/reglages");
  return { ok: true, message: "Rôle retiré." };
}
