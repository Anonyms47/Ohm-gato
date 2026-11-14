-- OHMEGATO — publication des documents légaux en version 1.3 (14 novembre 2026).
-- Généré par scripts/build-legal-seed.mjs. À exécuter une fois en production (SQL Editor) après les migrations ;
-- équivalent à « Publier » dans l'atelier (Documents et règles). Rejouable : sans effet si la 1.3 existe déjà.
-- Commandes permanentes : conditions générales et livraison/retrait.

insert into public.legal_document_versions (document_slug, version, status, title, content, effective_at)
select 'conditions-generales', '1.3', 'draft', 'Conditions générales', $md$## Présentation

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

La production se fait par fournées. Vous pouvez commander à toute heure : chaque commande est rattachée à la prochaine fournée désignée par l'atelier, avec les dates de production, de livraison et de retrait affichées au moment de la commande. Vous ne proposez pas de date : celles de la fournée s'appliquent.

Les dates et le créneau affichés lors de la validation sont conservés pour votre commande. Une modification ultérieure du calendrier de l'atelier ne change pas une commande déjà enregistrée, et aucune commande n'est reportée d'une fournée à l'autre sans votre accord. Une nouvelle fournée ne reçoit que les nouvelles commandes.

Tant que l'atelier n'a pas annoncé de date de livraison ou de retrait à venir, vous pouvez composer votre boîte, mais vous ne pouvez ni valider la commande ni payer. Chaque annonce de fournée est publiée sur le site et sur nos réseaux sociaux.

La production suit les commandes : les commandes d'une fournée ne sont pas limitées par un stock affiché. Pour le surplus (douceurs restantes que l'atelier choisit de proposer après la production), seule la quantité réellement restante est commandable. Nous n'affichons ni faux stock ni compte à rebours artificiel.

## Prix

Les prix sont affichés en francs CFA (FCFA). Le prix applicable est celui affiché au moment de la validation de la commande.

Le montant payé en ligne couvre uniquement les produits. Les frais de livraison ne sont jamais ajoutés au paiement sur le site : ils sont réglés séparément, directement au livreur.

## Commande

Une commande se passe en quelques étapes :

1. consulter la prochaine fournée annoncée et ses dates ;
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

En cas de difficulté, contactez-nous d'abord par e-mail à {{email}} ou par WhatsApp au {{telephone}} : nous recherchons une solution amiable. À défaut d'accord, le litige peut être porté devant les juridictions compétentes selon les règles applicables au Sénégal. Ces démarches ne vous privent d'aucun droit reconnu par la loi.$md$, date '2026-11-14'
where not exists (select 1 from public.legal_document_versions where document_slug = 'conditions-generales' and version = '1.3');
select public.admin_publish_legal_version(id, null) from public.legal_document_versions
 where document_slug = 'conditions-generales' and version = '1.3' and status = 'draft';

insert into public.legal_document_versions (document_slug, version, status, title, content, effective_at)
select 'livraison-retrait', '1.3', 'draft', 'Livraison et retrait', $md$## Livraison dans Dakar

Nous livrons dans Dakar, selon la disponibilité des livreurs. La date et le créneau de livraison ou de retrait sont ceux de la fournée, affichés lors de la validation de votre commande.

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

Écrivez-nous à {{email}} ou sur WhatsApp au {{telephone}}.$md$, date '2026-11-14'
where not exists (select 1 from public.legal_document_versions where document_slug = 'livraison-retrait' and version = '1.3');
select public.admin_publish_legal_version(id, null) from public.legal_document_versions
 where document_slug = 'livraison-retrait' and version = '1.3' and status = 'draft';
