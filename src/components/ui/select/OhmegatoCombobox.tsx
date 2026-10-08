"use client";

import * as Popover from "@radix-ui/react-popover";
import { useState, type ReactNode } from "react";
import { Field } from "@/components/ui/Field";
import { OhmegatoBottomSheetSelect } from "@/components/ui/select/BottomSheetSelect";
import {
  Chevron,
  LoadingDot,
  OptionList,
  TriggerValue,
  panelClass,
  triggerClass,
  useIsSmallScreen,
  type SelectOption,
} from "@/components/ui/select/shared";

interface BaseProps {
  label: string;
  options: SelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  loading?: boolean;
  optional?: boolean;
  id?: string;
  className?: string;
  /** Action complémentaire sous la liste (ex. « Mon quartier n'est pas dans la liste »). */
  footer?: (close: () => void) => ReactNode;
}

function ListPopover({
  fieldId,
  describedBy,
  invalid,
  triggerLabel,
  props,
  selectedValues,
  onToggle,
  multiple,
}: {
  fieldId: string;
  describedBy: string | undefined;
  invalid: boolean;
  triggerLabel: string | undefined;
  props: BaseProps;
  selectedValues: string[];
  onToggle: (value: string) => void;
  multiple: boolean;
}) {
  const [open, setOpen] = useState(false);
  const placeholder = props.placeholder ?? "Choisir…";
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        id={fieldId}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        disabled={props.disabled || props.loading}
        className={triggerClass}
      >
        <TriggerValue label={triggerLabel} placeholder={props.loading ? "Chargement…" : placeholder} />
        {props.loading ? <LoadingDot /> : <Chevron />}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className={`${panelClass} flex w-[var(--radix-popover-trigger-width)] min-w-72 flex-col max-h-[min(26rem,var(--radix-popover-content-available-height))]`}
        >
          <OptionList
            label={props.label}
            options={props.options}
            isSelected={(v) => selectedValues.includes(v)}
            onSelect={(v) => {
              onToggle(v);
              if (!multiple) setOpen(false);
            }}
            searchPlaceholder={props.searchPlaceholder ?? "Rechercher…"}
            emptyLabel={props.emptyLabel}
            footer={props.footer?.(() => setOpen(false))}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Longue liste avec recherche (zones et quartiers de Dakar…). */
export function OhmegatoCombobox(
  props: BaseProps & { value: string | null; onValueChange: (value: string) => void; displayValue?: string },
) {
  const small = useIsSmallScreen();
  const triggerLabel = props.displayValue ?? props.options.find((o) => o.value === props.value)?.label;
  return (
    <Field id={props.id} label={props.label} hint={props.hint} error={props.error} optional={props.optional} className={props.className}>
      {({ id, describedBy, invalid }) =>
        small ? (
          <OhmegatoBottomSheetSelect
            id={id}
            label={props.label}
            placeholder={props.placeholder ?? "Choisir…"}
            options={props.options}
            selectedValues={props.value ? [props.value] : []}
            onToggle={props.onValueChange}
            searchPlaceholder={props.searchPlaceholder ?? "Rechercher…"}
            emptyLabel={props.emptyLabel}
            disabled={props.disabled}
            loading={props.loading}
            invalid={invalid}
            describedBy={describedBy}
            footer={props.footer}
            triggerLabel={triggerLabel}
          />
        ) : (
          <ListPopover
            fieldId={id}
            describedBy={describedBy}
            invalid={invalid}
            triggerLabel={triggerLabel}
            props={props}
            selectedValues={props.value ? [props.value] : []}
            onToggle={props.onValueChange}
            multiple={false}
          />
        )
      }
    </Field>
  );
}

/** Choix multiples (filtres, préférences, alertes). */
export function OhmegatoMultiSelect(
  props: BaseProps & { values: string[]; onValuesChange: (values: string[]) => void },
) {
  const small = useIsSmallScreen();
  const chosen = props.options.filter((o) => props.values.includes(o.value));
  const triggerLabel =
    chosen.length === 0 ? undefined : chosen.length <= 2 ? chosen.map((o) => o.label).join(", ") : `${chosen.length} choix`;
  const toggle = (value: string) =>
    props.onValuesChange(
      props.values.includes(value) ? props.values.filter((v) => v !== value) : [...props.values, value],
    );
  return (
    <Field id={props.id} label={props.label} hint={props.hint} error={props.error} optional={props.optional} className={props.className}>
      {({ id, describedBy, invalid }) =>
        small ? (
          <OhmegatoBottomSheetSelect
            id={id}
            label={props.label}
            placeholder={props.placeholder ?? "Aucun choix"}
            options={props.options}
            selectedValues={props.values}
            onToggle={toggle}
            multiple
            searchPlaceholder={props.searchPlaceholder}
            emptyLabel={props.emptyLabel}
            disabled={props.disabled}
            loading={props.loading}
            invalid={invalid}
            describedBy={describedBy}
            footer={props.footer}
            triggerLabel={triggerLabel}
          />
        ) : (
          <ListPopover
            fieldId={id}
            describedBy={describedBy}
            invalid={invalid}
            triggerLabel={triggerLabel}
            props={{ ...props, placeholder: props.placeholder ?? "Aucun choix" }}
            selectedValues={props.values}
            onToggle={toggle}
            multiple
          />
        )
      }
    </Field>
  );
}
