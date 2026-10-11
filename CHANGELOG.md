# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
et le projet adhère au [versionnage sémantique](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté

- Logique officielle des fournées : précommandes jusqu'à la date limite (clôture automatique, vérifiée côté serveur), production selon la demande, priorité aux commandes confirmées, saisie de la production réelle et des pertes, publication manuelle du surplus par Alima (jamais automatique), commandes tardives limitées au surplus réel (créneaux dédiés, retrait seul ou livraison selon le choix d'Alima, dernière date de vente), précommande annulée pendant le surplus gardée en stock interne. Nouvelle page Nos fournées et page de chaque fournée (/fournees/[numéro]) avec frise en quatre moments, tableau de synthèse de la demande et fiche de production imprimable dans /admin.
- Informations confirmées par Alima (vocaux du 10 octobre 2026) : descriptions des huit produits, conservation, informations de recette (pépites, cannelle, sauce chocolat, yaourt, crème pâtissière, vanille, crème, génoise, fruits) et lait lorsqu'il découle d'un ingrédient cité (yaourt, crème pâtissière, chocolat au lait) ; brownies « sans ajout direct de lait ». Provenance interne (source, validé par, méthode, date), historique des anciennes valeurs, filtre et compteur de vérification dans /admin/produits. Allergènes et conservation v1.1. Les 33 informations dépendant des emballages restent à vérifier.
- Pages légales et commerciales versionnées (v1.0 du 10 octobre 2026) : Conditions générales, Livraison et retrait, Annulation et remboursement, Confidentialité, Cookies, Mentions légales, Allergènes et conservation ; sommaire, ancres sous l'en-tête, impression propre, métadonnées et URL canoniques, sitemap et robots.
- Bon de fournée : case obligatoire non cochée « J'ai lu et j'accepte les Conditions générales ainsi que la politique d'annulation et de remboursement. », liens ouverts dans un nouvel onglet, note de confidentialité, rappel « Livraison à régler séparément au livreur ». Preuve d'acceptation enregistrée par commande (versions, empreintes, date, canal ; sans adresse IP), incluse dans l'export du compte.
- Administration « Documents et règles » : brouillon, aperçu public exact, publication d'une nouvelle version, historique, reprise d'une ancienne version, commandes par version, coordonnées publiques, délai de remboursement, durées de conservation, identité légale privée avec alerte tant qu'elle est incomplète ; remboursements enregistrés sur la fiche commande.
- Pied de page en trois groupes (Commander, OHMEGATO, Informations), accordéons accessibles sur téléphone ; page « Suivre ma commande ».
- Allergènes : statut par produit ou par parfum (contient, peut contenir des traces, sans ajout direct, à vérifier, non concerné), informations de recette séparées (chocolat, fruits, cannelle), traces d'atelier activables après confirmation, indicateur interne jamais visible des clients, aperçu exact dans /admin ; avertissement allergies sur les fiches, Ma boîte, le bon de fournée et le sur-mesure ; huit produits préremplis.
- Recherche d'un quartier ou d'un lieu dans la région de Dakar sur la carte de livraison : la carte se centre, le client touche l'endroit exact.
- Paiement par lien marchand Wave : commande confirmée au choix de Wave, montant et référence affichés au client, paiement enregistré par OHMEGATO (« Paiement Wave reçu ») ou commande annulée avec retour du stock.
- Nos fournées (journal du four), Sur-mesure & Événements (carnet conversationnel, échanges, propositions, paiement après accord), Notre histoire (Oumy Gâteau → OHMEGATO → Ω).
- Connexion sans mot de passe par code temporaire (téléphone, e-mail), espace « Mon carnet » complet (commandes, recomposition, adresses et positions, préférés, alertes, consentements, sessions, export, suppression).
- Administration d'Alima `/admin` : tableau de bord, fournées, produits, commandes, positions de livraison, stock, sur-mesure, clients, réglages, rôles, journal d'audit.
- Informations personnelles des liens de suivi réservées au navigateur d'origine ou au propriétaire connecté.
- Logo officiel en SVG et visuels détourés des huit produits ; rose de la palette aligné sur le logo.
- Application Next.js 16 de la boutique OHMEGATO : La Fournée, La Carte, fiches produits, Ma boîte, Le bon de fournée, suivi de commande.
- Schéma Supabase complet avec RLS, fonctions atomiques de commande, de stock et de paiement, catalogue réel des huit produits.
- Couche de paiement indépendante du fournisseur (test, Wave, Orange Money à finaliser) avec webhooks signés et idempotents.
- Système de listes déroulantes, boutons et champs accessibles aux couleurs de la marque.
- Tests unitaires, pgTAP et Playwright (téléphone, tablette, ordinateur) ; CI étendue.
- Structure initiale du dépôt : documentation, modèles GitHub, CI et conventions.

### Modifié

- Pages plus simples à parcourir, dans l'identité OHMEGATO : accueil avec « Votre fournée en quatre moments » et lien « Comment ça marche », produit manifeste non répété quand il est déjà la vedette ; carte sur téléphone avec raccourcis fixés sous l'en-tête (le produit visible est mis en évidence) à la place du bouton flottant qui couvrait le texte ; fiche produit sans double affichage des prix, prix sur les suggestions ; Ma boîte avec le bouton « Remplir le bon de fournée » juste après le sous-total ; pastille du nombre d'articles qui ne recouvre plus « Ma boîte » dans la barre mobile ; pages légales sur une feuille unie pour une lecture confortable.
- Numéros de commande lisibles : OHM<fournée>-<numéro sur 4 chiffres> dans l'ordre des commandes de chaque fournée (OHM1-0001, OHM1-0002…), attribués par la base sans doublon possible. Les commandes déjà passées gardent leur numéro.
- Lisibilité : date limite de commande mise en avant dans un encadré sur l'accueil, prix distingués du nom des produits, « Bon à savoir » aligné à gauche, créneaux de livraison et de retrait affichés un par ligne (horaires jamais coupés), prix non répétés sur Nos fournées quand le choix du format les affiche déjà, notes des fiches produits alignées et en écriture lisible.
- Précommande sans limite de stock : chaque client commande la quantité voulue jusqu'à la date limite, la production suit la demande. Plus de capacité à saisir pour ouvrir une fournée ; le stock ne sert qu'à la vente du surplus publié par Alima après la livraison.
- Livraison : les frais ne sont plus payés en ligne ni inclus dans le total ; mention « Frais de livraison non compris, à régler directement au livreur selon votre position. » avant et après paiement. Adresse, quartier, point de repère, destinataire et position exacte sur la carte obligatoires ; position envoyable à OHMEGATO sur WhatsApp.
- Conservation : règle d'Alima appliquée aux huit produits (cake à l'orange : une semaine), affichée sur les fiches et dans le suivi de commande.
- Bon de fournée : chaque étape est validée indépendamment (les erreurs d'adresse n'étaient pas détectées tant qu'aucun créneau n'était choisi).
- Le bon de fournée ne demande plus d'adresse e-mail (aucun e-mail n'est envoyé ; contact par WhatsApp).
