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
select 'conditions-generales', '1.2', 'draft', 'Conditions générales', $md$## Présentation

OHMEGATO est une activité de pâtisserie maison actuellement en cours de formalisation à Dakar.

OHMEGATO prépare des pâtisseries maison (cookies, brownies, moelleux, muffins, cake, choux, verrines…) par cycles de production appelés « fournées ». Le site ohmegato.com permet de découvrir les produits, de passer commande, de payer les produits, de suivre ses commandes et d'envoyer des demandes sur mesure pour un événement.

Ces conditions générales s'appliquent à toute commande passée sur le site et à l'utilisation de l'espace client. Pour nous joindre : {{email}} ou WhatsApp au {{telephone}}.

## Acceptation des conditions

En validant une commande, vous acceptez les présentes conditions générales ainsi que la politique d'annulation et de remboursement, dans leur version affichée au moment de la commande. Cette version reste attachée à votre commande, même si les conditions changent plus tard.

La case d'acceptation n'est jamais cochée à l'avance. Vous pouvez ouvrir les conditions depuis le bon de commande sans perdre votre boîte ni les informations déjà saisies.

## Produits

Chaque fiche produit indique sa composition connue, ses formats, ses prix, ses informations sur les allergènes et ses conseils de conservation. Pour une commande, ce sont les informations affichées sur la fiche au moment de la commande qui s'appliquent.

Les photographies sont présentées à titre d'illustration. Nos pâtisseries sont faites à la main : la forme, la couleur ou la répartition des garnitures peuvent légèrement varier d'une fournée à l'autre, sans changer la nature du produit commandé.

## Fournées et disponibilité

La production se fait par fournées, généralement environ trois fois par semaine. Chaque ouverture de fournée est annoncée sur le site et sur nos réseaux sociaux.

Une commande standard doit normalement être passée au moins 24 heures à l'avance. Une commande n'est possible que pour les produits, quantités, stocks et créneaux réellement ouverts au moment de la commande. Le stock affiché est le stock réel restant ; nous n'affichons ni faux stock ni compte à rebours artificiel.

## Prix

Les prix sont affichés en francs CFA (FCFA). Le prix applicable est celui affiché au moment de la validation de la commande.

Le montant payé en ligne couvre uniquement les produits. Les frais de livraison ne sont jamais ajoutés au paiement sur le site : ils sont réglés séparément, directement au livreur.

## Commande

Une commande se passe en quelques étapes :

1. choisir une fournée ouverte ;
2. choisir les produits, leur format et, le cas échéant, leur parfum ;
3. les ajouter dans « Ma boîte » ;
4. choisir le retrait gratuit ou la livraison dans Dakar ;
5. saisir vos coordonnées et, pour une livraison, l'adresse et le repère sur la carte ;
6. vérifier et valider le bon de commande, en acceptant les conditions ;
7. choisir le moyen de paiement ;
8. suivre la commande grâce à son lien personnel ou depuis votre espace client.

Une commande enregistrée ou en attente de vérification du paiement n'est pas encore une commande payée. Elle n'est considérée comme payée qu'après vérification du paiement par OHMEGATO.

## Paiement par Wave ou Orange Money

Le paiement se fait par lien marchand : Wave, et Orange Money lorsqu'il est proposé sur le bon de commande :

- vous utilisez le lien du moyen choisi, affiché sur votre suivi de commande, pour le montant indiqué ;
- votre commande est enregistrée dès que vous choisissez le moyen de paiement ;
- OHMEGATO vérifie ensuite manuellement la réception du paiement : ouvrir le lien ne vaut pas paiement ;
- si le paiement est retrouvé, la commande est marquée « Payée » ;
- si le paiement n'est pas reçu ou ne peut pas être identifié, la commande peut être annulée, et les produits réservés sont remis à disposition.

Si vous avez payé mais que votre commande a été annulée faute de paiement identifié, contactez-nous avec la preuve de votre transaction : après vérification, nous rétablissons la commande ou nous vous remboursons.

Wave et Orange Money sont des prestataires de paiement indépendants. OHMEGATO n'est ni opéré, ni garanti, ni approuvé par eux. Nous ne vous demanderons jamais votre code secret ni vos identifiants Wave ou Orange Money.

Un moyen de paiement n'est proposé que lorsqu'il est affiché sur le bon de commande.

## Retrait

Le retrait est gratuit, au {{adresse_retrait}}.

Merci de respecter le créneau confirmé pour votre commande. La commande est remise sur présentation de sa référence ; une vérification raisonnable de l'identité de la personne qui la récupère peut être demandée.

## Livraison

La livraison est possible dans Dakar, selon la disponibilité des livreurs. Pour une livraison, vous indiquez votre quartier, votre adresse, un point de repère et l'emplacement exact sur la carte.

Le tarif de livraison dépend de la zone de votre quartier. Lorsque la zone est connue, le bon de commande l'affiche avec son tarif ; sinon, le tarif est confirmé selon votre position. Il n'est jamais ajouté au paiement en ligne : vous le réglez directement au livreur. Le tarif affiché au moment de la commande est celui enregistré avec elle. Le montant payé à OHMEGATO concerne uniquement les produits.

Le détail du fonctionnement figure sur la page « Livraison et retrait ».

## Commandes sur mesure et événements

Les demandes particulières (anniversaires, mariages, événements…) doivent généralement nous parvenir 2 à 4 jours à l'avance, selon les quantités et la complexité.

Une demande envoyée par le formulaire sur mesure n'est pas une commande confirmée. OHMEGATO prépare d'abord une proposition qui précise les produits, les quantités, la personnalisation, le prix et les modalités. La commande sur mesure n'est confirmée qu'après votre accord sur cette proposition et la vérification du paiement.

Certaines personnalisations peuvent être refusées selon le délai, notre capacité de production ou les ingrédients disponibles. Une modification demandée après le début de la préparation peut être refusée.

## Vos engagements

En commandant, vous vous engagez à :

- fournir des informations exactes ;
- rester joignable au numéro indiqué ;
- vérifier les produits et quantités de votre bon avant de le valider ;
- signaler toute allergie avant de commander ;
- indiquer une adresse et un repère exploitables pour une livraison ;
- respecter les créneaux convenus ;
- ne pas utiliser le site de manière frauduleuse.

## Allergies

Les informations sur les allergènes figurent sur chaque fiche produit et sur la page « Allergènes et conservation ». Elles ne remplacent pas un avis médical.

Une information marquée « à vérifier » n'est pas une certitude et n'est jamais présentée comme telle. Nos produits sont préparés dans un environnement artisanal : OHMEGATO ne garantit pas l'absence totale de traces. En cas d'allergie sévère, contactez-nous avant de commander afin de vérifier si la commande peut être acceptée en toute sécurité.

## Espace client

L'espace client fonctionne sans mot de passe : vous vous connectez avec un code temporaire envoyé à votre adresse e-mail. Vous êtes responsable de l'accès à cette adresse e-mail.

Votre espace regroupe l'historique de vos commandes, vos adresses enregistrées, vos préférés et vos préférences. Vous pouvez y exporter vos données et supprimer votre compte.

Il est interdit d'utiliser le compte d'une autre personne. En cas de fraude ou d'abus manifeste, OHMEGATO peut suspendre un compte.

## Responsabilité

OHMEGATO est responsable des produits qu'elle prépare et de leur conformité à votre commande. Rien dans ces conditions ne supprime les droits que la loi vous reconnaît.

Le service de livraison est réglé directement au livreur ; les éventuelles difficultés liées à la livraison sont traitées avec vous au cas par cas, dans un esprit de bonne foi.

OHMEGATO ne peut être tenue responsable d'un retard ou d'une impossibilité causés par un événement indépendant de sa volonté et raisonnablement imprévisible (coupure d'électricité prolongée, intempéries, troubles graves…). Dans ce cas, nous vous prévenons dès que possible et cherchons avec vous une solution : report, modification ou remboursement des produits payés.

En cas de problème, nous privilégions toujours une solution à l'amiable.

## Propriété intellectuelle

Le nom OHMEGATO, son logo, son identité visuelle, les textes, photographies, illustrations et éléments graphiques du site sont protégés. Toute reproduction ou utilisation commerciale sans autorisation écrite est interdite.

Les marques et logos des prestataires cités sur le site restent la propriété de leurs titulaires respectifs.

## Droit applicable et litiges

Ces conditions sont soumises au droit sénégalais, notamment aux règles applicables aux transactions électroniques et à la protection des données personnelles.

En cas de difficulté, contactez-nous d'abord par e-mail à {{email}} ou par WhatsApp au {{telephone}} : nous recherchons une solution amiable. À défaut d'accord, le litige peut être porté devant les juridictions compétentes selon les règles applicables au Sénégal. Ces démarches ne vous privent d'aucun droit reconnu par la loi.$md$, date '2026-10-29'
where not exists (select 1 from public.legal_document_versions where document_slug = 'conditions-generales' and version = '1.2');
select public.admin_publish_legal_version(id, null) from public.legal_document_versions
 where document_slug = 'conditions-generales' and version = '1.2' and status = 'draft';

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

insert into public.legal_document_versions (document_slug, version, status, title, content, effective_at)
select 'livraison-retrait', '1.2', 'draft', 'Livraison et retrait', $md$## Livraison dans Dakar

Nous livrons dans Dakar, selon la disponibilité des livreurs. Pour être sûr d'être servi, commandez idéalement au moins 24 heures à l'avance.

La livraison est généralement organisée le matin, selon la fournée et le créneau confirmé pour votre commande.

## Ce que nous vous demandons

Pour que le livreur vous trouve facilement, le bon de commande vous demande :

- votre quartier ;
- votre adresse (rue, villa, immeuble…) ;
- un point de repère connu (pharmacie, mosquée, boutique…) ;
- l'emplacement exact sur la carte ;
- le nom et le numéro de la personne qui réceptionne.

Vous pouvez taper votre adresse et chercher votre quartier, puis toucher la carte à l'endroit exact. Le bouton « Utiliser ma position » est facultatif : votre position n'est demandée que si vous appuyez dessus, et vous pouvez refuser et placer le repère vous-même.

## Le tarif de livraison

Le tarif de livraison dépend de votre quartier : chaque quartier appartient à une zone de livraison. Lorsque la zone est connue, le bon de commande affiche la zone et son tarif dès que vous choisissez votre quartier. Si votre quartier ne figure pas dans la liste, le tarif est confirmé selon votre position.

Le tarif affiché au moment de votre commande est celui qui est enregistré avec elle. Il n'est pas payé sur le site : vous le réglez directement au livreur.

> Votre paiement en ligne couvre uniquement les produits. Les frais de livraison sont réglés séparément au livreur.

## Retrait gratuit

Le retrait est gratuit, au {{adresse_retrait}}.

Vous choisissez votre créneau de retrait dans le bon de commande. Les instructions s'affichent sur votre suivi de commande une fois la commande confirmée. Présentez la référence de votre commande au moment du retrait.

## Une question ?

Écrivez-nous à {{email}} ou sur WhatsApp au {{telephone}}.$md$, date '2026-10-29'
where not exists (select 1 from public.legal_document_versions where document_slug = 'livraison-retrait' and version = '1.2');
select public.admin_publish_legal_version(id, null) from public.legal_document_versions
 where document_slug = 'livraison-retrait' and version = '1.2' and status = 'draft';
