/**
 * Réseaux sociaux affichés sur le site. Instagram est toujours présent ; Snapchat n'apparaît que lorsqu'il est activé
 * dans l'atelier avec un vrai identifiant (jamais d'identifiant inventé).
 */
import { brand } from "@/config/brand";

export interface SnapchatSetting {
  handle: string;
  url: string;
  enabled: boolean;
}

export const SNAPCHAT_KEY = "social.snapchat";

const HANDLE = /^[A-Za-z][A-Za-z0-9._-]{2,14}$/;

/** Identifiant Snapchat (3 à 15 caractères, commence par une lettre) sans « @ ». */
export function cleanSnapchatHandle(raw: string): string | null {
  const handle = raw.trim().replace(/^@/, "");
  return HANDLE.test(handle) ? handle : null;
}

/** URL du profil : celle saisie (https, snapchat.com) ou, à défaut, déduite de l'identifiant. */
export function snapchatUrl(handle: string, rawUrl: string): string | null {
  const given = rawUrl.trim();
  if (!given) return `https://www.snapchat.com/add/${encodeURIComponent(handle)}`;
  try {
    const url = new URL(given);
    const host = url.hostname.toLowerCase();
    if (url.protocol === "https:" && (host === "snapchat.com" || host.endsWith(".snapchat.com"))) return url.toString();
  } catch {
    // lien invalide
  }
  return null;
}

export function parseSnapchat(value: unknown): SnapchatSetting | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<SnapchatSetting>;
  const handle = typeof v.handle === "string" ? cleanSnapchatHandle(v.handle) : null;
  const url = handle && typeof v.url === "string" ? snapchatUrl(handle, v.url) : null;
  return handle && url ? { handle, url, enabled: v.enabled === true } : null;
}

export interface SocialLinks {
  instagram: { url: string; handle: string };
  /** null tant que Snapchat est désactivé ou sans identifiant. */
  snapchat: { url: string; handle: string } | null;
}

export function socialLinks(settings: Record<string, unknown>): SocialLinks {
  const snap = parseSnapchat(settings[SNAPCHAT_KEY]);
  return {
    instagram: { url: brand.instagramUrl, handle: brand.instagramHandle },
    snapchat: snap?.enabled ? { url: snap.url, handle: snap.handle } : null,
  };
}
