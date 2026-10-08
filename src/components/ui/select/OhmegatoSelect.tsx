"use client";

import * as RadixSelect from "@radix-ui/react-select";
import { Field } from "@/components/ui/Field";
import { OhmegatoBottomSheetSelect } from "@/components/ui/select/BottomSheetSelect";
import {
  Check,
  Chevron,
  LoadingDot,
  TriggerValue,
  itemClass,
  panelClass,
  triggerClass,
  useIsSmallScreen,
  type SelectOption,
} from "@/components/ui/select/shared";

export interface OhmegatoSelectProps {
  label: string;
  value: string | null;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  loading?: boolean;
  optional?: boolean;
  id?: string;
  name?: string;
  className?: string;
}

/**
 * Liste déroulante courte (formats, parfums, créneaux…).
 * Bureau : menu Radix (clavier complet, portail sans problème de z-index).
 * Téléphone : feuille depuis le bas.
 */
export function OhmegatoSelect({
  label,
  value,
  onValueChange,
  options,
  placeholder = "Choisir…",
  hint,
  error,
  disabled,
  loading,
  optional,
  id,
  name,
  className,
}: OhmegatoSelectProps) {
  const small = useIsSmallScreen();
  const selected = options.find((o) => o.value === value);

  return (
    <Field id={id} label={label} hint={hint} error={error} optional={optional} className={className}>
      {({ id: fieldId, describedBy, invalid }) =>
        small ? (
          <OhmegatoBottomSheetSelect
            id={fieldId}
            label={label}
            placeholder={placeholder}
            options={options}
            selectedValues={value ? [value] : []}
            onToggle={onValueChange}
            disabled={disabled}
            loading={loading}
            invalid={invalid}
            describedBy={describedBy}
            triggerLabel={selected?.label}
          />
        ) : (
          <RadixSelect.Root value={value ?? ""} onValueChange={onValueChange} disabled={disabled || loading} name={name}>
            <RadixSelect.Trigger
              id={fieldId}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              className={triggerClass}
            >
              <RadixSelect.Value asChild>
                <TriggerValue label={selected?.label} placeholder={loading ? "Chargement…" : placeholder} />
              </RadixSelect.Value>
              <RadixSelect.Icon asChild>{loading ? <LoadingDot /> : <Chevron />}</RadixSelect.Icon>
            </RadixSelect.Trigger>
            <RadixSelect.Portal>
              <RadixSelect.Content
                position="popper"
                sideOffset={6}
                collisionPadding={12}
                className={`${panelClass} w-[var(--radix-select-trigger-width)] max-h-[min(22rem,var(--radix-select-content-available-height))]`}
              >
                <RadixSelect.Viewport className="p-1.5">
                  {options.map((option) => (
                    <RadixSelect.Item
                      key={option.value}
                      value={option.value}
                      disabled={option.disabled}
                      className={`${itemClass} data-[highlighted]:bg-grille/70`}
                    >
                      <Check visible={option.value === value} />
                      {/* ItemText : libellé, précision et raison d'indisponibilité sont annoncés. */}
                      <RadixSelect.ItemText asChild>
                        <span className="flex min-w-0 flex-col">
                          <span className={option.value === value ? "font-bold" : undefined}>{option.label}</span>
                          {option.description && <span className="text-[0.92rem] text-encre-douce">{option.description}</span>}
                          {option.disabled && option.disabledReason && (
                            <span className="text-[0.92rem] font-bold text-erreur">{option.disabledReason}</span>
                          )}
                        </span>
                      </RadixSelect.ItemText>
                    </RadixSelect.Item>
                  ))}
                </RadixSelect.Viewport>
              </RadixSelect.Content>
            </RadixSelect.Portal>
          </RadixSelect.Root>
        )
      }
    </Field>
  );
}
