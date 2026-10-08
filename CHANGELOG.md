# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
et le projet adhère au [versionnage sémantique](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté

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
