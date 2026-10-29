# Retours en arrière

Chaque migration additive récente a son script de retour (`*.down.sql`). Ils ne sont **jamais** appliqués automatiquement :
à lancer à la main (SQL Editor ou `psql`) uniquement pour annuler la migration du même nom, de préférence dans l'ordre inverse.
Sauvegarder les tables concernées avant : un retour supprime les données ajoutées par la migration (inscrits, réglages…).
