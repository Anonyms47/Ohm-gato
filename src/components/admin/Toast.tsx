"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface Toast {
  id: number;
  message: string;
  tone: "ok" | "error";
  /** Tampon artisanal affiché avec le message (ex. « Paiement vérifié »). */
  stamp?: string;
}

const ToastContext = createContext<(toast: Omit<Toast, "id">) => void>(() => {});

/** Retour visuel après une action : il survit à l'actualisation de la page (posé dans la mise en page). */
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((toast: Omit<Toast, "id">) => {
    setToasts((current) => [...current.slice(-2), { ...toast, id: Date.now() + Math.random() }]);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-24 z-[60] flex flex-col items-end gap-2 lg:bottom-6 lg:left-auto lg:right-6 lg:w-[26rem]">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDone={() => setToasts((current) => current.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 7000);
    return () => window.clearTimeout(timer);
  }, [onDone]);
  return (
    <div
      role={toast.tone === "ok" ? "status" : "alert"}
      className={cn(
        "atelier-ticket atelier-deploie pointer-events-auto flex w-full items-center gap-3 p-4 shadow-[0_8px_20px_rgba(36,20,13,0.25)]",
        toast.tone === "ok" ? "border-l-[6px] border-l-succes" : "border-l-[6px] border-l-erreur",
      )}
    >
      {toast.stamp && (
        <span aria-hidden className="ohm-tampon ohm-tampon-pose shrink-0 text-[0.95rem] text-succes">
          {toast.stamp}
        </span>
      )}
      <p className={cn("flex-1 font-bold", toast.tone === "ok" ? "text-succes" : "text-erreur")}>{toast.message}</p>
      <button type="button" onClick={onDone} className="min-h-11 shrink-0 px-2 font-bold text-encre-douce" aria-label="Fermer le message">
        ✕
      </button>
    </div>
  );
}
