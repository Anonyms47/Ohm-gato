"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

/** Itinéraire, copie et partage de la position avec le livreur. */
export function PositionLinks({
  reference,
  latitude,
  longitude,
  address,
  landmark,
  recipient,
}: {
  reference: string;
  latitude: number;
  longitude: number;
  address: string;
  landmark: string | null;
  recipient: string;
}) {
  const [copied, setCopied] = useState<"idle" | "ok" | "error">("idle");
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  const routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  const text = [`Livraison OHMEGATO ${reference}`, address, landmark ? `Repère : ${landmark}` : "", `Destinataire : ${recipient}`, mapsUrl]
    .filter(Boolean)
    .join("\n");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("ok");
    } catch {
      setCopied("error");
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <a href={routeUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-[10px] bg-chocolat px-4 font-bold text-creme">
        Ouvrir l&apos;itinéraire
      </a>
      <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-bold underline decoration-caramel decoration-2 underline-offset-4">
        Ouvrir la position
      </a>
      <Button variant="secondary" className="min-h-11" onClick={() => void copy()}>
        {copied === "ok" ? "Position copiée" : "Copier pour le livreur"}
      </Button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center font-bold underline decoration-caramel decoration-2 underline-offset-4"
      >
        Partager sur WhatsApp
      </a>
      {copied === "error" && <span className="font-bold text-erreur">Copie impossible : sélectionnez le texte manuellement.</span>}
    </div>
  );
}
