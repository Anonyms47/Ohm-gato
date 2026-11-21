-- OHMEGATO — publication des documents légaux en version 1.3 (21 novembre 2026).
-- Généré par scripts/build-legal-seed.mjs. À exécuter une fois en production (SQL Editor) après les migrations ;
-- équivalent à « Publier » dans l'atelier (Documents et règles). Rejouable : sans effet si la 1.3 existe déjà.
-- Retrait de la phrase obsolète sur les traces (informations confirmées par Alima).

insert into public.legal_document_versions (document_slug, version, status, title, content, effective_at)
select 'allergenes-conservation', '1.3', 'draft', 'Allergènes et conservation', $md$## Comment lire nos informations

Pour chaque produit, nous séparons trois informations :

- **les allergènes** : ce que la recette contient (« contient »), les traces possibles lorsqu'elles sont confirmées, et ce qui est préparé sans ajout direct ;
- **les informations de recette** : chocolat, fruits, cannelle… qui ne sont pas des allergènes réglementaires mais peuvent compter pour vous ;
- **la conservation** : comment garder le produit après l'avoir reçu.

Une mention « sans ajout direct » ne signifie pas « sans allergène » : par exemple, un produit préparé sans ajout direct de lait peut contenir du lait ou des traces de lait provenant d'autres ingrédients, comme le chocolat. Les informations encore à vérifier ne sont pas affichées comme des certitudes.

Les descriptions, les informations de recette et les conseils de conservation de chaque produit ont été confirmés par la fondatrice d'OHMEGATO.

> Les produits sont préparés dans un environnement artisanal. En cas d'allergie sévère, contactez OHMEGATO avant de commander afin que la faisabilité de votre commande puisse être vérifiée.

## Conserver vos pâtisseries

- **Avec une sauce, une crème ou des fruits sensibles** (moelleux au chocolat, moelleux aux pommes, verrines, choux à la crème) : au réfrigérateur, 2 jours maximum.
- **Sans sauce, sans crème sensible et sans fruits** (muffins, brownies, cookies) : à température ambiante, dans une boîte ou un emballage hermétique, 2 jours maximum.
- **Cake à l'orange** : jusqu'à 7 jours, correctement emballé et conservé dans un endroit frais.
- **Par forte chaleur à Dakar**, la réfrigération est recommandée lorsque c'est pertinent, notamment pour le cake à l'orange.

Respectez la chaîne du froid pour les produits contenant de la crème, une sauce ou des fruits. Ne consommez pas un produit présentant une odeur, une texture ou un aspect anormal.

Les durées indiquées concernent un produit correctement transporté et conservé après sa réception.$md$, date '2026-11-21'
where not exists (select 1 from public.legal_document_versions where document_slug = 'allergenes-conservation' and version = '1.3');
select public.admin_publish_legal_version(id, null) from public.legal_document_versions
 where document_slug = 'allergenes-conservation' and version = '1.3' and status = 'draft';
