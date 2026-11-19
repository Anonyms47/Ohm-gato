/**
 * Commander sans fournée : quand aucune fournée n'est ouverte, on commande quand même.
 * La commande n'a ni fournée ni créneau ; OHMEGATO communique ensuite la date de livraison ou de retrait.
 */

/** Valeur interne du champ « créneau » du formulaire quand aucun créneau n'existe (jamais envoyée au serveur). */
export const ON_DEMAND_SLOT = "a-convenir";

export const ON_DEMAND_BANNER =
  "Aucune fournée n'est ouverte : vous pouvez commander quand même. OHMEGATO vous communique la date de livraison ou de retrait.";

export const ON_DEMAND_DATE = "Date communiquée par OHMEGATO";

export const ON_DEMAND_DATE_LONG =
  "La date de livraison ou de retrait de cette commande vous sera communiquée par OHMEGATO (WhatsApp ou téléphone). Elle apparaîtra aussi ici.";
