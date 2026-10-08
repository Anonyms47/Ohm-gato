import "server-only";
import { randomUUID } from "node:crypto";
import { ATTACHMENT_MAX_BYTES } from "@/lib/custom/status";
import { sniffType } from "@/lib/file-type";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type StoredFile = { path: string; mime: string; size: number; name: string };

/** Contrôle puis dépose une pièce jointe dans le stockage privé « sur-mesure ». */
export async function storeAttachment(requestId: string, file: File): Promise<StoredFile | { error: string }> {
  if (file.size === 0) return { error: "Le fichier est vide." };
  if (file.size > ATTACHMENT_MAX_BYTES) return { error: "Le fichier dépasse 5 Mo." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffType(bytes);
  if (!type) return { error: "Formats acceptés : JPEG, PNG, WebP ou PDF." };
  const path = `${requestId}/${randomUUID()}.${type.ext}`;
  const { error } = await supabaseAdmin().storage.from("sur-mesure").upload(path, bytes, {
    contentType: type.mime,
    upsert: false,
  });
  if (error) throw error;
  const name = file.name.replace(/[^\p{L}\p{N}._ -]/gu, "").slice(0, 120) || `piece-jointe.${type.ext}`;
  return { path, mime: type.mime, size: file.size, name };
}

/** Liens temporaires (10 minutes) vers les pièces jointes privées. */
export async function signAttachmentUrls(paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const { data, error } = await supabaseAdmin().storage.from("sur-mesure").createSignedUrls(paths, 600);
  if (error) throw error;
  return new Map((data ?? []).flatMap((d) => (d.signedUrl && d.path ? [[d.path, d.signedUrl] as const] : [])));
}
