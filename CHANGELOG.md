# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
et le projet adhère au [versionnage sémantique](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté

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

- Livraison : les frais ne sont plus payés en ligne ni inclus dans le total ; mention « Frais de livraison non compris, à régler directement au livreur selon votre position. » avant et après paiement. Adresse, quartier, point de repère, destinataire et position exacte sur la carte obligatoires ; position envoyable à OHMEGATO sur WhatsApp.
- Conservation : règle d'Alima appliquée aux huit produits (cake à l'orange : une semaine), affichée sur les fiches et dans le suivi de commande.
- Bon de fournée : chaque étape est validée indépendamment (les erreurs d'adresse n'étaient pas détectées tant qu'aucun créneau n'était choisi).
- Le bon de fournée ne demande plus d'adresse e-mail (aucun e-mail n'est envoyé ; contact par WhatsApp).
