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
| **Informations juridiques** (raison sociale, NINEA, mentions légales, conditions de vente, politique de remboursement) | Pages légales non publiées |

## Pour compléter l'expérience

| Donnée | Utilisation |
|---|---|
| **Logo en vecteur (SVG)** | Le logo actuel est le médaillon PNG fourni, détouré ; un SVG restera net à toutes les tailles |
| **Photos de mise en scène** (cookie cassé en gros plan, coupe du moelleux, pyramide de choux…) en plus des visuels détourés | Fiches produits plus riches |
| **Confirmation que les visuels représentent les vraies recettes** (voir ci-dessous) | Conformité de la carte |
| Conservation du **cake à l'orange**, des **choux** et des **verrines** | Section « Conservation » de ces fiches (masquée aujourd'hui) |
| Nombre de **tranches dans une barre entière** de cake à l'orange | Calcul du stock (10 provisoire, non affiché) |
| **Note d'Alima** pour l'accueil | Acte 3 « Pause humaine » (masqué sans texte) |
| **Citation finale** et éventuel **audio** d'Alima | Page Notre Histoire |
| **Photos personnelles et archives** (premiers muffins, événement à l'ESP…) | Page Notre Histoire |
| **E-mail officiel** et **horaires de contact** | Pied de page et reçus |
| Polices exclusives **OhmegatoDisplay** et **OhmegatoScript** (WOFF2) | Remplacent les polices temporaires (voir docs/INTEGRATIONS.md) |
| Témoignages réels (avec accord écrit des clients) | Aucun avis n'est affiché sans cela |

## Visuels reçus

Les 8 affiches produits et le logo ont été intégrés : chaque produit a été détouré automatiquement depuis son affiche (fond crème uni retiré, produit non retouché) et rangé dans `public/products/`. L'affiche des choux a été reçue en double.

Certains visuels ont l'aspect d'images de synthèse (notamment le moelleux au chocolat et les choux nappés). Le site ne doit pas présenter une image générée comme une photo du vrai produit : si c'est le cas, il faudra les remplacer par des photos réelles des pâtisseries OHMEGATO.
