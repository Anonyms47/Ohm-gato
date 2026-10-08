"use client";

import dynamic from "next/dynamic";
import type { MapStop } from "@/components/admin/DeliveryMap";

/** Carte chargée côté navigateur uniquement (Leaflet). */
export const AdminMap = dynamic(() => import("@/components/admin/DeliveryMap"), {
  ssr: false,
  loading: () => <p className="text-encre-douce">Chargement de la carte…</p>,
});

export type { MapStop };
