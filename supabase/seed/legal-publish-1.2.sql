-- OHMEGATO — publication des documents légaux en version 1.2 (29 octobre 2026).
-- Généré par scripts/build-legal-seed.mjs. À exécuter une fois en production (SQL Editor) après les migrations ;
-- équivalent à « Publier » dans l'atelier (Documents et règles). Rejouable : sans effet si la 1.2 existe déjà.

insert into public.legal_document_versions (document_slug, version, status, title, content, effective_at)
select 'allergenes-conservation', '1.2', 'draft', 'Allergènes et conservation', $md$## Comment lire nos informations

Pour chaque produit, nous séparons trois informations :

- **les allergènes** : ce que la recette contient (« contient »), les traces possibles lorsqu'elles sont confirmées, et ce qui est préparé sans ajout direct ;
- **les informations de recette** : chocolat, fruits, cannelle… qui ne sont pas des allergènes réglementaires mais peuvent compter pour vous ;
- **la conservation** : comment garder le produit après l'avoir reçu.

Une mention « sans ajout direct » ne signifie pas « sans allergène » : par exemple, un produit préparé sans ajout direct de lait peut contenir du lait ou des traces de lait provenant d'autres ingrédients, comme le chocolat. Les informations encore à vérifier ne sont pas affichées comme des certitudes.

Les descriptions, les informations de recette et les conseils de conservation de chaque produit ont été confirmés par la fondatrice d'OHMEGATO. Les traces liées aux emballages des ingrédients (soja, arachides, fruits à coque, sésame…) restent en cours de vérification et ne sont pas affichées tant qu'elles ne sont pas contrôlées.

> Les produits sont préparés dans un environnement artisanal. En cas d'allergie sévère, contactez OHMEGATO avant de commander afin que la faisabilité de votre commande puisse être vérifiée.

## Conserver vos pâtisseries

- **Avec une sauce, une crème ou des fruits sensibles** (moelleux au chocolat, moelleux aux pommes, verrines, choux à la crème) : au réfrigérateur, 2 jours maximum.
- **Sans sauce, sans crème sensible et sans fruits** (muffins, brownies, cookies) : à température ambiante, dans une boîte ou un emballage hermétique, 2 jours maximum.
- **Cake à l'orange** : jusqu'à 7 jours, correctement emballé et conservé dans un endroit frais.
- **Par forte chaleur à Dakar**, la réfrigération est recommandée lorsque c'est pertinent, notamment pour le cake à l'orange.

Respectez la chaîne du froid pour les produits contenant de la crème, une sauce ou des fruits. Ne consommez pas un produit présentant une odeur, une texture ou un aspect anormal.

Les durées indiquées concernent un produit correctement transporté et conservé après sa réception.$md$, date '2026-10-29'
where not exists (select 1 from public.legal_document_versions where document_slug = 'allergenes-conservation' and version = '1.2');
select public.admin_publish_legal_version(id, null) from public.legal_document_versions
 where document_slug = 'allergenes-conservation' and version = '1.2' and status = 'draft';

insert into public.legal_document_versions (document_slug, version, status, title, content, effective_at)
select 'confidentialite', '1.2', 'draft', 'Confidentialité', $md$## Qui traite vos données

Le responsable du traitement est OHMEGATO. OHMEGATO est une activité de pâtisserie maison actuellement en cours de formalisation à Dakar.

Pour toute question ou demande sur vos données personnelles : {{email}}.

Cette politique est rédigée en tenant compte de la législation sénégalaise sur la protection des données à caractère personnel et sur les transactions électroniques.

## Les données que nous collectons

Selon ce que vous faites sur le site, nous pouvons collecter :

- votre nom ;
- votre adresse e-mail ;
- si vous demandez à être prévenu(e) de l'ouverture d'une fournée : votre adresse e-mail, la date, le texte et la page de votre consentement (aucune adresse IP n'est conservée) ;
- votre numéro de téléphone ;
- les données de connexion et les codes temporaires de connexion ;
- l'historique et le contenu de vos commandes ;
- vos préférés et vos préférences de notification ;
- votre adresse de livraison, votre quartier et votre point de repère ;
- les coordonnées géographiques du repère que vous placez sur la carte ;
- vos demandes sur mesure, vos messages et les fichiers que vous y joignez (images ou PDF) ;
- le statut du paiement de vos commandes (en attente, payé, annulé…) ;
- des données techniques nécessaires à la sécurité (limitation des tentatives, sessions) ;
- les traces des actions de l'équipe dans l'administration (journal d'audit).

Nous n'enregistrons jamais votre code secret, votre code PIN ni vos identifiants Wave ou Orange Money.

## Pourquoi nous les utilisons

- créer et gérer votre compte ;
- vous envoyer les codes de connexion ;
- enregistrer, préparer et suivre vos commandes ;
- vérifier le statut de vos paiements ;
- organiser les retraits et les livraisons ;
- traiter vos demandes sur mesure ;
- répondre à vos messages ;
- traiter les réclamations et les remboursements ;
- prévenir la fraude et sécuriser le site ;
- respecter les obligations administratives applicables ;
- vous prévenir de l'ouverture d'une fournée, uniquement si vous l'avez demandé ;
- vous envoyer des communications commerciales, uniquement si vous y avez consenti.

## Votre position

Votre position n'est demandée que si vous appuyez sur « Utiliser ma position ». Elle sert uniquement à placer le repère de livraison sur la carte.

Vous pouvez refuser et placer le repère vous-même en touchant la carte. Nous ne suivons jamais votre position en continu : seul l'emplacement du repère validé avec votre commande est enregistré.

## Qui peut y accéder

Vos données ne sont accessibles qu'à OHMEGATO et, dans la limite nécessaire, aux prestataires techniques indispensables au fonctionnement du site :

- Supabase : base de données, authentification, stockage des fichiers et fonctions du serveur ;
- Vercel : hébergement et déploiement du site ;
- Brevo : envoi des codes de connexion, des e-mails liés à vos commandes et des alertes d'ouverture de fournée que vous avez demandées ;
- Spacemail : messagerie professionnelle d'OHMEGATO ;
- OpenStreetMap : affichage de la carte et recherche de quartiers ;
- Wave et Orange Money : paiement par lien marchand, selon les conditions de chaque service ;
- le livreur, uniquement pour les informations nécessaires à la livraison (nom et numéro du destinataire, adresse, repère, position).

Le livreur n'a jamais accès à l'historique de votre compte ni à d'autres données.

## Combien de temps nous les gardons

- vos données de commande sont conservées le temps nécessaire à la préparation, à la livraison et au suivi de la commande ;
- les informations nécessaires sont ensuite conservées pendant les durées imposées par les obligations administratives, comptables ou légales applicables ;
- votre inscription aux alertes d'ouverture de fournée est conservée jusqu'à votre désinscription (lien dans chaque e-mail) ou votre demande ;
- les données qui ne sont plus nécessaires sont supprimées ou anonymisées ;
- votre compte est supprimé à votre demande ou depuis votre espace client, sous réserve des informations que la loi impose de conserver ;
- les codes temporaires et les sessions sont supprimés ou expirent automatiquement selon les mécanismes de sécurité du site.

## Vos droits

Vous pouvez :

- accéder à vos données ;
- les faire rectifier ou mettre à jour ;
- vous opposer à un traitement, dans les cas prévus par la loi ;
- demander leur suppression, dans les limites autorisées ;
- retirer à tout moment un consentement donné ;
- récupérer les données disponibles dans votre espace client (export).

Envoyez vos demandes à {{email}}. Avant de transmettre ou de supprimer des données, nous pouvons vérifier raisonnablement votre identité.

Vous pouvez aussi saisir l'autorité sénégalaise compétente en matière de protection des données personnelles.

## Sécurité

Nous protégeons vos données avec des mesures adaptées, sans prétendre à une sécurité absolue :

- accès aux données limité selon le rôle de chacun ;
- connexion par code temporaire, sans mot de passe à retenir ;
- règles d'accès en base de données (RLS) pour chaque table ;
- journal d'audit des actions de l'équipe ;
- validation des données reçues ;
- limitation du nombre de tentatives ;
- signature des notifications de paiement ;
- chiffrement fourni par les infrastructures utilisées.

## Les e-mails que nous envoyons

Nous envoyons les e-mails nécessaires à vos commandes et à votre connexion. Les communications promotionnelles sont séparées et facultatives : aucune case n'est cochée à l'avance, et vous pouvez vous désinscrire à tout moment depuis votre espace client.

## Modifications

La date et la version de cette politique sont indiquées en haut de la page. En cas de changement important, nous vous en informons lorsque c'est raisonnablement possible.$md$, date '2026-10-29'
where not exists (select 1 from public.legal_document_versions where document_slug = 'confidentialite' and version = '1.2');
select public.admin_publish_legal_version(id, null) from public.legal_document_versions
 where document_slug = 'confidentialite' and version = '1.2' and status = 'draft';

insert into public.legal_document_versions (document_slug, version, status, title, content, effective_at)
select 'mentions-legales', '1.2', 'draft', 'Mentions légales', $md$## Éditeur du site

OHMEGATO est une activité de pâtisserie maison actuellement en cours de formalisation à Dakar.

Responsable de l'activité : Madame Alimatou Sadiya Thiam.

- Site : ohmegato.com
- E-mail : {{email}}
- Téléphone et WhatsApp : {{telephone}}
- Adresse de retrait des commandes : {{adresse_retrait}}

## Hébergement

Le site est hébergé et déployé par Vercel. La base de données, l'authentification et le stockage des fichiers sont fournis par Supabase. Le nom de domaine est géré chez Spaceship.

## Propriété intellectuelle

Le nom OHMEGATO, son logo, son identité visuelle, les textes, photographies, illustrations et éléments graphiques du site sont protégés. Toute reproduction ou utilisation commerciale sans autorisation écrite est interdite.

Les marques et logos des prestataires cités restent la propriété de leurs titulaires respectifs.

## Signaler un contenu ou un problème

Pour signaler un contenu, une erreur ou un problème de sécurité : {{email}}.

## Droit applicable

Le site et son utilisation sont soumis au droit sénégalais.$md$, date '2026-10-29'
where not exists (select 1 from public.legal_document_versions where document_slug = 'mentions-legales' and version = '1.2');
select public.admin_publish_legal_version(id, null) from public.legal_document_versions
 where document_slug = 'mentions-legales' and version = '1.2' and status = 'draft';
