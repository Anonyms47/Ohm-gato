"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { recordProductionPrint } from "@/app/admin/_actions/cycles";
import { Button } from "@/components/ui/Button";

/** Imprime la fiche et en garde la trace (quantités figées à l'instant de l'impression). */
export function ProductionPrintButton({ cycleId }: { cycleId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      className="print:hidden"
      state={busy ? "loading" : "idle"}
      loadingLabel="Préparation…"
      onClick={async () => {
        setBusy(true);
        await recordProductionPrint(cycleId).catch(() => null);
        setBusy(false);
        window.print();
        router.refresh();
      }}
    >
      Imprimer la fiche
    </Button>
  );
}
