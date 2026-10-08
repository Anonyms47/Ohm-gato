"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const fieldControl =
  "w-full min-h-12 rounded-[10px] border-2 border-chocolat/35 bg-blanc-casse px-4 py-2.5 text-[1.0625rem] text-chocolat " +
  "placeholder:text-encre-douce/70 transition-colors duration-[var(--ohm-duree-courte)] " +
  "hover:border-chocolat/60 focus:border-chocolat focus:outline-[3px] focus:outline-offset-2 focus:outline-rose-encre " +
  "aria-[invalid=true]:border-erreur disabled:cursor-not-allowed disabled:bg-creme disabled:text-encre-douce";

/**
 * Champ de formulaire : libellé toujours visible, aide et erreur reliées au contrôle.
 * Le contrôle reçoit les identifiants via render-prop pour rester accessible.
 */
export function Field({
  label,
  hint,
  error,
  optional,
  children,
  className,
  id: forcedId,
}: {
  id?: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}) {
  const generatedId = useId();
  const id = forcedId ?? generatedId;
  const hintId = hint ? `${id}-aide` : undefined;
  const errorId = error ? `${id}-erreur` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="font-bold text-chocolat">
        {label}
        {optional && <span className="ml-2 font-normal text-encre-douce">(facultatif)</span>}
      </label>
      {hint && (
        <p id={hintId} className="text-[0.95rem] text-encre-douce">
          {hint}
        </p>
      )}
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-[0.95rem] font-bold text-erreur">
          <span aria-hidden>✕</span>
          {error}
        </p>
      )}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(fieldControl, className)} {...props} />;
});

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(fieldControl, "min-h-28 resize-y", className)} {...props} />;
});

/** Résumé des erreurs, placé en tête d'étape et focalisé après une soumission refusée. */
export const ErrorSummary = forwardRef<HTMLDivElement, { title?: string; errors: { field: string; message: string }[] }>(
  function ErrorSummary({ title = "Quelques informations sont à corriger", errors }, ref) {
    if (errors.length === 0) return null;
    return (
      <div
        ref={ref}
        tabIndex={-1}
        role="alert"
        className="rounded-[10px] border-2 border-erreur bg-blanc-casse p-4 text-chocolat focus:outline-[3px] focus:outline-rose-encre"
      >
        <p className="font-bold text-erreur">{title}</p>
        <ul className="mt-2 list-disc pl-5">
          {errors.map((e) => (
            <li key={e.field}>
              <a href={`#${e.field}`} className="underline underline-offset-4">
                {e.message}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  },
);
