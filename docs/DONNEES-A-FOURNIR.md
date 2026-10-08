# Données qu'Alima doit encore transmettre

Tant qu'une donnée manque, la fonction concernée est masquée ou bloquée proprement. Aucune note « à confirmer » n'est montrée aux clients.

## Indispensables avant la mise en ligne

| Donnée | Effet tant qu'elle manque |
|---|---|
| Identifiants marchands **Wave** (clé API Checkout + secret de webhook) | Bouton Wave désactivé : « Paiement temporairement indisponible » |
| Contrat et documentation API **Orange Money** (identifiants, code marchand, format des notifications) | Bouton Orange Money désactivé |
| **Zones de livraison** : liste des quartiers par zone et tarif de chaque zone | Aucune livraison payable (les données actuelles sont fictives et marquées TEST) |
| **Créneaux** de livraison et de retrait par fournée, avec capacité | Pas de créneau proposé |
| **Allergènes confirmés** recette par recette (gluten, œufs, lait, soja, fruits à coque, chocolat) | Seul le message « Une allergie ? Écrivez-nous » est affiché |
| **Conditions de vente et politique de remboursement** (rédigées avec Alima) | Pas de page de conditions ; à publier avant la mise en ligne |

## Pour compléter l'expérience

| Donnée | Utilisation |
|---|---|
| **Photos de mise en scène** (cookie cassé en gros plan, coupe du moelleux, pyramide de choux…) en plus des visuels détourés | Fiches produits plus riches |
| Conservation du **cake à l'orange**, des **choux** et des **verrines** | Section « Conservation » de ces fiches (masquée aujourd'hui) |
| Nombre de **tranches dans une barre entière** de cake à l'orange | Calcul du stock (10 provisoire, non affiché) |
| **Note d'Alima** pour l'accueil | Acte 3 « Pause humaine » (masqué sans texte) |
| **Citation finale** et éventuel **audio** d'Alima | Page Notre Histoire |
| **Photos personnelles et archives** (premiers muffins, événement à l'ESP…) | Page Notre Histoire |
| **Horaires de contact** | Pied de page et page de suivi |
| Polices exclusives **OhmegatoDisplay** et **OhmegatoScript** (WOFF2) | Remplacent les polices temporaires (voir docs/INTEGRATIONS.md) |
| Témoignages réels (avec accord écrit des clients) | Aucun avis n'est affiché sans cela |

## Visuels et identité

- Les 8 visuels produits sont de vraies photos des pâtisseries OHMEGATO (confirmé par la marque). Ils ont été détourés depuis les affiches, sans retouche, dans `public/products/`.
- Le logo a été vectorisé depuis le médaillon fourni (`public/brand/logo-ohmegato.svg`), avec ses couleurs d'origine.

## Situation administrative

- OHMEGATO n'est pas encore immatriculée (pas de NINEA ni de RCCM) : le site n'affiche donc ni raison sociale ni numéro d'identification.
- Pas d'e-mail officiel : le contact passe par WhatsApp et le téléphone, et le bon de fournée ne demande plus d'adresse e-mail (aucun e-mail n'est envoyé).
- **À vérifier avant de demander les accès API** : l'ouverture d'un compte marchand Wave Business avec API de paiement en ligne et d'un compte Orange Money marchand peut exiger des documents d'entreprise (NINEA, registre de commerce). À confirmer auprès de Wave et d'Orange Money ; sans ces accès, le paiement en ligne reste bloqué et les commandes se finalisent sur WhatsApp.
