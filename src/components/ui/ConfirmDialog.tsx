"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState, type ReactNode } from "react";
import { Button, type ButtonVariant } from "@/components/ui/Button";

/**
 * Confirmation des actions sensibles ou destructives. Le bouton de confirmation
 * reste bloqué pendant l'action (pas de double envoi) et affiche l'erreur éventuelle.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
  variant = "destructive",
  children,
}: {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<{ ok: boolean; message: string } | null | void>;
  variant?: ButtonVariant;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await onConfirm();
      if (result && !result.ok) {
        setError(result.message);
        return;
      }
      setOpen(false);
    } catch {
      setError("Action impossible pour le moment. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!busy) setOpen(next);
        if (!next) setError(null);
      }}
    >
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-cacao/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[71] max-h-[90dvh] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[14px] border-2 border-chocolat bg-blanc-casse p-6 text-chocolat shadow-[0_6px_0_var(--ohm-chocolat)]">
          <Dialog.Title className="font-display text-[1.6rem] leading-tight">{title}</Dialog.Title>
          <Dialog.Description asChild>
            <div className="mt-3">{description}</div>
          </Dialog.Description>
          {children}
          {error && (
            <p role="alert" className="mt-3 font-bold text-erreur">
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant={variant} state={busy ? "loading" : "idle"} loadingLabel="En cours…" onClick={() => void confirm()}>
              {confirmLabel}
            </Button>
            <Dialog.Close asChild>
              <Button variant="text" disabled={busy}>
                Annuler
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
