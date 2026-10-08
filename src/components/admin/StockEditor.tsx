"use client";

import { useState } from "react";
import { setStock } from "@/app/admin/_actions/cycles";
import { ActionButton } from "@/components/admin/AdminUi";
import { TextInput } from "@/components/ui/Field";

/** Ajustement du total d'un produit (jamais sous réservé + vendu, contrôlé par la base). */
export function StockRow({ cycleId, productId, total, label }: { cycleId: string; productId: string; total: number; label: string }) {
  const [value, setValue] = useState(String(total));
  const [reason, setReason] = useState("");
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col text-[0.9rem]">
        Nouveau total
        <TextInput type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} className="min-h-11 w-28" aria-label={`Nouveau total pour ${label}`} />
      </label>
      <label className="flex flex-col text-[0.9rem]">
        Raison
        <TextInput value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-11 w-48" aria-label={`Raison de l'ajustement pour ${label}`} />
      </label>
      <ActionButton
        label="Ajuster"
        run={() => setStock(cycleId, productId, Number(value), reason)}
        confirm={{ title: `Ajuster le stock de ${label} ?`, description: <p>Total actuel {total} → {value}. Le mouvement est gardé dans l&apos;historique.</p>, confirmLabel: "Ajuster le stock" }}
      />
    </div>
  );
}
