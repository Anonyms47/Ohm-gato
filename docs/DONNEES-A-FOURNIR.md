# Données qu'Alima doit encore transmettre

Tant qu'une donnée manque, la fonction concernée est masquée ou bloquée proprement. Aucune note « à confirmer » n'est montrée aux clients.

## Indispensables avant la mise en ligne

| Donnée | Effet tant qu'elle manque |
|---|---|
| Identifiants marchands **Wave** (clé API Checkout + secret de webhook) | Le lien marchand Wave fonctionne déjà, avec vérification manuelle par Alima ; l'API rendrait la confirmation automatique |
| Contrat et documentation API **Orange Money** (identifiants, code marchand, format des notifications) | Bouton Orange Money désactivé |
| **Créneaux** de livraison et de retrait par fournée, avec capacité | Pas de créneau proposé |
| **Validation des allergènes** dans /admin → Produits : gluten, œufs, lait (déduits des recettes, à confirmer) ; soja, arachides, fruits à coque, sésame (« à vérifier » sur les emballages et dans l'atelier) | Les allergènes déduits des recettes sont affichés ; les « à vérifier » ne le sont jamais ; aucune trace n'est mentionnée |
| **Délai de remboursement** et **durées de conservation des données** (à valider) | Non affichés sur les pages légales tant qu'ils ne sont pas saisis dans /admin → Documents et règles |
| **Compte WhatsApp Business (Cloud API)** : jeton, identifiant du numéro, modèle « authentification » approuvé | Connexion par téléphone impossible en production (l'e-mail reste possible) |
| **SMTP** pour les e-mails de connexion (adresse d'expéditeur) | Codes par e-mail limités par Supabase |
| **Logos officiels Wave et Orange Money** (kits marchands) | Boutons de paiement aux couleurs officielles, sans logo |

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

- OHMEGATO est présentée comme « une activité de pâtisserie maison exploitée par Alima à Dakar, actuellement en cours de formalisation ». Le site n'affiche ni raison sociale, ni NINEA, ni RCCM.
- **Identité légale à compléter dès la formalisation** (privée, dans /admin → Documents et règles) : nom civil complet de l'exploitante, NINEA, RCCM, adresse administrative. Les mentions légales seront ensuite mises à jour par une nouvelle version, après validation.
- E-mail officiel : contact@ohmegato.com. Le bon de fournée ne demande pas d'adresse e-mail.
- Les textes légaux v1.0 sont une version de lancement : une relecture par un professionnel du droit sénégalais est recommandée (voir le rapport de publication).
- **À vérifier avant de demander les accès API** : l'ouverture d'un compte marchand Wave Business avec API de paiement en ligne et d'un compte Orange Money marchand peut exiger des documents d'entreprise (NINEA, registre de commerce). À confirmer auprès de Wave et d'Orange Money ; sans ces accès, le paiement en ligne reste bloqué et les commandes se finalisent sur WhatsApp.
