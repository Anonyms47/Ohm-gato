"use client";

import { useEffect, useId, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { Button, type ButtonState } from "@/components/ui/Button";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { OhmegatoSelect } from "@/components/ui/select/OhmegatoSelect";
import { maxQuantityFor } from "@/lib/availability";
import type { CatalogProduct } from "@/lib/catalog-types";
import { cn } from "@/lib/cn";
import { cycleStatusLine } from "@/lib/cycle-status";
import { formatFcfa } from "@/lib/money";

/**
 * Choix du format, du parfum et de la quantité, puis ajout à « Ma boîte »
 * sans quitter la page. Les formats (2 ou 3) restent visibles avec leur prix.
 */
export function AddToBox({ product, tone = "light", compact = false }: { product: CatalogProduct; tone?: "light" | "dark"; compact?: boolean }) {
  const { add, resolved, catalog, setDrawerOpen, hydrated } = useCart();
  const groupId = useId();
  const cycleOpen = catalog.cycle?.isOpen ?? false;
  const variants = product.variants.filter((v) => v.enabledInCycle);
  const flavors = product.flavors.filter((f) => f.availableInCycle);

  // Unités déjà dans la boîte pour ce produit (stock commun entre formats).
  const unitsInBox = resolved.lines
    .filter((l) => l.product?.id === product.id && l.variant)
    .reduce((sum, l) => sum + l.variant!.unitsConsumed * l.line.quantity, 0);
  const unitsLeft = Math.max(0, (product.unitsLeft ?? 0) - unitsInBox);

  const firstBuyable = variants.find((v) => v.unitsConsumed <= unitsLeft);
  const [variantId, setVariantId] = useState<string | null>(firstBuyable?.id ?? null);
  const [flavorId, setFlavorId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [state, setState] = useState<ButtonState>("idle");
  const [flavorError, setFlavorError] = useState<string | undefined>();

  const variant = variants.find((v) => v.id === variantId) ?? null;
  const maxQty = variant ? maxQuantityFor(variant, unitsLeft) : 0;

  useEffect(() => {
    if (state !== "success") return;
    const timer = window.setTimeout(() => setState("idle"), 1600);
    return () => window.clearTimeout(timer);
  }, [state]);

  if (!product.inCycle) {
    return (
      <p className={cn("font-bold", tone === "dark" ? "text-creme/85" : "text-encre-douce")}>
        Pas dans la fournée actuelle.
      </p>
    );
  }
  if (!cycleOpen) {
    return (
      <p className={cn("font-bold", tone === "dark" ? "text-creme/85" : "text-encre-douce")}>
        {catalog.cycle ? cycleStatusLine(catalog.cycle) : "Les commandes sont fermées pour le moment."}
      </p>
    );
  }

  const soldOut = !firstBuyable && unitsInBox === 0;
  const textTone = tone === "dark" ? "text-creme" : "text-chocolat";

  return (
    <form
      className={cn("flex flex-col", compact ? "gap-3" : "gap-4")}
      onSubmit={(event) => {
        event.preventDefault();
        if (!variant || quantity > maxQty) return;
        if (flavors.length > 0 && !flavorId) {
          setFlavorError("Choisissez un parfum.");
          return;
        }
        const flavor = flavors.find((f) => f.id === flavorId);
        add(
          { variantId: variant.id, flavorId: flavorId ?? null, quantity },
          `${product.name}, ${variant.label}${flavor ? `, ${flavor.name}` : ""} × ${quantity}`,
        );
        setState("success");
        setQuantity(1);
      }}
    >
      <fieldset>
        <legend className={cn("mb-2 font-bold", textTone)}>Format</legend>
        <div className="flex flex-wrap gap-2">
          {variants.map((v) => {
            const disabled = v.unitsConsumed > unitsLeft;
            const checked = v.id === variantId;
            const inputId = `${groupId}-${v.id}`;
            return (
              <div key={v.id} className="min-w-[8.5rem] flex-1">
                <input
                  type="radio"
                  id={inputId}
                  name={`${groupId}-format`}
                  value={v.id}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => {
                    setVariantId(v.id);
                    setQuantity(1);
                  }}
                  className="peer sr-only"
                  aria-describedby={disabled ? `${inputId}-raison` : undefined}
                />
                <label
                  htmlFor={inputId}
                  className={cn(
                    "flex min-h-14 cursor-pointer flex-col justify-center rounded-[10px] border-2 px-3 py-2 transition-colors",
                    "peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-rose-encre",
                    tone === "dark"
                      ? "border-creme/40 text-creme peer-checked:border-creme peer-checked:bg-creme peer-checked:text-cacao"
                      : "border-chocolat/30 bg-blanc-casse text-chocolat peer-checked:border-chocolat peer-checked:bg-chocolat peer-checked:text-creme",
                    "peer-disabled:cursor-not-allowed peer-disabled:opacity-55",
                  )}
                >
                  <span className="font-bold leading-tight">{v.label}</span>
                  <span className="tabular-nums">{formatFcfa(v.priceFcfa)}</span>
                  {disabled && (
                    <span id={`${inputId}-raison`} className="text-[0.85rem] font-bold">
                      Plus assez de pièces
                    </span>
                  )}
                </label>
              </div>
            );
          })}
        </div>
      </fieldset>

      {flavors.length > 0 && (
        <div className={tone === "dark" ? "[&_label]:text-creme" : undefined}>
          <OhmegatoSelect
            label="Parfum"
            placeholder="Choisir un parfum"
            value={flavorId}
            onValueChange={(v) => {
              setFlavorId(v);
              setFlavorError(undefined);
            }}
            error={flavorError}
            options={product.flavors.map((f) => ({
              value: f.id,
              label: f.name,
              disabled: !f.availableInCycle,
              disabledReason: f.availableInCycle ? undefined : "Pas dans cette fournée",
            }))}
          />
        </div>
      )}

      {soldOut ? (
        <p className={cn("font-bold", textTone)}>Épuisé pour cette fournée.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <QuantityStepper
            value={Math.min(quantity, Math.max(maxQty, 1))}
            onChange={setQuantity}
            max={Math.max(maxQty, 1)}
            label={`Quantité de ${product.name}${variant ? `, ${variant.label}` : ""}`}
          />
          <Button
            type="submit"
            variant={tone === "dark" ? "accent" : "primary"}
            state={state}
            successLabel="Ajouté à Ma boîte"
            // Désactivé tant que la page n'est pas interactive : un clic ne se perd jamais.
            disabled={!hydrated || !variant || maxQty === 0}
            className="flex-1 whitespace-nowrap"
          >
            {variant ? `Ajouter · ${formatFcfa(variant.priceFcfa * Math.min(quantity, Math.max(maxQty, 1)))}` : "Choisissez un format"}
          </Button>
          {state === "success" && (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className={cn("min-h-11 font-bold underline decoration-2 decoration-caramel underline-offset-4", textTone)}
            >
              Voir Ma boîte
            </button>
          )}
        </div>
      )}
    </form>
  );
}
