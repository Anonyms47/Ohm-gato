"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { OhmegatoSelect } from "@/components/ui/select/OhmegatoSelect";
import type { SelectOption } from "@/components/ui/select/shared";

/** Filtres en paramètres d'URL : la liste reste partageable et revient intacte après un retour. */
export function QueryFilters({
  filters,
  searchLabel = "Recherche",
  withSearch = true,
}: {
  filters: { name: string; label: string; options: SelectOption[] }[];
  searchLabel?: string;
  withSearch?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const apply = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value && value !== "tous") next.set(key, value);
      else next.delete(key);
    }
    router.push(`${pathname}?${next.toString()}`);
  };
  return (
    <form
      className="grid gap-3 rounded-[12px] bg-blanc-casse p-4 sm:grid-cols-2 lg:grid-cols-[2fr_repeat(4,1fr)_auto] lg:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        apply({ q });
      }}
    >
      {withSearch && (
        <Field label={searchLabel}>{({ id }) => <TextInput id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Référence, nom, téléphone" />}</Field>
      )}
      {filters.map((f) => (
        <OhmegatoSelect
          key={f.name}
          label={f.label}
          value={params.get(f.name) ?? "tous"}
          onValueChange={(value) => apply({ [f.name]: value })}
          options={[{ value: "tous", label: "Tous" }, ...f.options]}
        />
      ))}
      {withSearch && (
        <Button type="submit" variant="secondary">
          Rechercher
        </Button>
      )}
    </form>
  );
}
