"use client";

import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant =
  | "primary"      // chocolat — un seul par zone de décision
  | "secondary"    // crème bordé
  | "accent"       // rose
  | "text"
  | "icon"
  | "destructive"
  | "wave"
  | "orange-money";

export type ButtonState = "idle" | "loading" | "success" | "error";

const base =
  "relative inline-flex items-center justify-center gap-2 select-none font-text font-bold " +
  "transition-[transform,background-color,box-shadow,color] duration-[var(--ohm-duree-courte)] ease-[var(--ohm-courbe)] " +
  "active:translate-y-px focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-rose-encre " +
  "disabled:cursor-not-allowed aria-disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary:
    "min-h-12 px-6 rounded-[10px] bg-chocolat text-creme shadow-[0_3px_0_var(--ohm-cacao)] " +
    "hover:bg-cacao active:shadow-[0_1px_0_var(--ohm-cacao)] disabled:bg-encre-douce/60 disabled:shadow-none",
  secondary:
    "min-h-12 px-6 rounded-[10px] border-2 border-chocolat bg-creme text-chocolat " +
    "hover:bg-blanc-casse disabled:border-encre-douce/50 disabled:text-encre-douce/70",
  accent:
    "min-h-12 px-6 rounded-[10px] bg-rose text-cacao shadow-[0_3px_0_var(--ohm-rose-encre)] " +
    "hover:brightness-95 active:shadow-[0_1px_0_var(--ohm-rose-encre)] disabled:opacity-60 disabled:shadow-none",
  text:
    "min-h-11 px-2 text-chocolat underline decoration-2 underline-offset-4 decoration-caramel " +
    "hover:decoration-chocolat disabled:text-encre-douce/70",
  icon:
    "size-11 rounded-full text-chocolat hover:bg-chocolat/8 disabled:text-encre-douce/50",
  destructive:
    "min-h-12 px-6 rounded-[10px] border-2 border-erreur bg-blanc-casse text-erreur hover:bg-erreur hover:text-blanc-casse",
  wave:
    "min-h-14 px-6 rounded-[12px] bg-wave text-wave-encre shadow-[0_3px_0_var(--ohm-wave-encre)] " +
    "hover:brightness-105 disabled:opacity-60 disabled:shadow-none",
  "orange-money":
    "min-h-14 px-6 rounded-[12px] bg-orange-money text-cacao shadow-[0_3px_0_var(--ohm-cacao)] " +
    "hover:brightness-105 disabled:opacity-60 disabled:shadow-none",
};

function Spinner() {
  return (
    <span
      aria-hidden
      className="size-5 rounded-full border-[3px] border-current border-r-transparent animate-[ohm-spin_700ms_linear_infinite]"
    />
  );
}

interface CommonProps {
  variant?: ButtonVariant;
  state?: ButtonState;
  /** Texte annoncé pendant le chargement (ex. « Enregistrement… »). */
  loadingLabel?: string;
  successLabel?: string;
  errorLabel?: string;
  children: ReactNode;
  className?: string;
}

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * Bouton OHMEGATO. Pendant le chargement, le libellé reste en place (invisible)
 * pour que le bouton ne change pas de taille, et les clics sont ignorés.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", state = "idle", loadingLabel, successLabel, errorLabel, children, className, onClick, disabled, type = "button", ...rest },
  ref,
) {
  const busy = state === "loading";
  const label =
    state === "success" && successLabel ? successLabel : state === "error" && errorLabel ? errorLabel : children;
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      data-state={state}
      className={cn(base, variants[variant], className)}
      onClick={(event) => {
        if (busy) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...rest}
    >
      <span className={cn("inline-flex items-center gap-2", busy && "invisible")}>{label}</span>
      {busy && (
        <span className="absolute inset-0 inline-flex items-center justify-center gap-2">
          <Spinner />
          <span className="sr-only">{loadingLabel ?? "Chargement…"}</span>
        </span>
      )}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: Exclude<ButtonVariant, "icon">;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cn(base, variants[variant], className)}>
      {children}
    </Link>
  );
}
