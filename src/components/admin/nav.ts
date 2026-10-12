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

/** Navigation de l'atelier, regroupée par moment de travail. */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "aujourdhui",
    label: "Aujourd'hui",
    items: [
      { href: "/admin", label: "Tableau de bord", icon: "jour" },
      { href: "/admin/actions", label: "Actions à traiter", icon: "liste" },
    ],
  },
  {
    id: "production",
    label: "Production",
    items: [
      { href: "/admin/fournees", label: "Fournées", icon: "fournee" },
      { href: "/admin/production", label: "Fiche de production", icon: "fiche" },
      { href: "/admin/produits", label: "Produits", icon: "produit" },
      { href: "/admin/stock", label: "Stock et surplus", icon: "stock" },
    ],
  },
  {
    id: "ventes",
    label: "Ventes",
    items: [
      { href: "/admin/commandes", label: "Commandes", icon: "commande" },
      { href: "/admin/paiements", label: "Paiements", icon: "paiement" },
      { href: "/admin/livraisons", label: "Livraisons", icon: "livraison" },
    ],
  },
  {
    id: "clients",
    label: "Relation client",
    items: [
      { href: "/admin/clients", label: "Clients", icon: "client" },
      { href: "/admin/sur-mesure", label: "Demandes sur mesure", icon: "surmesure" },
    ],
  },
  {
    id: "gestion",
    label: "Gestion",
    items: [
      { href: "/admin/documents", label: "Documents et règles", icon: "document" },
      { href: "/admin/reglages", label: "Réglages", icon: "reglage" },
      { href: "/admin/reglages#roles", label: "Équipe et rôles", icon: "equipe" },
      { href: "/admin/journal", label: "Journal d'activité", icon: "journal" },
      { href: "/admin/aide", label: "Aide", icon: "aide" },
    ],
  },
];

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
  { label: "Ouvrir les réglages", href: "/admin/reglages", keywords: "reglages parametres" },
  { label: "Journal d'activité", href: "/admin/journal", keywords: "journal audit historique" },
];
