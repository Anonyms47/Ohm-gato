"use client";

import dynamic from "next/dynamic";
import { LoadingScreen } from "@/components/brand/LoadingScreen";
import type { MapStop } from "@/components/admin/DeliveryMap";

/** Carte chargée côté navigateur uniquement (Leaflet). */
export const AdminMap = dynamic(() => import("@/components/admin/DeliveryMap"), {
  ssr: false,
  loading: () => <LoadingScreen size="section" label="Chargement de la carte…" />,
});

export type { MapStop };
