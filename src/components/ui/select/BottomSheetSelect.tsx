"use client";

import { useState, type ReactNode } from "react";
import { Drawer } from "vaul";
import { Chevron, LoadingDot, OptionList, TriggerValue, triggerClass, type SelectOption } from "@/components/ui/select/shared";

/**
 * Feuille de sélection mobile : s'ouvre depuis le bas, se ferme par glissement,
 * Échap ou toucher hors de la feuille. Le focus est piégé puis rendu au déclencheur.
 */
export function OhmegatoBottomSheetSelect({
  id,
  label,
  placeholder,
  options,
  selectedValues,
  onToggle,
  multiple = false,
  searchPlaceholder,
  emptyLabel,
  disabled,
  loading,
  invalid,
  describedBy,
  footer,
  triggerLabel,
}: {
  id: string;
  label: string;
  placeholder: string;
  options: SelectOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  multiple?: boolean;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  invalid?: boolean;
  describedBy?: string;
  footer?: (close: () => void) => ReactNode;
  triggerLabel: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Drawer.Root open={open} onOpenChange={setOpen} repositionInputs={false}>
      <Drawer.Trigger
        id={id}
        disabled={disabled || loading}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-haspopup="dialog"
        data-state={open ? "open" : "closed"}
        className={triggerClass}
      >
        <TriggerValue label={triggerLabel} placeholder={loading ? "Chargement…" : placeholder} />
        {loading ? <LoadingDot /> : <Chevron />}
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-cacao/45" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-[18px] border-t-2 border-chocolat bg-blanc-casse pb-[env(safe-area-inset-bottom)] text-chocolat outline-none"
        >
          <div aria-hidden className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-chocolat/25" />
          <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3">
            <Drawer.Title className="font-display text-[1.4rem] leading-tight">{label}</Drawer.Title>
            <Drawer.Close className="min-h-11 rounded-[8px] px-3 font-bold underline decoration-caramel decoration-2 underline-offset-4">
              {multiple ? "Valider" : "Fermer"}
            </Drawer.Close>
          </div>
          <div className="flex min-h-0 flex-1 flex-col [max-height:calc(85dvh-5rem)]">
            <OptionList
              label={label}
              options={options}
              isSelected={(v) => selectedValues.includes(v)}
              onSelect={(v) => {
                onToggle(v);
                if (!multiple) setOpen(false);
              }}
              searchPlaceholder={searchPlaceholder}
              emptyLabel={emptyLabel}
              footer={footer?.(() => setOpen(false))}
            />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
