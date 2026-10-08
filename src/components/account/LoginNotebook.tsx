"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { brand } from "@/config/brand";
import { cn } from "@/lib/cn";

type Channel = "phone" | "email";
type Step = "contact" | "code" | "found";

interface ApiError {
  code: string;
  message: string;
  retryAfter?: number;
  attemptsLeft?: number;
}

async function post<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: ApiError }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await response.json()) as T & ApiError & { ok: boolean };
    return json.ok ? { ok: true, data: json } : { ok: false, error: json };
  } catch {
    return { ok: false, error: { code: "NETWORK", message: "Connexion au serveur impossible. Vérifiez votre réseau puis réessayez." } };
  }
}

/** Couverture du carnet : s'ouvre une fois au chargement, sans jamais bloquer la saisie. */
function NotebookCover() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 origin-left rounded-[18px] bg-chocolat [backface-visibility:hidden] motion-safe:animate-[ohm-carnet_700ms_var(--ohm-courbe)_120ms_forwards] motion-reduce:hidden"
    >
      <div className="grid h-full place-items-center">
        <span className="grid size-24 place-items-center rounded-full border-4 border-rose bg-rose-vif/30 font-display text-[3.5rem] text-rose shadow-[0_4px_0_var(--ohm-cacao)]">
          Ω
        </span>
      </div>
    </div>
  );
}

/**
 * « Retrouvons votre carnet » : connexion par code temporaire (téléphone en priorité,
 * e-mail en complément). Aucun mot de passe. Le compte est créé au premier code validé.
 */
export function LoginNotebook({ next, testMode }: { next: string; testMode: boolean }) {
  const router = useRouter();
  const [channel, setChannel] = useState<Channel>("phone");
  const [step, setStep] = useState<Step>("contact");
  const [destination, setDestination] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [testCode, setTestCode] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ isNew: boolean; needsName: boolean; claimedOrders: number } | null>(null);
  const [name, setName] = useState("");
  const [nameState, setNameState] = useState<"idle" | "loading" | "error">("idle");
  const codeRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
    if (step === "found") headingRef.current?.focus();
  }, [step]);

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    const result = await post<{ resendAfter: number; testCode: string | null }>("/api/auth/code", { channel, destination });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      if (result.error.retryAfter) setResendIn(result.error.retryAfter);
      return;
    }
    setTestCode(result.data.testCode);
    setResendIn(result.data.resendAfter);
    setCode("");
    setStep("code");
  };

  const onContactSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (destination.trim().length < 3) {
      setError({ code: "INVALID_DESTINATION", message: channel === "phone" ? "Indiquez votre numéro de téléphone." : "Indiquez votre adresse e-mail." });
      return;
    }
    void sendCode();
  };

  const onCodeSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(code.replace(/\s/g, ""))) {
      setError({ code: "CODE_INVALID", message: "Le code compte 6 chiffres." });
      return;
    }
    setBusy(true);
    setError(null);
    const result = await post<{ isNew: boolean; needsName: boolean; claimedOrders: number }>("/api/auth/verify", {
      channel,
      destination,
      code,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOutcome(result.data);
    setStep("found");
    router.refresh();
  };

  const saveName = async (event: FormEvent) => {
    event.preventDefault();
    if (nameState === "loading") return;
    if (name.trim().length < 2) {
      router.push(next);
      return;
    }
    setNameState("loading");
    const response = await fetch("/api/compte/nom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: name }),
    }).catch(() => null);
    if (!response?.ok) {
      setNameState("error");
      return;
    }
    router.push(next);
    router.refresh();
  };

  const codeExpired = error?.code === "CODE_EXPIRED" || error?.code === "TOO_MANY_ATTEMPTS" || error?.code === "NO_CODE";

  return (
    <section aria-labelledby={titleId} className="relative [perspective:1600px]">
      <div className="relative overflow-hidden rounded-[18px] border-2 border-chocolat bg-blanc-casse shadow-[0_6px_0_var(--ohm-chocolat)]">
        <NotebookCover />
        {/* Marge rouge et spirale du carnet */}
        <div aria-hidden className="absolute inset-y-0 left-10 w-px bg-rose-vif/50" />
        <div aria-hidden className="absolute inset-y-6 left-3 flex flex-col justify-between">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="size-3 rounded-full border-2 border-chocolat/40 bg-creme" />
          ))}
        </div>

        <div className="relative py-8 pl-14 pr-5 sm:pl-16 sm:pr-8">
          {step !== "found" && (
            <>
              <p className="font-script text-[1.4rem] text-caramel-encre">carnet OHMEGATO</p>
              <h1 id={titleId} className="mt-1 font-display text-[clamp(2rem,6vw,2.8rem)] leading-[1]">
                Retrouvons votre carnet
              </h1>
              <p className="mt-3 text-encre-douce">
                Un code temporaire suffit : pas de mot de passe. Première visite ? Votre carnet se crée au premier code.
              </p>
            </>
          )}

          {step === "contact" && (
            <form onSubmit={onContactSubmit} noValidate className="mt-6 flex flex-col gap-5">
              <div role="radiogroup" aria-label="Recevoir le code par" className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["phone", "Téléphone"],
                    ["email", "E-mail"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={channel === value}
                    onClick={() => {
                      setChannel(value);
                      setDestination("");
                      setError(null);
                    }}
                    className="min-h-12 rounded-[10px] border-2 border-chocolat/35 font-bold aria-checked:border-chocolat aria-checked:bg-chocolat aria-checked:text-creme"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Field
                label={channel === "phone" ? "Numéro de téléphone" : "Adresse e-mail"}
                hint={channel === "phone" ? "Le code arrive par message sur ce numéro (WhatsApp)." : "Le code arrive dans votre boîte e-mail."}
                error={error?.message}
              >
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    id={id}
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    type={channel === "phone" ? "tel" : "email"}
                    inputMode={channel === "phone" ? "tel" : "email"}
                    autoComplete={channel === "phone" ? "tel" : "email"}
                    placeholder={channel === "phone" ? "77 123 45 67" : "vous@exemple.sn"}
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                  />
                )}
              </Field>
              <Button type="submit" state={busy ? "loading" : "idle"} loadingLabel="Envoi du code…" disabled={resendIn > 0 && error?.code === "RESEND_TOO_SOON"}>
                {resendIn > 0 && error?.code === "RESEND_TOO_SOON" ? `Nouveau code possible dans ${resendIn} s` : "Recevoir mon code"}
              </Button>
              {error?.code === "SEND_FAILED" && (
                <p className="text-encre-douce">
                  Besoin d&apos;aide ?{" "}
                  <a href={brand.whatsappUrl} className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
                    Écrire à OHMEGATO sur WhatsApp
                  </a>
                </p>
              )}
            </form>
          )}

          {step === "code" && (
            <form onSubmit={onCodeSubmit} noValidate className="mt-6 flex flex-col gap-5">
              <p>
                Code envoyé à <strong className="break-all">{destination}</strong>.{" "}
                <button
                  type="button"
                  className="min-h-11 font-bold underline decoration-caramel decoration-2 underline-offset-4"
                  onClick={() => {
                    setStep("contact");
                    setError(null);
                  }}
                >
                  Modifier
                </button>
              </p>
              {testMode && testCode && (
                <p className="rounded-[10px] border-2 border-dashed border-caramel-encre p-3 font-bold text-caramel-encre" data-testid="code-test">
                  MODE TEST — aucun message réel n&apos;est envoyé. Code : <span className="tabular-nums">{testCode}</span>
                </p>
              )}
              <Field
                label="Code à 6 chiffres"
                hint="Valable 10 minutes, utilisable une seule fois."
                error={
                  error
                    ? error.attemptsLeft !== undefined
                      ? `${error.message} Encore ${error.attemptsLeft} essai${error.attemptsLeft > 1 ? "s" : ""}.`
                      : error.message
                    : undefined
                }
              >
                {({ id, describedBy, invalid }) => (
                  <TextInput
                    ref={codeRef}
                    id={id}
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="text-center font-display text-[1.8rem] tracking-[0.5em] tabular-nums"
                  />
                )}
              </Field>
              {codeExpired ? (
                <Button type="button" onClick={() => void sendCode()} state={busy ? "loading" : "idle"} loadingLabel="Envoi du code…">
                  Recevoir un nouveau code
                </Button>
              ) : (
                <Button type="submit" state={busy ? "loading" : "idle"} loadingLabel="Vérification du code…">
                  Ouvrir mon carnet
                </Button>
              )}
              <Button
                variant="text"
                className="self-start"
                disabled={resendIn > 0 || busy}
                onClick={() => void sendCode()}
              >
                {resendIn > 0 ? `Renvoyer le code (dans ${resendIn} s)` : "Renvoyer le code"}
              </Button>
            </form>
          )}

          {step === "found" && outcome && (
            <div className="flex flex-col gap-5">
              <p aria-hidden className="ohm-tampon ohm-tampon-pose w-fit text-[1.6rem] text-succes">
                Carnet retrouvé
              </p>
              <h1 ref={headingRef} tabIndex={-1} className="font-display text-[clamp(1.8rem,5vw,2.4rem)] leading-[1.05] focus:outline-none">
                {outcome.isNew ? "Votre carnet est ouvert." : "Content de vous revoir."}
              </h1>
              <p role="status">
                <span className="sr-only">Carnet retrouvé. </span>
                {outcome.claimedOrders > 0
                  ? `Nous avons retrouvé ${outcome.claimedOrders} commande${outcome.claimedOrders > 1 ? "s" : ""} passée${outcome.claimedOrders > 1 ? "s" : ""} avec ce numéro : elle${outcome.claimedOrders > 1 ? "s sont" : " est"} maintenant dans votre carnet.`
                  : outcome.isNew
                    ? "Vos prochaines commandes, demandes sur-mesure et adresses y seront rangées."
                    : "Vos commandes et vos demandes vous attendent."}
              </p>
              {outcome.needsName ? (
                <form onSubmit={saveName} className="flex flex-col gap-4">
                  <Field label="Comment vous appeler ?" optional error={nameState === "error" ? "Enregistrement impossible. Réessayez." : undefined}>
                    {({ id, describedBy, invalid }) => (
                      <TextInput
                        id={id}
                        aria-describedby={describedBy}
                        aria-invalid={invalid || undefined}
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={80}
                      />
                    )}
                  </Field>
                  <Button type="submit" state={nameState === "loading" ? "loading" : "idle"} loadingLabel="Enregistrement…">
                    {name.trim().length >= 2 ? "Enregistrer et ouvrir mon carnet" : "Ouvrir mon carnet"}
                  </Button>
                </form>
              ) : (
                <Button onClick={() => router.push(next)}>Ouvrir mon carnet</Button>
              )}
            </div>
          )}
        </div>
      </div>
      <p className={cn("mt-4 text-center text-[0.95rem] text-encre-douce", step === "found" && "hidden")}>
        Vous avez commandé sans compte ? Connectez-vous avec le même numéro : vos commandes seront retrouvées.
      </p>
    </section>
  );
}
