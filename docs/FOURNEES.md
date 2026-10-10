# Fournées : mode d'emploi pour Alima

## Le principe

1. Les clients **précommandent** jusqu'à la date limite (heure de Dakar). Après, le site refuse toute précommande, même si la page est restée ouverte.
2. Alima **produit selon la demande** : la synthèse de la demande (admin → Fournées → la fournée) donne, par produit, ce qui est payé, ce qui est à vérifier et ce qu'il faut produire.
3. Les commandes **payées et confirmées sont prioritaires** : leur stock n'est jamais proposé à d'autres clients.
4. Après la production (et en général après les livraisons), Alima peut **publier le surplus** réellement disponible. Rien n'est publié automatiquement.
5. Les clients qui ont raté la précommande peuvent alors commander **dans la limite du surplus publié**, jusqu'à épuisement ou jusqu'à la dernière date de vente.

## Ouvrir les précommandes

Admin → Fournées → la fournée (en brouillon) :

1. **Configuration de la fournée** : vérifier le titre, la date d'ouverture, la **date limite de précommande**, le début de la période de production, le **nombre de jours de production** (et les dates exactes si elles sont fixées), le **jour principal de livraison et de retrait**. Enregistrer.
2. **Produits, formats et capacité de précommande** : cocher les produits proposés, les formats et parfums, et saisir pour chacun la **capacité de précommande** (le nombre maximal d'unités que vous acceptez). Enregistrer.
3. **Créneaux** : ajouter les créneaux « Précommandes » (retrait et/ou livraison) du jour principal, avec leur capacité.
4. En haut de la page, cliquer sur **« Ouvrir les commandes »** et confirmer. Le site refuse l'ouverture tant qu'un produit n'a pas de capacité ou qu'aucun créneau de précommande n'existe.

## Après la date limite

1. Cliquer sur **« Clôturer les précommandes »** (le site les a déjà fermées à l'heure limite ; ce clic fait passer la fournée à l'étape suivante).
2. **Fiche de production (imprimable)** : la liste de ce qu'il faut produire.
3. Vérifier les paiements Wave des commandes (Commandes → filtre de la fournée), annuler celles qui ne sont pas payées.
4. **« Passer en production »**.

## Pendant et après la production

1. Section **Production** : pour chaque produit, saisir la **quantité réellement produite**, les **pertes** et une note interne. Le **surplus théorique** s'affiche (indicatif).
2. **« Passer en livraison et retrait »** le jour principal.
3. Pour proposer un surplus : ajouter au moins un créneau **« Commandes tardives (surplus) »**, puis dans **Surplus** indiquer les quantités, la **dernière date de vente** et si la livraison est possible (sinon retrait uniquement). Cliquer sur **« Publier le surplus disponible »**, vérifier le récapitulatif, confirmer.
4. **« Retirer du surplus »** retire un produit de la vente. **« Terminer la fournée »** arrête tout.

## Règles garanties par la base de données

- Aucune précommande après la date limite ; aucune commande tardive hors du surplus publié ni hors des créneaux de commandes tardives.
- Aucune quantité négative, aucune double vente de la même unité (deux clients pour la dernière : un seul l'obtient).
- Une précommande annulée pendant la vente du surplus garde ses unités en stock interne : c'est Alima qui décide de les republier.
- Les quantités produites, pertes et notes internes ne sont jamais visibles des clients.
