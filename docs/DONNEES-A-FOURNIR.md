# Données qu'Alima doit encore transmettre

Tant qu'une donnée manque, la fonction concernée est masquée ou bloquée proprement. Aucune note « à confirmer » n'est montrée aux clients.

## Indispensables avant la mise en ligne

| Donnée | Effet tant qu'elle manque |
|---|---|
| Identifiants marchands **Wave** (clé API Checkout + secret de webhook) | Bouton Wave désactivé : « Paiement temporairement indisponible » |
| Contrat et documentation API **Orange Money** (identifiants, code marchand, format des notifications) | Bouton Orange Money désactivé |
| **Créneaux** de livraison et de retrait par fournée, avec capacité | Pas de créneau proposé |
| **Allergènes confirmés** recette par recette (gluten, œufs, lait, soja, fruits à coque, chocolat) | Seul le message « Une allergie ? Écrivez-nous » est affiché |
| **Conditions de vente et politique de remboursement** (rédigées avec Alima) | Pas de page de conditions ; à publier avant la mise en ligne |

## Pour compléter l'expérience

| Donnée | Utilisation |
|---|---|
| **Photos de mise en scène** (cookie cassé en gros plan, coupe du moelleux, pyramide de choux…) en plus des visuels détourés | Fiches produits plus riches |
| Nombre de **tranches dans une barre entière** de cake à l'orange | Calcul du stock (10 provisoire, non affiché) |
| **Note d'Alima** pour l'accueil | Acte 3 « Pause humaine » (masqué sans texte) |
| **Citation finale** et éventuel **audio** d'Alima | Page Notre Histoire |
| **Photos personnelles et archives** (premiers muffins, événement à l'ESP…) | Page Notre Histoire |
| **Horaires de contact** | Pied de page et page de suivi |
| Polices exclusives **OhmegatoDisplay** et **OhmegatoScript** (WOFF2) | Remplacent les polices temporaires (voir docs/INTEGRATIONS.md) |
| Témoignages réels (avec accord écrit des clients) | Aucun avis n'est affiché sans cela |

## Règles confirmées par Alima

- **Livraison** : les frais ne sont jamais payés sur le site, ni inclus dans le total ou le chiffre d'affaires. Le client paie uniquement les produits ; le site affiche avant et après paiement « Frais de livraison non compris, à régler directement au livreur selon votre position. » Le client fournit l'adresse écrite, le quartier, un point de repère, le contact du destinataire et sa position exacte sur la carte, enregistrée avec la commande et envoyable à OHMEGATO sur WhatsApp depuis la page de suivi.
- **Retrait** : Rue GY-69, Cité Sonatel 2, Sud Foire, gratuit.
- **Conservation** (conseils de qualité, affichés sur chaque fiche et dans le suivi de commande) :
  - moelleux au chocolat (sauce déjà servie dessus), moelleux aux pommes, choux à la crème, verrines : réfrigérateur, 2 jours maximum ;
  - muffins, brownies, cookies : boîte hermétique à température ambiante, 2 jours maximum ; les cookies peuvent être légèrement réchauffés ;
  - cake à l'orange : jusqu'à une semaine, correctement emballé et gardé dans un endroit frais.

## Visuels et identité

- Les 8 visuels produits sont de vraies photos des pâtisseries OHMEGATO (confirmé par la marque). Ils ont été détourés depuis les affiches, sans retouche, dans `public/products/`.
- Le logo a été vectorisé depuis le médaillon fourni (`public/brand/logo-ohmegato.svg`), avec ses couleurs d'origine.

## Situation administrative

- OHMEGATO n'est pas encore immatriculée (pas de NINEA ni de RCCM) : le site n'affiche donc ni raison sociale ni numéro d'identification.
- Pas d'e-mail officiel : le contact passe par WhatsApp et le téléphone, et le bon de fournée ne demande plus d'adresse e-mail (aucun e-mail n'est envoyé).
- **À vérifier avant de demander les accès API** : l'ouverture d'un compte marchand Wave Business avec API de paiement en ligne et d'un compte Orange Money marchand peut exiger des documents d'entreprise (NINEA, registre de commerce). À confirmer auprès de Wave et d'Orange Money ; sans ces accès, le paiement en ligne reste bloqué et les commandes se finalisent sur WhatsApp.
