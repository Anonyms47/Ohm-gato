# Fournées : mode d'emploi pour Alima

## Le principe (commandes permanentes)

1. Les clientes **commandent à toute heure**. Aucune date limite ne ferme plus une fournée.
2. **Vous fixez la prochaine fournée** et ses dates (production, livraison, retrait). Les commandes sont rattachées automatiquement à la fournée **ouverte** ; la cliente ne propose ni ne négocie aucune date.
3. **Désigner une nouvelle fournée** (« Ouvrir les commandes ») la fait remplacer la précédente pour les **nouvelles commandes seulement**. Les commandes déjà passées restent rattachées à leur fournée, avec leurs dates : rien n'est reporté automatiquement.
4. Les **dates et le créneau** affichés à la validation sont **figés** sur la commande. Modifier ensuite le calendrier de la fournée ne change pas les commandes existantes.
5. **Sans date de livraison ou de retrait à venir**, la boîte et le catalogue restent accessibles, mais la validation et le paiement sont bloqués avec un message exact ; l'atelier affiche une alerte « Aucune fournée n'est ouverte aux commandes » (ou « La date de livraison est passée »). Rien n'est fermé automatiquement.
6. Alima **produit selon la demande** (synthèse de la demande : admin → Fournées → la fournée). Aucun plafond de stock sur les commandes d'une fournée.
7. Les commandes **payées et confirmées sont prioritaires**. Après la production, Alima peut **publier le surplus** réellement disponible (jamais automatique) : seule la quantité restante est alors commandable, de façon atomique (aucune survente).

## Préparer et ouvrir la prochaine fournée

Admin → Fournées → la fournée (en brouillon) :

1. **Configuration** : titre, début de la période de production, nombre de jours (et dates exactes si fixées), **jour principal de livraison et de retrait**. Enregistrer.
2. **Produits, formats et parfums** : cocher les produits proposés. Aucun stock à saisir.
3. **Créneaux** : ajouter les créneaux (retrait et/ou livraison) du jour principal, avec leur capacité.
4. **« Ouvrir les commandes »** et confirmer. Le site refuse l'ouverture sans produit, sans créneau ou si la date de livraison est passée. L'ancienne fournée ouverte passe à l'étape de production pour les nouvelles commandes (ses commandes ne bougent pas).

## Passer à la production

1. Quand vous le décidez : **« Passer à l'étape de production »** (aucune clôture automatique) fige les quantités ; imprimez la **fiche de production**.
2. Vérifiez les paiements Wave, annulez les commandes non payées si besoin, puis **« Passer en production »**.

## Pendant et après la production

1. Section **Production** : pour chaque produit, saisir la **quantité réellement produite**, les **pertes** et une note interne. Le **surplus théorique** s'affiche (indicatif).
2. **« Passer en livraison et retrait »** le jour principal.
3. Pour proposer un surplus : ajouter au moins un créneau **« Commandes tardives (surplus) »**, puis dans **Surplus** indiquer les quantités, la **dernière date de vente** et si la livraison est possible (sinon retrait uniquement). Cliquer sur **« Publier le surplus disponible »**, vérifier le récapitulatif, confirmer.
4. **« Retirer du surplus »** retire un produit de la vente. **« Terminer la fournée »** arrête tout.

## Règles garanties par la base de données

- Aucune commande sans date de remise à venir (heure de Dakar) ni sur un créneau passé ; aucune commande tardive hors du surplus publié ni hors des créneaux de commandes tardives.
- Dates et créneau figés à la création de la commande (colonnes `*_snapshot`), non modifiables par une mise à jour ultérieure.
- Le stock ne limite que la vente du surplus : la quantité publiée par Alima est le maximum vendu aux clients tardifs.
- Aucune quantité négative, aucune double vente de la même unité (deux clients pour la dernière : un seul l'obtient).
- Une commande annulée pendant la vente du surplus garde ses unités en stock interne : c'est Alima qui décide de les republier.
- Les quantités produites, pertes et notes internes ne sont jamais visibles des clients.
