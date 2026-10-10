"use client";

import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { Button } from "@/components/ui/Button";
import { maxQuantityFor, orderableUnits } from "@/lib/availability";

/**
 * Recomposer une ancienne boîte : chaque format est repris au prix et au stock actuels.
 * Ce qui n'est plus disponible est signalé, jamais ajouté en silence.
 */
export function RecomposeBox({ items }: { items: { variantId: string | null; flavorId: string | null; quantity: number; productName: string; variantLabel: string }[] }) {
  const { catalog, add, setDrawerOpen, hydrated } = useCart();
  const [report, setReport] = useState<{ added: string[]; missing: string[] } | null>(null);

  const recompose = () => {
    const added: string[] = [];
    const missing: string[] = [];
    for (const item of items) {
      const label = `${item.productName} — ${item.variantLabel}`;
      const product = catalog.products.find((p) => p.variants.some((v) => v.id === item.variantId));
      const variant = product?.variants.find((v) => v.id === item.variantId);
      const flavorOk =
        !product || product.flavors.length === 0 ? item.flavorId === null : product.flavors.some((f) => f.id === item.flavorId && f.availableInCycle);
      if (!catalog.cycle?.isOpen || !product || !variant || !variant.enabledInCycle || !flavorOk || orderableUnits(product) === null) {
        missing.push(label);
        continue;
      }
      const quantity = Math.min(item.quantity, maxQuantityFor(variant, orderableUnits(product)!));
      if (quantity < 1) {
        missing.push(label);
        continue;
      }
      add({ variantId: variant.id, flavorId: item.flavorId, quantity }, `${quantity} × ${label}`);
      added.push(quantity < item.quantity ? `${label} (${quantity} au lieu de ${item.quantity})` : label);
    }
    setReport({ added, missing });
    if (added.length > 0) setDrawerOpen(true);
  };

  return (
    <div className="flex flex-col gap-3">
      <Button variant="secondary" onClick={recompose} disabled={!hydrated} className="self-start">
        Recomposer cette boîte
      </Button>
      <p className="text-[0.95rem] text-encre-douce">Prix et disponibilités de la fournée actuelle.</p>
      {report && (
        <div role="status" className="rounded-[10px] bg-blanc-casse p-3">
          {report.added.length > 0 && <p>Ajouté à Ma boîte : {report.added.join(", ")}.</p>}
          {report.missing.length > 0 && (
            <p className="text-orange-encre">Indisponible dans la fournée actuelle : {report.missing.join(", ")}.</p>
          )}
        </div>
      )}
    </div>
  );
}
