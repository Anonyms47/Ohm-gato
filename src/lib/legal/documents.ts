import "server-only";
import { cache } from "react";
import { brand } from "@/config/brand";
import { getPublicSettings } from "@/lib/catalog";
import type { LegalVariables } from "@/lib/legal/markdown";
import { formatSenegalPhone } from "@/lib/phone";
import { supabasePublic } from "@/lib/supabase/public";

export const LEGAL_SLUGS = [
  "conditions-generales",
  "livraison-retrait",
  "annulation-remboursement",
  "confidentialite",
  "cookies",
  "mentions-legales",
  "allergenes-conservation",
] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

/** Documents acceptés à chaque commande (preuve enregistrée avec la commande). */
export const ACCEPTED_AT_CHECKOUT = ["conditions-generales", "annulation-remboursement"] as const;

export interface PublishedDocument {
  id: string;
  slug: LegalSlug;
  version: string;
  title: string;
  content: string;
  contentHash: string;
  effectiveAt: string | null;
  publishedAt: string | null;
}

type Row = {
  id: string;
  document_slug: LegalSlug;
  version: string;
  title: string;
  content: string;
  content_hash: string;
  effective_at: string | null;
  published_at: string | null;
};

const toDocument = (r: Row): PublishedDocument => ({
  id: r.id,
  slug: r.document_slug,
  version: r.version,
  title: r.title,
  content: r.content,
  contentHash: r.content_hash,
  effectiveAt: r.effective_at,
  publishedAt: r.published_at,
});

/** Version publiée d'un document (lecture publique, RLS : seules les versions publiées sont visibles). */
export const getPublishedDocument = cache(async (slug: LegalSlug): Promise<PublishedDocument | null> => {
  const { data, error } = await supabasePublic()
    .from("legal_document_versions")
    .select("id, document_slug, version, title, content, content_hash, effective_at, published_at")
    .eq("document_slug", slug)
    .eq("status", "published")
    .maybeSingle<Row>();
  if (error) throw error;
  return data ? toDocument(data) : null;
});

/** Versions en vigueur des documents acceptés au moment de la commande. */
export async function getCheckoutAcceptance(): Promise<{ termsVersion: string; cancellationVersion: string; termsId: string; cancellationId: string } | null> {
  const [terms, cancellation] = await Promise.all(ACCEPTED_AT_CHECKOUT.map((slug) => getPublishedDocument(slug)));
  if (!terms || !cancellation) return null;
  return { termsId: terms.id, termsVersion: terms.version, cancellationId: cancellation.id, cancellationVersion: cancellation.version };
}

/** Coordonnées publiques (modifiables dans /admin), avec repli sur les données de marque. */
export async function getLegalVariables(): Promise<LegalVariables> {
  const settings = await getPublicSettings();
  const text = (key: string) => (typeof settings[key] === "string" && (settings[key] as string).trim() ? (settings[key] as string).trim() : null);
  const phone = text("brand.phone") ?? brand.phoneE164;
  const pickup = text("brand.pickup_address") ?? brand.pickupAddress;
  return {
    email: text("brand.email") ?? brand.email,
    telephone: formatSenegalPhone(phone),
    adresse_retrait: /dakar/i.test(pickup) ? pickup : `${pickup}, Dakar`,
    site: "ohmegato.com",
  };
}

const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Dakar" });

export function formatLegalDate(value: string | null): string | null {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : dateFormat.format(date);
}
