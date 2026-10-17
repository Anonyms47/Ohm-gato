"use client";

import { useState, type ChangeEvent } from "react";
import { UPLOAD_LIMIT_BYTES, needsShrink, shrinkImage } from "@/lib/upload/shrink-image";

const mo = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;

/**
 * Champ de fichier de l'atelier : les photos lourdes sont réduites avant l'envoi
 * et un fichier encore trop lourd est signalé tout de suite, sans quitter le formulaire.
 */
export function UploadInput({ id, accept, required }: { id: string; accept: string; required?: boolean }) {
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);

  const onChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const original = input.files?.[0];
    if (!original) return setNote(null);
    let file = original;
    if (needsShrink(original)) {
      setNote({ text: "Préparation de la photo…", error: false });
      file = await shrinkImage(original);
      if (file !== original && typeof DataTransfer !== "undefined") {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
      }
    }
    if (file.size > UPLOAD_LIMIT_BYTES) {
      input.value = "";
      return setNote({ text: `Fichier trop lourd (${mo(file.size)}) : 4 Mo maximum. Choisissez un fichier plus léger.`, error: true });
    }
    setNote({ text: file === original ? `Fichier prêt (${mo(file.size)}).` : `Photo allégée : ${mo(original.size)} → ${mo(file.size)}.`, error: false });
  };

  return (
    <>
      <input id={id} name="file" type="file" required={required} accept={accept} onChange={onChange} className="min-h-11" />
      {note && (
        <p role={note.error ? "alert" : "status"} className={note.error ? "font-bold text-erreur" : "text-encre-douce"}>
          {note.text}
        </p>
      )}
    </>
  );
}
