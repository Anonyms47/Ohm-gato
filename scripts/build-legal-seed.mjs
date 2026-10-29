// Génère supabase/seed/legal.sql (version publiée en cours des documents) depuis content/legal/*.md.
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

// Version publiée de chaque texte de content/legal (les autres restent en 1.0 du 10 octobre 2026).
// 1.2 du 29 octobre 2026 : formulation neutre (activité en cours de formalisation), zones de livraison, Orange Money, alertes de fournée.
const update = { version: "1.2", publishedAt: "2026-10-29 08:00:00+00", effectiveAt: "2026-10-29" };
const versions = {
  // 1.2 du 29 octobre 2026 : le prénom de la fondatrice n'apparaît plus.
  "allergenes-conservation": { version: "1.2", publishedAt: "2026-10-29 08:00:00+00", effectiveAt: "2026-10-29" },
  "conditions-generales": update,
  confidentialite: update,
  "mentions-legales": update,
  "livraison-retrait": update,
};

const q = (s) => `'${s.replaceAll("'", "''")}'`;
let sql = `-- OHMEGATO — documents légaux publiés (en vigueur le 10 octobre 2026).
-- Généré par scripts/build-legal-seed.mjs depuis content/legal/*.md. Valable en production (rejouable sans doublon).

insert into public.legal_documents (slug, title, description, sort_order) values
${documents.map(([slug, title, description, order]) => `  (${q(slug)}, ${q(title)}, ${q(description)}, ${order})`).join(",\n")}
on conflict (slug) do nothing;
`;
for (const [slug, title] of documents) {
  const content = readFileSync(`content/legal/${slug}.md`, "utf8").trim();
  if (content.includes("$md$")) throw new Error(`${slug} contient $md$`);
  const { version, publishedAt, effectiveAt = "2026-10-10" } = versions[slug] ?? { version: "1.0", publishedAt: "2026-10-10 08:00:00+00" };
  sql += `
insert into public.legal_document_versions (document_slug, version, status, title, content, effective_at, published_at)
select ${q(slug)}, '${version}', 'published', ${q(title)}, $md$${content}$md$, date '${effectiveAt}', timestamptz '${publishedAt}'
where not exists (select 1 from public.legal_document_versions where document_slug = ${q(slug)});
`;
}
writeFileSync("supabase/seed/legal.sql", sql);
console.log(`supabase/seed/legal.sql : ${documents.length} documents`);

// Publication en production : les nouvelles versions (1.2) sont créées en brouillon puis publiées par la fonction de l'atelier
// (l'ancienne version est archivée, les preuves d'acceptation déjà enregistrées restent valables). Rejouable sans doublon.
const changed = Object.entries(versions).filter(([, v]) => v === update || v.version === "1.2").map(([slug]) => slug);
let publish = `-- OHMEGATO — publication des documents légaux en version 1.2 (29 octobre 2026).
-- Généré par scripts/build-legal-seed.mjs. À exécuter une fois en production (SQL Editor) après les migrations ;
-- équivalent à « Publier » dans l'atelier (Documents et règles). Rejouable : sans effet si la 1.2 existe déjà.
`;
for (const slug of changed) {
  const title = documents.find((d) => d[0] === slug)[1];
  const content = readFileSync(`content/legal/${slug}.md`, "utf8").trim();
  publish += `
insert into public.legal_document_versions (document_slug, version, status, title, content, effective_at)
select ${q(slug)}, '1.2', 'draft', ${q(title)}, $md$${content}$md$, date '2026-10-29'
where not exists (select 1 from public.legal_document_versions where document_slug = ${q(slug)} and version = '1.2');
select public.admin_publish_legal_version(id, null) from public.legal_document_versions
 where document_slug = ${q(slug)} and version = '1.2' and status = 'draft';
`;
}
writeFileSync("supabase/seed/legal-publish-1.2.sql", publish);
console.log(`supabase/seed/legal-publish-1.2.sql : ${changed.length} documents`);
