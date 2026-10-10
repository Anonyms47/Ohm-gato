-- OHMEGATO — documents légaux publiés (en vigueur le 10 octobre 2026).
-- Généré par scripts/build-legal-seed.mjs depuis content/legal/*.md. Valable en production (rejouable sans doublon).

insert into public.legal_documents (slug, title, description, sort_order) values
  ('conditions-generales', 'Conditions générales', 'Conditions générales de vente et d''utilisation du site OHMEGATO : commandes, fournées, prix, paiement Wave, retrait, livraison, sur-mesure, espace client.', 10),
  ('livraison-retrait', 'Livraison et retrait', 'Livraison dans Dakar et retrait gratuit à Sud Foire : informations demandées, tarif de livraison réglé au livreur, créneaux.', 20),
  ('annulation-remboursement', 'Annulation et remboursement', 'Annuler ou modifier une commande, signaler un problème et obtenir un remplacement ou un remboursement chez OHMEGATO.', 30),
  ('confidentialite', 'Confidentialité', 'Données personnelles collectées par OHMEGATO, finalités, prestataires, durées de conservation, droits et sécurité.', 40),
  ('cookies', 'Cookies', 'Cookies et stockage local utilisés par le site OHMEGATO : uniquement ce qui est nécessaire, sans statistiques ni publicité.', 50),
  ('mentions-legales', 'Mentions légales', 'Éditeur du site OHMEGATO, hébergement, propriété intellectuelle et droit applicable.', 60),
  ('allergenes-conservation', 'Allergènes et conservation', 'Allergènes, informations de recette et conseils de conservation de chaque pâtisserie OHMEGATO.', 70)
on conflict (slug) do nothing;

insert into public.legal_document_versions (document_slug, version, status, title, content, effective_at, published_at)
select 'conditions-generales', '1.0', 'published', 'Conditions générales', $md$## Présentation

OHMEGATO est une activité de pâtisserie maison exploitée par Alima à Dakar, actuellement en cours de formalisation.

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

## Paiement par Wave

Le paiement se fait aujourd'hui par le lien marchand Wave d'OHMEGATO :

- vous utilisez le lien Wave affiché sur votre suivi de commande, pour le montant indiqué ;
- votre commande est enregistrée dès que vous choisissez Wave ;
- Alima vérifie ensuite manuellement la réception du paiement ;
- si le paiement est retrouvé, la commande est marquée « Payée » ;
- si le paiement n'est pas reçu ou ne peut pas être identifié, la commande peut être annulée, et les produits réservés sont remis à disposition.

Si vous avez payé mais que votre commande a été annulée faute de paiement identifié, contactez-nous avec la preuve de votre transaction : après vérification, nous rétablissons la commande ou nous vous remboursons.

Wave est un prestataire de paiement indépendant. OHMEGATO n'est ni opéré, ni garanti, ni approuvé par Wave. Nous ne vous demanderons jamais votre code secret ni vos identifiants Wave.

Le paiement Orange Money n'est pas encore disponible.

## Retrait

Le retrait est gratuit, au {{adresse_retrait}}.

Merci de respecter le créneau confirmé pour votre commande. La commande est remise sur présentation de sa référence ; une vérification raisonnable de l'identité de la personne qui la récupère peut être demandée.

## Livraison

La livraison est possible dans Dakar, selon la disponibilité des livreurs. Pour une livraison, vous indiquez votre quartier, votre adresse, un point de repère et l'emplacement exact sur la carte.

Le tarif de livraison dépend de la destination. Il n'est ni calculé ni payé sur le site : il vous est communiqué après la commande ou au moment de l'organisation de la livraison, et vous le réglez directement au livreur. Le montant payé à OHMEGATO concerne uniquement les produits.

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

En cas de difficulté, contactez-nous d'abord par e-mail à {{email}} ou par WhatsApp au {{telephone}} : nous recherchons une solution amiable. À défaut d'accord, le litige peut être porté devant les juridictions compétentes selon les règles applicables au Sénégal. Ces démarches ne vous privent d'aucun droit reconnu par la loi.$md$, date '2026-10-10', timestamptz '2026-10-10 08:00:00+00'
where not exists (select 1 from public.legal_document_versions where document_slug = 'conditions-generales');

insert into public.legal_document_versions (document_slug, version, status, title, content, effective_at, published_at)
select 'livraison-retrait', '1.0', 'published', 'Livraison et retrait', $md$## Livraison dans Dakar

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

Le tarif de livraison dépend de la destination. Il n'est ni calculé ni payé sur le site.

Il vous est communiqué après la commande ou au moment de l'organisation de la livraison, et vous le réglez directement au livreur.

> Votre paiement en ligne couvre uniquement les produits. Les frais de livraison sont réglés séparément au livreur.

## Retrait gratuit

Le retrait est gratuit, au {{adresse_retrait}}.

Vous choisissez votre créneau de retrait dans le bon de commande. Les instructions s'affichent sur votre suivi de commande une fois la commande confirmée. Présentez la référence de votre commande au moment du retrait.

## Une question ?

Écrivez-nous à {{email}} ou sur WhatsApp au {{telephone}}.$md$, date '2026-10-10', timestamptz '2026-10-10 08:00:00+00'
where not exists (select 1 from public.legal_document_versions where document_slug = 'livraison-retrait');

insert into public.legal_document_versions (document_slug, version, status, title, content, effective_at, published_at)
select 'annulation-remboursement', '1.0', 'published', 'Annulation et remboursement', $md$## Notre principe

Nos pâtisseries sont fraîches, périssables et le plus souvent préparées pour votre commande. Cette politique cherche un équilibre juste : vous permettre de changer d'avis tant que c'est possible, et toujours corriger nos erreurs.

## Avant le début de la préparation

Vous pouvez demander une modification ou une annulation par e-mail à {{email}} ou par WhatsApp au {{telephone}}, en indiquant la référence de votre commande.

La demande n'est effective qu'après confirmation d'OHMEGATO. Si la préparation n'a pas commencé et que votre paiement avait été vérifié, nous pouvons vous rembourser intégralement les produits.

## Après le début de la préparation

Une fois la préparation commencée, une annulation pour simple changement d'avis peut être refusée, car les produits frais ne peuvent pas être revendus. Une commande personnalisée ne peut plus être modifiée lorsque sa réalisation a commencé.

Cela ne retire aucun de vos droits en cas d'erreur, de produit non conforme ou de problème qui nous est imputable.

## Annulation par OHMEGATO

Nous vous remboursons intégralement les produits payés si nous annulons votre commande en raison :

- d'une indisponibilité réelle ;
- d'un problème de production ;
- d'une impossibilité d'honorer la commande ;
- d'un paiement que nous n'avions pas pu identifier, lorsque vous nous fournissez ensuite une preuve valable, après vérification.

## Signaler un problème

Contactez-nous dès la réception de votre commande, ou dès que vous découvrez le problème, si vous constatez :

- un produit incorrect ;
- une quantité manquante ;
- un produit abîmé ;
- un problème manifeste de qualité ;
- une erreur de personnalisation.

Indiquez-nous la référence de la commande, une explication claire et, si possible, des photos. Aucun délai trop court ne vous fera perdre vos droits : plus vous nous prévenez tôt, plus il est simple de vérifier et de trouver une solution.

## Les solutions possibles

Selon le problème constaté, et en accord avec vous :

- le remplacement du produit ;
- un complément de commande ;
- un avoir, si vous l'acceptez ;
- un remboursement partiel ;
- un remboursement total.

## Comment se passe un remboursement

Les remboursements ne sont pas automatiques : ils sont traités manuellement par OHMEGATO après validation. Le moyen de remboursement et le délai vous sont communiqués au moment où le remboursement est accepté.

Chaque remboursement est enregistré : date, montant, raison, moyen utilisé et personne de l'équipe qui l'a validé.$md$, date '2026-10-10', timestamptz '2026-10-10 08:00:00+00'
where not exists (select 1 from public.legal_document_versions where document_slug = 'annulation-remboursement');

insert into public.legal_document_versions (document_slug, version, status, title, content, effective_at, published_at)
select 'confidentialite', '1.0', 'published', 'Confidentialité', $md$## Qui traite vos données

Le responsable du traitement est OHMEGATO, activité de pâtisserie maison exploitée par Alima à Dakar, actuellement en cours de formalisation.

Pour toute question ou demande sur vos données personnelles : {{email}}.

Cette politique est rédigée en tenant compte de la législation sénégalaise sur la protection des données à caractère personnel et sur les transactions électroniques.

## Les données que nous collectons

Selon ce que vous faites sur le site, nous pouvons collecter :

- votre nom ;
- votre adresse e-mail ;
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

Nous n'enregistrons jamais votre code secret, votre code PIN ni vos identifiants Wave.

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
- vous envoyer des communications commerciales, uniquement si vous y avez consenti.

## Votre position

Votre position n'est demandée que si vous appuyez sur « Utiliser ma position ». Elle sert uniquement à placer le repère de livraison sur la carte.

Vous pouvez refuser et placer le repère vous-même en touchant la carte. Nous ne suivons jamais votre position en continu : seul l'emplacement du repère validé avec votre commande est enregistré.

## Qui peut y accéder

Vos données ne sont accessibles qu'à OHMEGATO et, dans la limite nécessaire, aux prestataires techniques indispensables au fonctionnement du site :

- Supabase : base de données, authentification, stockage des fichiers et fonctions du serveur ;
- Vercel : hébergement et déploiement du site ;
- Brevo : envoi des codes de connexion et des e-mails liés à vos commandes ;
- Spacemail : messagerie professionnelle d'OHMEGATO ;
- OpenStreetMap : affichage de la carte et recherche de quartiers ;
- Wave : paiement par lien marchand, selon les conditions de Wave ;
- le livreur, uniquement pour les informations nécessaires à la livraison (nom et numéro du destinataire, adresse, repère, position).

Le livreur n'a jamais accès à l'historique de votre compte ni à d'autres données.

## Combien de temps nous les gardons

- vos données de commande sont conservées le temps nécessaire à la préparation, à la livraison et au suivi de la commande ;
- les informations nécessaires sont ensuite conservées pendant les durées imposées par les obligations administratives, comptables ou légales applicables ;
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

La date et la version de cette politique sont indiquées en haut de la page. En cas de changement important, nous vous en informons lorsque c'est raisonnablement possible.$md$, date '2026-10-10', timestamptz '2026-10-10 08:00:00+00'
where not exists (select 1 from public.legal_document_versions where document_slug = 'confidentialite');

insert into public.legal_document_versions (document_slug, version, status, title, content, effective_at, published_at)
select 'cookies', '1.0', 'published', 'Cookies', $md$## En bref

Le site OHMEGATO n'utilise aucun outil de statistiques ni de publicité. Il n'utilise que des cookies et un stockage local strictement nécessaires au fonctionnement que vous demandez : votre connexion, la sécurité, votre boîte et vos brouillons.

C'est pourquoi aucune bannière de consentement ne vous est présentée.

## Les cookies

- **Session de connexion** (cookies Supabase dont le nom commence par « sb- ») : ils gardent votre session ouverte lorsque vous êtes connecté à votre espace client. Ils disparaissent à la déconnexion.
- **ohm_commandes** : retient, sur le navigateur qui a passé une commande, les références de ses commandes, pour afficher vos informations personnelles sur la page de suivi. Signé et illisible par les scripts de la page ; conservé 60 jours.
- **ohm_demandes** : même rôle pour vos demandes sur mesure ; conservé 60 jours.

## Le stockage dans votre navigateur

Ces informations restent sur votre appareil ; elles ne sont pas envoyées à des tiers.

- **Votre boîte** (ohmegato.boite.v1) : les produits ajoutés à « Ma boîte ».
- **Brouillon du bon de commande** (ohmegato.bon.v1) et **brouillon de demande sur mesure** (ohmegato.sur-mesure.v1) : pour ne pas perdre ce que vous avez déjà saisi.
- **Commandes récentes** (ohmegato.commandes.v1) : un raccourci vers vos commandes des 7 derniers jours sur cet appareil.
- Pendant votre visite seulement (stockage de session) : quelques repères d'affichage, par exemple pour ne pas rejouer une animation déjà vue.

## La carte

La carte de livraison charge ses images depuis les serveurs d'OpenStreetMap. Comme pour tout site, ces serveurs reçoivent l'adresse technique de votre appareil pour vous envoyer les images. Le site ne dépose aucun cookie de suivi pour cela.

## Gérer ces éléments

Vous pouvez supprimer cookies et stockage depuis les réglages de votre navigateur. Vous serez alors déconnecté et votre boîte sera vidée.

Si un outil de mesure d'audience ou de publicité était un jour ajouté, il ne serait activé qu'après votre accord, avec un choix « Tout accepter », « Tout refuser » ou « Personnaliser », modifiable à tout moment.$md$, date '2026-10-10', timestamptz '2026-10-10 08:00:00+00'
where not exists (select 1 from public.legal_document_versions where document_slug = 'cookies');

insert into public.legal_document_versions (document_slug, version, status, title, content, effective_at, published_at)
select 'mentions-legales', '1.0', 'published', 'Mentions légales', $md$## Éditeur du site

OHMEGATO est une activité de pâtisserie maison exploitée par Alima à Dakar, actuellement en cours de formalisation.

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

Le site et son utilisation sont soumis au droit sénégalais.$md$, date '2026-10-10', timestamptz '2026-10-10 08:00:00+00'
where not exists (select 1 from public.legal_document_versions where document_slug = 'mentions-legales');

insert into public.legal_document_versions (document_slug, version, status, title, content, effective_at, published_at)
select 'allergenes-conservation', '1.1', 'published', 'Allergènes et conservation', $md$## Comment lire nos informations

Pour chaque produit, nous séparons trois informations :

- **les allergènes** : ce que la recette contient (« contient »), les traces possibles lorsqu'elles sont confirmées, et ce qui est préparé sans ajout direct ;
- **les informations de recette** : chocolat, fruits, cannelle… qui ne sont pas des allergènes réglementaires mais peuvent compter pour vous ;
- **la conservation** : comment garder le produit après l'avoir reçu.

Une mention « sans ajout direct » ne signifie pas « sans allergène » : par exemple, un produit préparé sans ajout direct de lait peut contenir du lait ou des traces de lait provenant d'autres ingrédients, comme le chocolat. Les informations encore à vérifier ne sont pas affichées comme des certitudes.

Les descriptions, les informations de recette et les conseils de conservation de chaque produit ont été confirmés par Alima, fondatrice d'OHMEGATO. Les traces liées aux emballages des ingrédients (soja, arachides, fruits à coque, sésame…) restent en cours de vérification et ne sont pas affichées tant qu'elles ne sont pas contrôlées.

> Les produits sont préparés dans un environnement artisanal. En cas d'allergie sévère, contactez OHMEGATO avant de commander afin que la faisabilité de votre commande puisse être vérifiée.

## Conserver vos pâtisseries

- **Avec une sauce, une crème ou des fruits sensibles** (moelleux au chocolat, moelleux aux pommes, verrines, choux à la crème) : au réfrigérateur, 2 jours maximum.
- **Sans sauce, sans crème sensible et sans fruits** (muffins, brownies, cookies) : à température ambiante, dans une boîte ou un emballage hermétique, 2 jours maximum.
- **Cake à l'orange** : jusqu'à 7 jours, correctement emballé et conservé dans un endroit frais.
- **Par forte chaleur à Dakar**, la réfrigération est recommandée lorsque c'est pertinent, notamment pour le cake à l'orange.

Respectez la chaîne du froid pour les produits contenant de la crème, une sauce ou des fruits. Ne consommez pas un produit présentant une odeur, une texture ou un aspect anormal.

Les durées indiquées concernent un produit correctement transporté et conservé après sa réception.$md$, date '2026-10-10', timestamptz '2026-10-10 14:00:00+00'
where not exists (select 1 from public.legal_document_versions where document_slug = 'allergenes-conservation');
