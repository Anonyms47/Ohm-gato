"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Observe un élément : `offscreen` devient vrai quand il n'est plus visible dans la zone utile de l'écran
 * (les 80 derniers pixels, cachés par la barre du bas, comptent comme hors écran). Faux tant que l'élément
 * n'existe pas ou que le navigateur ne sait pas observer : aucune action n'est alors doublée.
 */
export function useOffscreen<T extends Element>(): [(node: T | null) => void, boolean] {
  const [node, setNode] = useState<T | null>(null);
  const [offscreen, setOffscreen] = useState(false);
  const ref = useCallback((el: T | null) => setNode(el), []);
  useEffect(() => {
    if (!node || typeof IntersectionObserver === "undefined") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- l'élément a disparu : plus rien à doubler
      setOffscreen(false);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setOffscreen(!entry!.isIntersecting), { threshold: 0, rootMargin: "0px 0px -80px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [ref, offscreen];
}
