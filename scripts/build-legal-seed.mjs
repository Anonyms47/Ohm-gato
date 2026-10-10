// Génère supabase/seed/legal.sql (version 1.0 publiée des documents) depuis content/legal/*.md.
// Usage : node scripts/build-legal-seed.mjs
import { readFileSync, writeFileSync } from "node:fs";

const documents = [
  ["conditions-generales", "Conditions générales", "Conditions générales de vente et d'utilisation du site OHMEGATO : commandes, fournées, prix, paiement Wave, retrait, livraison, sur-mesure, espace client.", 10],
  ["livraison-retrait", "Livraison et retrait", "Livraison dans Dakar et retrait gratuit à Sud Foire : informations demandées, tarif de livraison réglé au livreur, créneaux.", 20],
  ["annulation-remboursement", "Annulation et remboursement", "Annuler ou modifier une commande, signaler un problème et obtenir un remplacement ou un remboursement chez OHMEGATO.", 30],
  ["confidentialite", "Confidentialité", "Données personnelles collectées par OHMEGATO, finalités, prestataires, durées de conservation, droits et sécurité.", 40],
  ["cookies", "Cookies", "Cookies et stockage local utilisés par le site OHMEGATO : uniquement ce qui est nécessaire, sans statistiques ni publicité.", 50],
  ["mentions-legales", "Mentions légales", "Éditeur du site OHMEGATO, hébergement, propriété intellectuelle et droit applicable.", 60],
  ["allergenes-conservation", "Allergènes et conservation", "Allergènes, informations de recette et conseils de conservation de chaque pâtisserie OHMEGATO.", 70],
];

const q = (s) => `'${s.replaceAll("'", "''")}'`;
let sql = `-- OHMEGATO — documents légaux, version 1.0 publiée le 10 octobre 2026.
-- Généré par scripts/build-legal-seed.mjs depuis content/legal/*.md. Valable en production (rejouable sans doublon).

insert into public.legal_documents (slug, title, description, sort_order) values
${documents.map(([slug, title, description, order]) => `  (${q(slug)}, ${q(title)}, ${q(description)}, ${order})`).join(",\n")}
on conflict (slug) do nothing;
`;
for (const [slug, title] of documents) {
  const content = readFileSync(`content/legal/${slug}.md`, "utf8").trim();
  if (content.includes("$md$")) throw new Error(`${slug} contient $md$`);
  sql += `
insert into public.legal_document_versions (document_slug, version, status, title, content, effective_at, published_at)
select ${q(slug)}, '1.0', 'published', ${q(title)}, $md$${content}$md$, date '2026-10-10', timestamptz '2026-10-10 08:00:00+00'
where not exists (select 1 from public.legal_document_versions where document_slug = ${q(slug)});
`;
}
writeFileSync("supabase/seed/legal.sql", sql);
console.log(`supabase/seed/legal.sql : ${documents.length} documents`);
