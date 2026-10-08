"use client";

import { Command } from "cmdk";
import { useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
  /** Précision affichée sous le libellé (prix, horaire, frais…). */
  description?: string;
  disabled?: boolean;
  /** Raison obligatoire quand l'option est désactivée (« Complet », « Épuisé »…). */
  disabledReason?: string;
  group?: string;
  /** Mots supplémentaires pour la recherche (ex. quartiers d'une zone). */
  keywords?: string[];
}

export const triggerClass =
  "group flex w-full min-h-12 items-center justify-between gap-3 rounded-[10px] border-2 border-chocolat/35 " +
  "bg-blanc-casse px-4 py-2.5 text-left text-[1.0625rem] text-chocolat transition-colors " +
  "duration-[var(--ohm-duree-courte)] hover:border-chocolat/60 focus-visible:border-chocolat " +
  "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-rose-encre " +
  "data-[state=open]:border-chocolat aria-[invalid=true]:border-erreur " +
  "disabled:cursor-not-allowed disabled:bg-creme disabled:text-encre-douce";

export const panelClass =
  "z-50 overflow-hidden rounded-[12px] border-2 border-chocolat bg-blanc-casse text-chocolat " +
  "shadow-[0_10px_30px_-12px_rgb(36_20_13/0.45)]";

export function Chevron() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="size-5 shrink-0 transition-transform group-data-[state=open]:rotate-180">
      <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Check({ visible }: { visible: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className={cn("size-5 shrink-0", visible ? "opacity-100" : "opacity-0")}>
      <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LoadingDot() {
  return (
    <span aria-hidden className="size-4 rounded-full border-2 border-current border-r-transparent animate-[ohm-spin_700ms_linear_infinite]" />
  );
}

/** Valeur affichée dans le déclencheur : placeholder visuellement distinct d'une vraie valeur. */
export function TriggerValue({ label, placeholder }: { label: string | undefined; placeholder: string }) {
  return label ? (
    <span className="truncate font-bold">{label}</span>
  ) : (
    <span className="truncate italic text-encre-douce">{placeholder}</span>
  );
}

/** Contenu d'une option (partagé par tous les composants). */
export function OptionContent({ option, selected }: { option: SelectOption; selected: boolean }) {
  return (
    <>
      <Check visible={selected} />
      <span className="flex min-w-0 flex-col">
        <span className={cn("leading-snug", selected && "font-bold")}>
          {option.label}
          {selected && <span className="sr-only"> (choisi)</span>}
        </span>
        {option.description && <span className="text-[0.92rem] text-encre-douce">{option.description}</span>}
        {option.disabled && option.disabledReason && (
          <span className="text-[0.92rem] font-bold text-erreur">{option.disabledReason}</span>
        )}
      </span>
    </>
  );
}

export const itemClass =
  "flex min-h-11 cursor-pointer items-start gap-2.5 rounded-[8px] px-3 py-2.5 outline-none " +
  "data-[selected=true]:bg-grille/70 data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-70";

/** Liste cmdk partagée par le combobox, la sélection multiple et la feuille mobile. */
export function OptionList({
  options,
  isSelected,
  onSelect,
  searchPlaceholder,
  emptyLabel = "Aucun résultat.",
  footer,
  label,
}: {
  options: SelectOption[];
  isSelected: (value: string) => boolean;
  onSelect: (value: string) => void;
  /** Absent = pas de recherche. */
  searchPlaceholder?: string;
  emptyLabel?: string;
  footer?: ReactNode;
  label: string;
}) {
  const groups = Array.from(new Set(options.map((o) => o.group ?? "")));
  return (
    <Command label={label} loop className="flex max-h-[inherit] flex-col">
      {searchPlaceholder && (
        <div className="border-b-2 border-chocolat/15 p-2">
          <Command.Input
            autoFocus
            placeholder={searchPlaceholder}
            className="w-full min-h-11 rounded-[8px] bg-creme px-3 text-[1.0625rem] text-chocolat placeholder:text-encre-douce/80 focus:outline-[3px] focus:outline-rose-encre"
          />
        </div>
      )}
      <Command.List className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
        <Command.Empty className="px-3 py-4 text-encre-douce">{emptyLabel}</Command.Empty>
        {groups.map((group) => (
          <Command.Group
            key={group || "_"}
            heading={group || undefined}
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[0.85rem] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-caramel-encre"
          >
            {options
              .filter((o) => (o.group ?? "") === group)
              .map((option) => (
                <Command.Item
                  key={option.value}
                  value={option.value}
                  keywords={[option.label, ...(option.keywords ?? [])]}
                  disabled={option.disabled}
                  onSelect={() => onSelect(option.value)}
                  className={itemClass}
                >
                  <OptionContent option={option} selected={isSelected(option.value)} />
                </Command.Item>
              ))}
          </Command.Group>
        ))}
      </Command.List>
      {footer && <div className="border-t-2 border-chocolat/15 p-2">{footer}</div>}
    </Command>
  );
}

const SMALL_QUERY = "(max-width: 639px)";

function subscribe(callback: () => void) {
  const query = window.matchMedia(SMALL_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

/** Vrai sur téléphone : les listes s'ouvrent alors en feuille depuis le bas. */
export function useIsSmallScreen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(SMALL_QUERY).matches,
    () => false,
  );
}
