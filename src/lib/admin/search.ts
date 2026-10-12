import "server-only";
import { cleanQuery } from "@/lib/admin/query";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type SearchKind = "commande" | "client" | "produit" | "fournee" | "sur-mesure";

export interface SearchResult {
  kind: SearchKind;
  title: string;
  detail: string;
  href: string;
}


/**
 * Recherche globale de l'atelier, côté serveur (clé service, après requireAdmin).
 * Numéro de commande, nom, téléphone, e-mail, produit, fournée, demande sur mesure.
 */
export async function searchAdmin(raw: string): Promise<SearchResult[]> {
  const q = cleanQuery(raw);
  if (q.length < 2) return [];
  const db = supabaseAdmin();
  const digits = q.replace(/\D/g, "");
  const phoneFilter = digits.length >= 4 ? `,customer_phone.ilike.%${digits}%` : "";
  const number = /^\d{1,4}$/.test(q) ? Number(q) : null;

  const [orders, products, cycles, custom] = await Promise.all([
    db
      .from("orders")
      .select("id, reference, customer_name, customer_phone, total_fcfa, status")
      .or(`reference.ilike.%${q}%,customer_name.ilike.%${q}%,customer_email.ilike.%${q}%${phoneFilter}`)
      .order("created_at", { ascending: false })
      .limit(8),
    db.from("products").select("id, name, slug").ilike("name", `%${q}%`).limit(5),
    number !== null
      ? db.from("production_cycles").select("id, number, title").eq("number", number).limit(3)
      : db.from("production_cycles").select("id, number, title").ilike("title", `%${q}%`).limit(3),
    db
      .from("custom_requests")
      .select("id, reference, customer_name, occasion")
      .or(`reference.ilike.%${q}%,customer_name.ilike.%${q}%,customer_email.ilike.%${q}%${phoneFilter}`)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  for (const r of [orders, products, cycles, custom]) if (r.error) throw r.error;

  const results: SearchResult[] = [];
  const seenPhones = new Set<string>();
  for (const o of (orders.data ?? []) as { id: string; reference: string; customer_name: string; customer_phone: string; total_fcfa: number }[]) {
    results.push({ kind: "commande", title: o.reference, detail: `${o.customer_name} · ${o.total_fcfa.toLocaleString("fr-FR")} FCFA`, href: `/admin/commandes/${o.id}` });
    if (!seenPhones.has(o.customer_phone)) {
      seenPhones.add(o.customer_phone);
      results.push({ kind: "client", title: o.customer_name, detail: o.customer_phone, href: `/admin/clients/${encodeURIComponent(o.customer_phone)}` });
    }
  }
  for (const p of (products.data ?? []) as { id: string; name: string }[]) {
    results.push({ kind: "produit", title: p.name, detail: "Produit", href: `/admin/produits/${p.id}` });
  }
  for (const c of (cycles.data ?? []) as { id: string; number: number; title: string }[]) {
    results.push({ kind: "fournee", title: `Fournée n°${c.number}`, detail: c.title, href: `/admin/fournees/${c.id}` });
  }
  for (const r of (custom.data ?? []) as { id: string; reference: string; customer_name: string; occasion: string }[]) {
    results.push({ kind: "sur-mesure", title: r.reference, detail: `${r.customer_name} · ${r.occasion}`, href: `/admin/sur-mesure/${r.id}` });
  }
  // Clients d'abord regroupés après leurs commandes : on garde un ordre stable par type.
  const rank: Record<SearchKind, number> = { commande: 0, client: 1, "sur-mesure": 2, fournee: 3, produit: 4 };
  return results.sort((a, b) => rank[a.kind] - rank[b.kind]).slice(0, 20);
}
