# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
et le projet adhère au [versionnage sémantique](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté

- Logo officiel et visuels détourés des huit produits ; rose de la palette aligné sur le logo.
- Application Next.js 16 de la boutique OHMEGATO : La Fournée, La Carte, fiches produits, Ma boîte, Le bon de fournée, suivi de commande.
- Schéma Supabase complet avec RLS, fonctions atomiques de commande, de stock et de paiement, catalogue réel des huit produits.
- Couche de paiement indépendante du fournisseur (test, Wave, Orange Money à finaliser) avec webhooks signés et idempotents.
- Système de listes déroulantes, boutons et champs accessibles aux couleurs de la marque.
- Tests unitaires, pgTAP et Playwright (téléphone, tablette, ordinateur) ; CI étendue.
- Structure initiale du dépôt : documentation, modèles GitHub, CI et conventions.
