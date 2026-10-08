"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  addLine,
  emptyCart,
  parseStoredCart,
  removeLine,
  setQuantity,
  type Cart,
  type CartLine,
} from "@/lib/cart";
import { resolveCart, type ResolvedCart } from "@/lib/cart-resolve";
import type { Catalog } from "@/lib/catalog-types";

const STORAGE_KEY = "ohmegato.boite.v1";
const SESSION_KEY = "ohmegato.session";

interface CartContextValue {
  cart: Cart;
  resolved: ResolvedCart;
  catalog: Catalog;
  hydrated: boolean;
  add: (line: CartLine, label: string) => void;
  setLineQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  /** Une boîte d'une visite précédente attend une décision. */
  resumePending: boolean;
  resolveResume: (keep: boolean) => void;
  /** Dernier ajout, pour le retour visuel et l'annonce aux lecteurs d'écran. */
  lastAdded: { label: string; at: number } | null;
}

const CartContext = createContext<CartContextValue | null>(null);

function readStorage(): Cart | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? parseStoredCart(JSON.parse(raw)) : null;
  } catch {
    return null; // stockage indisponible (navigation privée…) : la boîte vit en mémoire
  }
}

function writeStorage(cart: Cart) {
  try {
    if (cart.lines.length === 0) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // ignoré : la boîte reste utilisable pendant la visite
  }
}

export function CartProvider({ catalog, children }: { catalog: Catalog; children: ReactNode }) {
  const cycleId = catalog.cycle?.id ?? null;
  const [cart, setCart] = useState<Cart>(() => emptyCart(cycleId));
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [resumePending, setResumePending] = useState(false);
  const [lastAdded, setLastAdded] = useState<CartContextValue["lastAdded"]>(null);
  const skipWrite = useRef(true);

  // Lecture différée : le rendu serveur et le premier rendu client restent identiques.
  useEffect(() => {
    const stored = readStorage();
    let firstVisitOfSession = false;
    try {
      firstVisitOfSession = !window.sessionStorage.getItem(SESSION_KEY);
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      firstVisitOfSession = false;
    }
    /* eslint-disable react-hooks/set-state-in-effect -- synchronisation unique avec le stockage du navigateur */
    if (stored && stored.lines.length > 0) {
      setCart(stored);
      if (firstVisitOfSession) setResumePending(true);
    }
    setHydrated(true);
    document.documentElement.dataset.hydrated = "true"; // repère pour les tests de bout en bout
    /* eslint-enable react-hooks/set-state-in-effect */

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      skipWrite.current = true;
      setCart(readStorage() ?? emptyCart(cycleId));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [cycleId]);

  useEffect(() => {
    if (!hydrated) return;
    if (skipWrite.current) {
      skipWrite.current = false;
      return;
    }
    writeStorage(cart);
  }, [cart, hydrated]);

  const add = useCallback(
    (line: CartLine, label: string) => {
      setCart((current) => addLine({ ...current, cycleId: cycleId ?? current.cycleId }, line));
      setResumePending(false);
      setLastAdded({ label, at: Date.now() });
    },
    [cycleId],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      resolved: resolveCart(cart, catalog.products, catalog.cycle),
      catalog,
      hydrated,
      add,
      setLineQuantity: (key, quantity) => setCart((c) => setQuantity(c, key, quantity)),
      remove: (key) => setCart((c) => removeLine(c, key)),
      clear: () => {
        const empty = emptyCart(cycleId);
        writeStorage(empty); // immédiat : une navigation juste après ne doit pas retrouver l'ancienne boîte
        setCart(empty);
      },
      drawerOpen,
      setDrawerOpen,
      resumePending,
      resolveResume: (keep) => {
        setResumePending(false);
        if (!keep) setCart(emptyCart(cycleId));
      },
      lastAdded,
    }),
    [cart, catalog, hydrated, add, cycleId, drawerOpen, resumePending, lastAdded],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart doit être utilisé dans <CartProvider>.");
  return context;
}
