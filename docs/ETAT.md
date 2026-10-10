# État d'avancement

## Terminé

**Parcours d'achat** : fournée → produit → Ma boîte → bon de fournée → paiement (test) → confirmation → suivi. Prix recalculés côté serveur, stock en unités réelles avec réservation pendant le paiement, libération à l'échec ou à l'expiration, vente idempotente, frais de livraison jamais encaissés (réglés au livreur).

**Pages client**
- La Fournée (accueil), La Carte, fiches produits (conservation d'Alima, préférés), Ma boîte, bon de fournée (pré-rempli pour les membres, carnet d'adresses).
- **Nos fournées — le journal du four** (`/fournees`) : fournée actuelle, statut réel (programmée, ouverte, clôturée, préparation, livraison, terminée, annulée), quatre dates, créneaux, produits et formats autorisés, stock restant réel, ajout direct à Ma boîte, prochaine fournée ou « pas encore de date », archives ; chargement et erreur gérés.
- **Sur-mesure & Événements** (`/sur-mesure`) : carnet conversationnel en 11 questions + envoi (occasion, date et heure, invités, produits, formats/quantités/parfums, ambiance, inspiration, budget, réception avec carte, coordonnées, résumé). Brouillon conservé. Une demande n'est jamais une commande : statuts Reçue → … → Terminée, échanges avec pièces jointes, modification, propositions chiffrées par OHMEGATO, acceptation qui ouvre seulement alors le paiement.
- **Notre histoire** (`/notre-histoire`) : Oumy Gâteau → OHMEGATO → Ω (animation typographique, version fixe sans animation), ESP, événement étudiant, entourage, carte élargie, bonnes ondes, futur café présenté comme un projet. Emplacements archives, photo d'Alima, citation et audio masqués tant qu'ils ne sont pas fournis (gérés dans /admin/reglages).
- **Retrouvons votre carnet** (`/connexion`) : code temporaire par téléphone (e-mail en complément), sans mot de passe ; création de compte au premier code, commandes invitées retrouvées, code incorrect / expiré / renvoi / trop de tentatives / échec d'envoi, tampon « Carnet retrouvé ».
- **Mon carnet** (`/compte`) : commande active en priorité, tickets, détail, recomposition au prix et stock actuels, boîte et brouillons, demandes et propositions, paiements, adresses et positions, préférés, alertes, consentements, sessions (fermeture), export JSON, suppression du compte. Barre mobile Accueil / Commandes / Ma boîte / Profil.

**Administration** (`/admin`, interface séparée, rôle vérifié côté serveur à chaque page et action, journal d'audit)
- Tableau de bord : commandes du jour, à préparer, paiements, fournée active, stock faible, sur-mesure, livraisons, retraits.
- Fournées : création, dates, message d'accueil, produit vedette, programmer / ouvrir / clôturer / préparation / livraison / terminer / annuler, produits, formats, parfums, stock, créneaux.
- Produits : textes, catégorie, unités de stock, formats et prix, parfums, allergènes (statut par produit ou par parfum, précision et indicateur internes, date de validation, aperçu client exact), informations de recette, conservation, photos, publication.
- Commandes : recherche, filtres, détail, position sur la carte, statut avec historique, WhatsApp, reçu imprimable.
- Positions de livraison : carte, fiche de chaque arrêt, itinéraire, copie et partage au livreur, « confiée au livreur », « livraison terminée ».
- Stock : disponible / réservé / vendu, ajustements avec raison, historique, réservations en cours.
- Réglages : traces d'atelier, activables seulement après les trois vérifications d'Alima (ingrédients, emballages, ustensiles).
- Sur-mesure, clients (historique, adresses, consentements, notes internes), réglages éditoriaux, rôles, journal d'audit.

**Sécurité** : RLS forcée partout (vérifiée avec deux comptes dans `supabase/tests/accounts_admin_test.sql`), rôles jamais accordés depuis le navigateur, actions admin réservées au serveur, limitation de débit (codes, commandes, demandes, messages), contrôle d'origine, validation Zod, fichiers contrôlés par leurs octets, liens de suivi opaques ; sur un lien ouvert ailleurs que sur le navigateur d'origine, les informations personnelles ne s'affichent qu'après connexion par code avec le numéro de la commande.

**Tests** : 47 unitaires, 67 pgTAP, parcours Playwright (téléphone, tablette, ordinateur).

## Limites connues

- Codes de connexion : WhatsApp Cloud API écrite d'après la documentation publique, **non vérifiée** faute de compte ; sans canal configuré en production, l'envoi échoue proprement.
- Wave : le lien marchand est branché (vérification manuelle par OHMEGATO) ; Wave Checkout (API) non vérifié ; Orange Money non implémenté (contrat marchand requis).
- Logos officiels Wave et Orange Money à fournir pour les boutons de paiement (couleurs officielles déjà appliquées).
- Les alertes (nouvelle fournée) sont enregistrées ; leur envoi attend un canal de messagerie.
- Recherche d'adresse : service public OpenStreetMap, non vérifié depuis l'environnement de développement (réseau fermé) ; à tester sur le site en ligne.
