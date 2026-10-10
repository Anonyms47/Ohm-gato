"use client";

/** Impression ou enregistrement en PDF du document (mise en page d'impression dédiée). */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="min-h-11 font-bold text-chocolat underline decoration-caramel decoration-2 underline-offset-4 print:hidden"
    >
      Imprimer ou enregistrer en PDF
    </button>
  );
}
