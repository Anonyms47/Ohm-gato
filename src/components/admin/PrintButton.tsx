"use client";

import { Button } from "@/components/ui/Button";

export function PrintButton({ label = "Imprimer le reçu" }: { label?: string }) {
  return (
    <Button onClick={() => window.print()} className="print:hidden">
      {label}
    </Button>
  );
}
