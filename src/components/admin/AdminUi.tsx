"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, type ReactNode } from "react";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { AdminState } from "@/lib/admin/errors";
import { cn } from "@/lib/cn";

export function StateMessage({ state }: { state: AdminState }) {
  if (!state) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={cn("font-bold", state.ok ? "text-succes" : "text-erreur")}>
      {state.message}
    </p>
  );
}

/** Formulaire d'administration branché sur une action serveur (états chargement / succès / erreur). */
export function AdminForm({
  action,
  submitLabel,
  children,
  className,
}: {
  action: (state: AdminState, form: FormData) => Promise<AdminState>;
  submitLabel: string;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={cn("flex flex-col gap-4", className)}>
      {children}
      <StateMessage state={state} />
      <Button type="submit" state={pending ? "loading" : state?.ok ? "success" : "idle"} loadingLabel="Enregistrement…" className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}

/** Action ponctuelle (changement de statut…), confirmée quand elle est sensible. */
export function ActionButton({
  label,
  run,
  confirm,
  variant = "secondary",
  className,
}: {
  label: string;
  run: () => Promise<AdminState>;
  confirm?: { title: string; description: ReactNode; confirmLabel?: string; destructive?: boolean };
  variant?: ButtonVariant;
  className?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<AdminState>(null);
  const [busy, setBusy] = useState(false);
  const execute = async () => {
    setBusy(true);
    const result = await run();
    setBusy(false);
    setState(result);
    if (result?.ok) router.refresh();
    return result;
  };
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {confirm ? (
        <ConfirmDialog
          trigger={<Button variant={variant}>{label}</Button>}
          title={confirm.title}
          description={confirm.description}
          confirmLabel={confirm.confirmLabel ?? label}
          variant={confirm.destructive ? "destructive" : "primary"}
          onConfirm={execute}
        />
      ) : (
        <Button variant={variant} state={busy ? "loading" : "idle"} onClick={() => void execute()}>
          {label}
        </Button>
      )}
      <StateMessage state={state} />
    </div>
  );
}

export function StatCard({ label, value, hint, tone = "default" }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "default" | "alert" }) {
  return (
    <div className={cn("rounded-[12px] border-2 bg-blanc-casse p-4", tone === "alert" ? "border-erreur" : "border-chocolat/20")}>
      <p className="text-encre-douce">{label}</p>
      <p className="font-display text-[2rem] leading-tight tabular-nums">{value}</p>
      {hint && <p className="text-[0.95rem] text-encre-douce">{hint}</p>}
    </div>
  );
}
