"use client";

import Link from "next/link";
import { Drawer } from "vaul";
import { useCart } from "@/components/cart/CartProvider";
import { CartLines } from "@/components/cart/CartLines";
import { ButtonLink } from "@/components/ui/Button";
import { useIsSmallScreen } from "@/components/ui/select/shared";
import { formatFcfa } from "@/lib/money";

/** Aperçu rapide de « Ma boîte » (le panier). Bas d'écran sur téléphone, côté droit sur ordinateur. */
export function CartDrawer() {
  const { drawerOpen, setDrawerOpen, resolved } = useCart();
  const small = useIsSmallScreen();
  return (
    <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen} direction={small ? "bottom" : "right"}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-cacao/45" />
        <Drawer.Content
          aria-describedby={undefined}
          className={
            small
              ? "fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-[18px] border-t-2 border-chocolat bg-creme pb-[env(safe-area-inset-bottom)] outline-none"
              : "fixed inset-y-0 right-0 z-50 flex w-[min(28rem,100vw)] flex-col border-l-2 border-chocolat bg-creme outline-none"
          }
        >
          {small && <div aria-hidden className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-chocolat/25" />}
          <div className="flex items-center justify-between gap-3 border-b-2 border-chocolat/15 px-5 py-4">
            <Drawer.Title className="font-display text-[1.75rem] leading-none">
              Ma boîte <span className="sr-only">(panier)</span>
            </Drawer.Title>
            <Drawer.Close className="min-h-11 rounded-[8px] px-3 font-bold underline decoration-caramel decoration-2 underline-offset-4">
              Fermer
            </Drawer.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
            {resolved.lines.length === 0 ? (
              <div className="py-8 text-center">
                <p className="font-display text-[1.5rem]">Votre boîte est vide.</p>
                <p className="mt-2 text-encre-douce">Choisissez vos pâtisseries dans la fournée en cours.</p>
                <Link
                  href="/carte"
                  onClick={() => setDrawerOpen(false)}
                  className="mt-4 inline-flex min-h-11 items-center font-bold underline decoration-caramel decoration-2 underline-offset-4"
                >
                  Voir la carte
                </Link>
              </div>
            ) : (
              <CartLines compact />
            )}
          </div>
          {resolved.lines.length > 0 && (
            <div className="border-t-2 border-chocolat/15 px-5 py-4">
              <div className="flex items-baseline justify-between">
                <span className="font-bold">Sous-total</span>
                <span className="font-display text-[1.6rem] tabular-nums">{formatFcfa(resolved.subtotal)}</span>
              </div>
              <p className="mt-1 text-[0.95rem] text-encre-douce">Livraison calculée à l&apos;étape suivante selon votre quartier.</p>
              <div className="mt-4 flex flex-col gap-2" onClick={() => setDrawerOpen(false)}>
                <ButtonLink href="/commande" className="w-full">
                  Remplir le bon de fournée
                </ButtonLink>
                <ButtonLink href="/ma-boite" variant="text" className="self-center">
                  Ouvrir Ma boîte en grand
                </ButtonLink>
              </div>
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
