import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartProvider } from "@/components/cart/CartProvider";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { CartAnnouncer, MobileNav, ResumeBanner, SiteHeader } from "@/components/layout/SiteChrome";
import { brand } from "@/config/brand";
import { getCatalog } from "@/lib/catalog";
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

// Stock et statut de fournée en temps réel : rendu à chaque requête.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const catalog = await getCatalog();
  return (
    <html lang="fr-SN">
      <body className="flex min-h-dvh flex-col">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-[8px] focus:bg-chocolat focus:px-4 focus:py-3 focus:text-creme"
        >
          Aller au contenu
        </a>
        <CartProvider catalog={catalog}>
          <SiteHeader />
          <ResumeBanner />
          <main id="contenu" className="flex-1">
            {children}
          </main>
          <SiteFooter />
          <MobileNav />
          <CartDrawer />
          <CartAnnouncer />
        </CartProvider>
      </body>
    </html>
  );
}
