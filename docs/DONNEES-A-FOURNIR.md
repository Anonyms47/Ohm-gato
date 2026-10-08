# Données qu'Alima doit encore transmettre

Tant qu'une donnée manque, la fonction concernée est masquée ou bloquée proprement. Aucune note « à confirmer » n'est montrée aux clients.

## Indispensables avant la mise en ligne

| Donnée | Effet tant qu'elle manque |
|---|---|
| Identifiants marchands **Wave** (clé API Checkout + secret de webhook) | Bouton Wave désactivé : « Paiement temporairement indisponible » |
| Contrat et documentation API **Orange Money** (identifiants, code marchand, format des notifications) | Bouton Orange Money désactivé |
| **Zones de livraison** : liste des quartiers par zone et tarif de chaque zone | Aucune livraison payable (les données actuelles sont fictives et marquées TEST) |
| **Créneaux** de livraison et de retrait par fournée, avec capacité | Pas de créneau proposé |
| **Photos détourées** des 8 produits (PNG/WebP transparents, ≥ 1600 px) + une photo de mise en scène par produit | Composition typographique à la place de la photo |
| **Logo officiel** en vecteur (SVG) | Nom « OHMEGATO » en texte simple |
| **Allergènes confirmés** recette par recette (gluten, œufs, lait, soja, fruits à coque, chocolat) | Seul le message « Une allergie ? Écrivez-nous » est affiché |
| **Informations juridiques** (raison sociale, NINEA, mentions légales, conditions de vente, politique de remboursement) | Pages légales non publiées |

## Pour compléter l'expérience

| Donnée | Utilisation |
|---|---|
| Conservation du **cake à l'orange**, des **choux** et des **verrines** | Section « Conservation » de ces fiches (masquée aujourd'hui) |
| Nombre de **tranches dans une barre entière** de cake à l'orange | Calcul du stock (10 provisoire, non affiché) |
| **Note d'Alima** pour l'accueil | Acte 3 « Pause humaine » (masqué sans texte) |
| **Citation finale** et éventuel **audio** d'Alima | Page Notre Histoire |
| **Photos personnelles et archives** (premiers muffins, événement à l'ESP…) | Page Notre Histoire |
| **E-mail officiel** et **horaires de contact** | Pied de page et reçus |
| Polices exclusives **OhmegatoDisplay** et **OhmegatoScript** (WOFF2) | Remplacent les polices temporaires (voir docs/INTEGRATIONS.md) |
| Code couleur exact du **rose du logo** | Ajustement du token `--ohm-rose` |
| Témoignages réels (avec accord écrit des clients) | Aucun avis n'est affiché sans cela |
