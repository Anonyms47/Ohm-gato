/** Types du catalogue partagés serveur / navigateur. */
import type { AllergenDef, ProductAllergenInfo, WorkshopTraces } from "@/lib/allergens";
import type { AvailabilityState } from "@/lib/availability";
import type { StorageRule } from "@/lib/storage";

export type Accent = "caramel" | "chocolate" | "orange" | "rose";

export interface CatalogVariant {
  id: string;
  label: string;
  unitsConsumed: number;
  priceFcfa: number;
  enabledInCycle: boolean;
}

export interface CatalogFlavor {
  id: string;
  slug: string;
  name: string;
  availableInCycle: boolean;
}

export interface CatalogImage {
  url: string;
  alt: string;
  width: number;
  height: number;
  role: "cutout" | "scene" | "detail";
}

export interface CatalogProduct {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  tips: string | null;
  unitLabel: string;
  unitLabelPlural: string;
  staging: string;
  accent: Accent;
  /** null tant que la conservation n'est pas confirmée : rien n'est affiché. */
  storage: { rule: StorageRule; note: string | null } | null;
  /** Allergènes (statuts) et informations de recette, par produit ou par parfum. */
  allergenInfo: ProductAllergenInfo;
  pairingSlugs: string[];
  images: CatalogImage[];
  variants: CatalogVariant[];
  flavors: CatalogFlavor[];
  inCycle: boolean;
  /** Unités encore commandables dans la fournée (null hors fournée). */
  unitsLeft: number | null;
  availability: AvailabilityState;
}

export interface CycleSummary {
  id: string;
  number: number;
  title: string;
  message: string | null;
  opensAt: string;
  closesAt: string;
  /** Début de la période de production (semaine de la fournée). */
  productionDate: string;
  /** Nombre de jours de production (null si non renseigné). */
  productionDays: number | null;
  /** Dates exactes de production, seulement si Alima les a saisies. */
  productionDates: string[];
  fulfillmentDate: string;
  status: string;
  /** Fin de la vente du surplus (null tant qu'aucun surplus n'est publié). */
  surplusEndsAt: string | null;
  /** Commandes tardives : livraison possible (sinon retrait uniquement). */
  surplusDeliveryAllowed: boolean;
  /** Commande possible maintenant : précommande ouverte ou surplus publié et disponible. */
  isOpen: boolean;
  /** Type de commande accepté maintenant (null si aucune commande possible). */
  orderKind: "preorder" | "surplus" | null;
  /** Surplus entièrement vendu (fermeture automatique). */
  surplusExhausted?: boolean;
  featuredProductSlug: string | null;
  palette: Accent;
}

export interface SlotSummary {
  id: string;
  kind: "delivery" | "pickup" | "both";
  startsAt: string;
  endsAt: string;
  isFull: boolean;
}

export interface Catalog {
  cycle: CycleSummary | null;
  products: CatalogProduct[];
  allergenDefs: AllergenDef[];
  workshopTraces: WorkshopTraces;
}
