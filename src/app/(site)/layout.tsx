import type { ReactNode } from "react";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartProvider } from "@/components/cart/CartProvider";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { CartAnnouncer, MobileNav, ResumeBanner, SiteHeader } from "@/components/layout/SiteChrome";
import { getCurrentUser } from "@/lib/auth/session";
import { getCatalog } from "@/lib/catalog";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const [catalog, user] = await Promise.all([getCatalog(), getCurrentUser()]);
  const account = user ? { name: user.displayName } : null;
  return (
    <>
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-[8px] focus:bg-chocolat focus:px-4 focus:py-3 focus:text-creme"
      >
        Aller au contenu
      </a>
      <CartProvider catalog={catalog}>
        <SiteHeader account={account} />
        <ResumeBanner />
        <main id="contenu" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <MobileNav account={account} />
        <CartDrawer />
        <CartAnnouncer />
      </CartProvider>
    </>
  );
}
