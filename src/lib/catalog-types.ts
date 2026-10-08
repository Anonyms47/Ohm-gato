/** Types du catalogue partagés serveur / navigateur. */
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
  /** Allergènes confirmés uniquement. */
  allergens: { slug: string; name: string }[];
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
  productionDate: string;
  fulfillmentDate: string;
  status: string;
  /** Ouverte maintenant : statut « open » et dans la fenêtre de commande. */
  isOpen: boolean;
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
}
