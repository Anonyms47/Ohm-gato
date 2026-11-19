"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setOrderDate } from "@/app/admin/_actions/orders";
import { StateMessage } from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/Button";
import type { AdminState } from "@/lib/admin/errors";

/** Commande sans fournée : OHMEGATO choisit la date de livraison ou de retrait (visible ensuite par la cliente). */
export function SetOrderDate({ orderId, current, today }: { orderId: string; current: string | null; today: string }) {
  const router = useRouter();
  const [date, setDate] = useState(current ?? "");
  const [state, setState] = useState<AdminState>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const result = await setOrderDate(orderId, date);
    setBusy(false);
    setState(result);
    if (result?.ok) router.refresh();
  };

  return (
    <div className="mt-3 flex flex-col gap-2" data-testid="date-commande">
      <label htmlFor="order-date" className="font-bold">
        Date de remise (communiquée à la cliente)
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <input
          id="order-date"
          type="date"
          min={today}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="min-h-12 rounded-[10px] border-2 border-chocolat/35 bg-creme px-3"
        />
        <Button onClick={save} disabled={!date || busy} state={busy ? "loading" : "idle"} variant="secondary">
          {current ? "Modifier la date" : "Fixer la date"}
        </Button>
      </div>
      <StateMessage state={state} />
    </div>
  );
}
