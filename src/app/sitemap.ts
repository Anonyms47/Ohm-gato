import type { MetadataRoute } from "next";
import { getCatalog } from "@/lib/catalog";
import { LEGAL_SLUGS } from "@/lib/legal/documents";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Pages publiques indexables : accueil, carte, fiches produits, histoire, sur-mesure, pages légales. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { products } = await getCatalog().catch(() => ({ products: [] as { slug: string }[] }));
  const paths = ["/", "/carte", "/fournees", "/sur-mesure", "/notre-histoire", ...LEGAL_SLUGS.map((s) => `/${s}`), ...products.map((p) => `/carte/${p.slug}`)];
  return paths.map((path) => ({ url: `${siteUrl}${path === "/" ? "" : path}` }));
}
