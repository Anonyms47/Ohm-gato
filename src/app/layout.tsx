import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { brand } from "@/config/brand";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${brand.name} — pâtisseries faites maison à Dakar`, template: `%s · ${brand.name}` },
  description:
    "Cookies, brownies, moelleux, muffins, choux et verrines faits maison à Dakar. Commandes par fournées, livraison dans Dakar ou retrait à Sud Foire.",
  openGraph: { type: "website", locale: "fr_SN", siteName: brand.name },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#f5e9d6",
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

// Stock, statut de fournée et session en temps réel : rendu à chaque requête.
export const dynamic = "force-dynamic";

/** Racine commune au site client et à l'administration (chacun a sa propre mise en page). */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr-SN">
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
