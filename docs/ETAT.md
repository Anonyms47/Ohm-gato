# État d'avancement

## Terminé : parcours fournée → produit → Ma boîte → commande → paiement de test → confirmation → suivi

**Base de données** (`supabase/migrations/`)
- Toutes les entités du schéma minimal, montants entiers en FCFA, instantané des lignes de commande.
- RLS forcée sur toutes les tables. Le client ne lit que ses données ; le livreur passe par une vue limitée aux livraisons prêtes ; aucun rôle ne s'accorde depuis le navigateur.
- `place_order` : prix recalculés, fournée ouverte, créneau et capacité, parfums autorisés, stock commun entre formats, verrous ordonnés, idempotence.
- `apply_payment_event` : idempotent, contrôle du montant, réservé → vendu, libération en cas d'échec, paiement tardif.
- Limitation de débit persistée (commande, statut, reprise de paiement).

**Interface**
- Tokens de marque centralisés (contrastes AA vérifiés), polices temporaires isolées, `BrandHeading`.
- Boutons (primaire, secondaire, accent, texte, icône, destructif, Wave, Orange Money) avec états chargement, succès et erreur, sans double clic.
- Listes : `OhmegatoSelect`, `OhmegatoCombobox`, `OhmegatoMultiSelect`, `OhmegatoBottomSheetSelect` (clavier complet, raisons d'indisponibilité, feuille sur téléphone).
- La Fournée (5 actes, la note d'Alima reste masquée tant qu'elle n'est pas fournie), La Carte (menu et scène sur tablette et ordinateur, affiches et index sur téléphone, deux vues), fiches produits (mise en scène propre à chaque produit, conservation et allergènes affichés seulement s'ils sont confirmés, données structurées).
- Ma boîte : tiroir, page complète, revalidation en direct, bande mobile, reprise « Une boîte vous attendait ».
- Le bon de fournée : 6 étapes, validation par étape avec résumé des erreurs, téléphone sénégalais, quartier recherchable, carte avec repère, géolocalisation volontaire, saisie manuelle, hors zone validé avant paiement, ticket imprimé (animation ignorable et réduite), brouillon conservé.
- Suivi par lien personnel opaque : interrogation du vrai statut, reprise du paiement, tampon « PAYÉE » après confirmation serveur, carnet de route, code de retrait, reçu imprimable.

**Tests** : 33 unitaires, 33 pgTAP, 60 Playwright (téléphone, tablette, ordinateur).

## Prochaines étapes (dans l'ordre du brief)

1. Pages éditoriales : Nos Fournées (journal du four, archives), Sur-mesure (carnet en 8 étapes et statuts), Notre Histoire.
2. Connexion sans mot de passe (OTP téléphone via un fournisseur SMS ou WhatsApp, e-mail en complément), suivi invité par référence + téléphone + code, espace « Mon carnet ».
3. Administration `/admin` : fournées, produits, stocks, commandes, zones, créneaux, demandes, journal des actions, confirmations.
4. Animations restantes : couverture de fournée en table gourmande, carnet de connexion.
5. Recherche d'adresse et polygones de zones.

## Limites connues

- Wave n'est pas vérifié contre l'API réelle ; Orange Money n'est pas implémenté.
- Les visuels produits viennent des affiches fournies ; leur authenticité (photos réelles ou non) reste à confirmer par Alima.
- L'occupation des créneaux compte toutes les commandes non annulées, y compris celles en attente de paiement.
