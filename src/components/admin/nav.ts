import type { IconName } from "@/components/admin/AtelierIcons";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

/**
 * Navigation de l'atelier : le quotidien d'abord, la fournée ensuite, le reste à part
 * (replié par défaut sur ordinateur). Une rubrique n'apparaît qu'une fois.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "quotidien",
    label: "Au quotidien",
    items: [
      { href: "/admin", label: "Aujourd'hui", icon: "jour" },
      { href: "/admin/commandes", label: "Commandes", icon: "commande" },
      { href: "/admin/paiements", label: "Paiements Wave", icon: "paiement" },
      { href: "/admin/livraisons", label: "Livraisons", icon: "livraison" },
    ],
  },
  {
    id: "fournee",
    label: "La fournée",
    items: [
      { href: "/admin/fournee", label: "Fournée en cours", icon: "fournee" },
      { href: "/admin/production", label: "Fiche de production", icon: "fiche" },
      { href: "/admin/stock", label: "Stock et surplus", icon: "stock" },
      { href: "/admin/produits", label: "Produits", icon: "produit" },
      { href: "/admin/zones", label: "Zones de livraison", icon: "zone" },
      { href: "/admin/alertes", label: "Alertes prochaine fournée", icon: "alerte" },
    ],
  },
  {
    id: "plus",
    label: "Le reste",
    items: [
      { href: "/admin/chiffres", label: "Chiffres", icon: "chiffres" },
      { href: "/admin/clients", label: "Clients", icon: "client" },
      { href: "/admin/sur-mesure", label: "Demandes sur mesure", icon: "surmesure" },
      { href: "/admin/moyens-de-paiement", label: "Moyens de paiement", icon: "paiement" },
      { href: "/admin/notifications", label: "Notifications", icon: "cloche" },
      { href: "/admin/fournees", label: "Toutes les fournées", icon: "liste" },
      { href: "/admin/documents", label: "Documents et règles", icon: "document" },
      { href: "/admin/reglages", label: "Réglages et équipe", icon: "reglage" },
      { href: "/admin/journal", label: "Journal d'activité", icon: "journal" },
      { href: "/admin/aide", label: "Aide", icon: "aide" },
    ],
  },
];

/** Groupes repliés tant que la personne n'a rien choisi. */
export const DEFAULT_COLLAPSED = ["plus"];

/** Barre du bas sur téléphone : quatre accès directs et « Plus ». */
export const MOBILE_TABS: NavItem[] = [
  { href: "/admin", label: "Aujourd'hui", icon: "jour" },
  { href: "/admin/commandes", label: "Commandes", icon: "commande" },
  { href: "/admin/fournee", label: "Fournée", icon: "fournee" },
  { href: "/admin/livraisons", label: "Livraisons", icon: "livraison" },
];

export function isActive(pathname: string, href: string): boolean {
  const path = href.split("#")[0]!;
  if (href.includes("#")) return false;
  if (path === "/admin") return pathname === "/admin";
  if (path === "/admin/fournee") return pathname.startsWith("/admin/fournee");
  if (path === "/admin/fournees") return pathname === "/admin/fournees";
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** Actions rapides de la palette : uniquement des liens (aucune action sensible sans confirmation). */
export const QUICK_ACTIONS: { label: string; href: string; keywords: string }[] = [
  { label: "Vérifier les paiements Wave", href: "/admin/paiements", keywords: "wave paiement verifier argent" },
  { label: "Ouvrir la fournée en cours", href: "/admin/fournee", keywords: "fournee active en cours cycle" },
  { label: "Créer une fournée", href: "/admin/fournees/nouvelle", keywords: "nouvelle fournee creer" },
  { label: "Imprimer la fiche de production", href: "/admin/production", keywords: "production imprimer fiche quantites" },
  { label: "Livraisons et retraits du jour", href: "/admin/livraisons", keywords: "livraison retrait livreur carte" },
  { label: "Commandes à préparer", href: "/admin/commandes?vue=besoin#payees", keywords: "preparer commandes" },
  { label: "Ajouter un produit", href: "/admin/produits#nouveau", keywords: "produit ajouter nouveau" },
  { label: "Demandes sur mesure", href: "/admin/sur-mesure", keywords: "sur mesure devis gateau" },
  { label: "Zones de livraison et tarifs", href: "/admin/zones", keywords: "zones livraison tarif quartier grille csv" },
  { label: "Alertes prochaine fournée", href: "/admin/alertes", keywords: "alerte prevenir inscrits email prochaine fournee" },
  { label: "Moyens de paiement (Wave, Orange Money)", href: "/admin/moyens-de-paiement", keywords: "wave orange money lien marchand paiement" },
  { label: "Réseaux sociaux (Instagram, Snapchat)", href: "/admin/reglages#reseaux", keywords: "instagram snapchat reseaux sociaux" },
  { label: "Ouvrir les réglages", href: "/admin/reglages", keywords: "reglages parametres" },
  { label: "Voir les chiffres (total encaissé)", href: "/admin/chiffres", keywords: "chiffres total argent ventes bilan resume montant" },
  { label: "Journal d'activité", href: "/admin/journal", keywords: "journal audit historique" },
  { label: "Notifications de l'atelier", href: "/admin/notifications", keywords: "notifications alertes rappels" },
  { label: "Aide de l'atelier", href: "/admin/aide", keywords: "aide guide comment" },
];
