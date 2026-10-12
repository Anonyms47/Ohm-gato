"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { adminSearch } from "@/app/admin/_actions/search";
import { AtelierIcon } from "@/components/admin/AtelierIcons";
import { QUICK_ACTIONS } from "@/components/admin/nav";
import type { SearchKind, SearchResult } from "@/lib/admin/search";
import { cn } from "@/lib/cn";

const kindLabel: Record<SearchKind, string> = {
  commande: "Commande",
  client: "Client",
  produit: "Produit",
  fournee: "Fournée",
  "sur-mesure": "Sur mesure",
};

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

interface Entry {
  key: string;
  label: string;
  detail: string;
  href: string;
}

/**
 * Palette de l'atelier (Ctrl+K / ⌘K ou bouton « Rechercher ») : recherche serveur et accès rapides.
 * Elle ne fait que naviguer : aucune action sensible n'est exécutée depuis ici.
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const listId = useId();
  const searchedFor = useRef("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      inputRef.current?.focus();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = window.setTimeout(() => {
      searchedFor.current = q;
      startTransition(async () => {
        const found = await adminSearch(q).catch(() => [] as SearchResult[]);
        if (searchedFor.current === q) setResults(found);
      });
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  const entries: Entry[] = useMemo(() => {
    const q = fold(query.trim());
    const quick = QUICK_ACTIONS.filter((a) => !q || fold(`${a.label} ${a.keywords}`).includes(q)).map((a) => ({ key: `q:${a.href}`, label: a.label, detail: "Accès rapide", href: a.href }));
    const found = query.trim().length >= 2 ? results.map((r, i) => ({ key: `r:${i}:${r.href}`, label: r.title, detail: `${kindLabel[r.kind]} · ${r.detail}`, href: r.href })) : [];
    return [...found, ...quick];
  }, [query, results]);

  const go = useCallback(
    (href: string) => {
      onClose();
      setQuery("");
      setResults([]);
      router.push(href);
    },
    [onClose, router],
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(entries.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter" && entries[active]) {
      event.preventDefault();
      go(entries[active].href);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label="Rechercher dans l'atelier"
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-0 h-dvh max-h-dvh w-full max-w-none bg-transparent p-0 backdrop:bg-cacao/55 sm:mx-auto sm:mt-[10vh] sm:h-auto sm:max-h-[75vh] sm:max-w-xl"
    >
      <div className="atelier-ticket atelier-deploie flex h-full flex-col sm:h-auto sm:max-h-[75vh]">
        <div className="flex items-center gap-2 border-b-2 border-dashed border-chocolat/20 px-4 py-3">
          <AtelierIcon name="recherche" className="size-5 shrink-0 text-encre-douce" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={entries[active] ? `${listId}-${active}` : undefined}
            aria-label="Rechercher une commande, un client, un produit, une fournée"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              if (e.target.value.trim().length < 2) setResults([]);
            }}
            onKeyDown={onKeyDown}
            placeholder="OHM1-0001, nom, téléphone, produit…"
            className="min-h-11 w-full bg-transparent text-[1.1rem] outline-none placeholder:text-encre-douce/70"
          />
          <button type="button" onClick={onClose} className="min-h-11 rounded-[8px] px-3 font-bold text-encre-douce hover:bg-chocolat/5">
            Fermer
          </button>
        </div>
        <p className="sr-only" role="status">
          {pending ? "Recherche…" : query.trim().length >= 2 ? `${results.length} résultat${results.length > 1 ? "s" : ""}` : ""}
        </p>
        <ul id={listId} role="listbox" aria-label="Résultats" className="min-h-0 flex-1 overflow-y-auto p-2">
          {entries.map((entry, index) => (
            <li
              key={entry.key}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseEnter={() => setActive(index)}
              onClick={() => go(entry.href)}
              className={cn("flex min-h-12 cursor-pointer flex-col justify-center rounded-[8px] px-3 py-2", index === active ? "bg-rose/60" : "hover:bg-chocolat/5")}
            >
              <span className="font-bold">{entry.label}</span>
              <span className="text-[0.92rem] text-encre-douce">{entry.detail}</span>
            </li>
          ))}
          {entries.length === 0 && !pending && <li className="px-3 py-6 text-center text-encre-douce">Rien trouvé pour « {query.trim()} ».</li>}
        </ul>
        <p className="hidden border-t border-dashed border-chocolat/20 px-4 py-2 text-[0.85rem] text-encre-douce sm:block">↑ ↓ pour choisir · Entrée pour ouvrir · Échap pour fermer</p>
      </div>
    </dialog>
  );
}
