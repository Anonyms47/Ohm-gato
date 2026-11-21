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
const update13 = { version: "1.3", publishedAt: "2026-11-14 08:00:00+00", effectiveAt: "2026-11-14" };
const update14 = { version: "1.4", publishedAt: "2026-11-19 08:00:00+00", effectiveAt: "2026-11-19" };
const update15 = { version: "1.5", publishedAt: "2026-11-21 08:00:00+00", effectiveAt: "2026-11-21" };
const update13a = { version: "1.3", publishedAt: "2026-11-21 08:00:00+00", effectiveAt: "2026-11-21" };
const versions = {
  // 1.2 du 29 octobre 2026 : le prénom de la fondatrice n'apparaît plus.
  // 1.3 du 21 novembre 2026 : retrait de la phrase sur les traces « en cours de vérification » (informations confirmées par Alima).
  "allergenes-conservation": update13a,
  confidentialite: update,
  "mentions-legales": update,
  // 1.3 du 14 novembre 2026 : commandes permanentes (fournée désignée par l'atelier, dates et créneau figés à la commande).
  // 1.4 du 19 novembre 2026 : commander sans fournée (date communiquée par OHMEGATO).
  // 1.5 du 21 novembre 2026 : étape 1 de la commande sans « fournée annoncée » obligatoire.
  "conditions-generales": update15,
  "livraison-retrait": update14,
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
const publishFile = (version, date, label, slugs, note, suffix = "") => {
  let publish = `-- OHMEGATO — publication des documents légaux en version ${version} (${label}).
-- Généré par scripts/build-legal-seed.mjs. À exécuter une fois en production (SQL Editor) après les migrations ;
-- équivalent à « Publier » dans l'atelier (Documents et règles). Rejouable : sans effet si la ${version} existe déjà.
${note}`;
  for (const slug of slugs) {
    const title = documents.find((d) => d[0] === slug)[1];
    const content = readFileSync(`content/legal/${slug}.md`, "utf8").trim();
    publish += `
insert into public.legal_document_versions (document_slug, version, status, title, content, effective_at)
select ${q(slug)}, '${version}', 'draft', ${q(title)}, $md$${content}$md$, date '${date}'
where not exists (select 1 from public.legal_document_versions where document_slug = ${q(slug)} and version = '${version}');
select public.admin_publish_legal_version(id, null) from public.legal_document_versions
 where document_slug = ${q(slug)} and version = '${version}' and status = 'draft';
`;
  }
  writeFileSync(`supabase/seed/legal-publish-${version}${suffix}.sql`, publish);
  console.log(`supabase/seed/legal-publish-${version}${suffix}.sql : ${slugs.length} documents`);
};
// 1.2 (29 octobre) : documents modifiés ce jour-là ; 1.3 (14 novembre) : conditions générales et livraison/retrait (commandes permanentes).
// À exécuter dans l'ordre 1.2 puis 1.3.
publishFile("1.2", "2026-10-29", "29 octobre 2026", Object.entries(versions).filter(([, v]) => v === update || v.version === "1.2").map(([slug]) => slug), "");
publishFile("1.3", "2026-11-14", "14 novembre 2026", ["conditions-generales", "livraison-retrait"], "-- Commandes permanentes : conditions générales et livraison/retrait. (Contenu actuel : voir la 1.4.)\n");
publishFile("1.4", "2026-11-19", "19 novembre 2026", Object.entries(versions).filter(([, v]) => v === update14).map(([slug]) => slug), "-- Commander sans fournée : conditions générales et livraison/retrait.\n");
publishFile("1.5", "2026-11-21", "21 novembre 2026", ["conditions-generales"], "-- Étape 1 de la commande : plus de fournée annoncée obligatoire.\n");
publishFile("1.3", "2026-11-21", "21 novembre 2026", ["allergenes-conservation"], "-- Retrait de la phrase obsolète sur les traces (informations confirmées par Alima).\n", "-allergenes");
