"use server";

import { requireAdmin } from "@/lib/auth/session";
import { searchAdmin, type SearchResult } from "@/lib/admin/search";

/** Recherche de la palette : réservée à l'équipe, lecture seule. */
export async function adminSearch(query: string): Promise<SearchResult[]> {
  await requireAdmin();
  if (typeof query !== "string") return [];
  return searchAdmin(query);
}
