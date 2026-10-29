"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { brand } from "@/config/brand";
import { cn } from "@/lib/cn";

/** Texte de consentement (le même est enregistré côté serveur avec la date et la source). */
const CONSENT = "J'accepte de recevoir un e-mail d'OHMEGATO à l'ouverture de la prochaine fournée. Je peux me désinscrire à tout moment.";
export const ALERT_WHATSAPP_MESSAGE = "Bonjour OHMEGATO 🤎 Je souhaite être prévenu(e) lors de l’ouverture de la prochaine fournée.";

type Source = "accueil" | "fournees" | "carte" | "pied_de_page" | "autre";

/**
 * « Prévenez-moi pour la prochaine fournée » : quand aucune fournée n'est ouverte.
 * WhatsApp : ouvre une conversation préremplie (l'inscription n'est pas automatique : OHMEGATO ajoute la personne
 * à sa liste de diffusion après réception du message). E-mail : vraie inscription avec consentement explicite.
 */
export function NextBatchAlert({ source, className }: { source: Source; className?: string }) {
  const [mode, setMode] = useState<"choix" | "email">("choix");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<{ message: string; field?: "email" | "consent" } | null>(null);
  const shownAt = useRef(0);
  const whatsappHref = `${brand.whatsappUrl}?text=${encodeURIComponent(ALERT_WHATSAPP_MESSAGE)}`;

  const submit = async () => {
    setError(null);
    if (!consent) return setError({ message: "Cochez la case pour accepter de recevoir l'alerte.", field: "consent" });
    setBusy(true);
    try {
      const response = await fetch("/api/alertes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent: true, source, website, shownAt: shownAt.current }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; field?: "email" | "consent" } | null;
      if (response.ok && body?.ok) setDone(true);
      else setError({ message: body?.message ?? "Inscription impossible pour le moment. Réessayez plus tard.", field: body?.field });
    } catch {
      setError({ message: "Connexion interrompue. Réessayez dans un instant." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby={`prevenez-${source}`} className={cn("rounded-[14px] border-2 border-chocolat bg-blanc-casse p-5 sm:p-6", className)} data-testid="prevenez-moi">
      <h2 id={`prevenez-${source}`} className="font-display text-[clamp(1.5rem,4vw,2rem)] leading-tight">
        Prévenez-moi pour la prochaine fournée
      </h2>
      <p className="mt-2 max-w-prose">
        Les fournées OHMEGATO sont ouvertes périodiquement, jamais en continu. Dites-nous comment vous prévenir dès l&apos;ouverture de la prochaine.
      </p>

      {done ? (
        <p role="status" className="mt-4 rounded-[10px] border-2 border-succes p-4 font-bold" data-testid="alerte-confirmation">
          C&apos;est noté. Vous recevrez un e-mail à l&apos;ouverture de la prochaine fournée. Vous pourrez vous désinscrire à tout moment depuis cet e-mail.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center rounded-[10px] bg-chocolat px-5 py-2 text-center font-bold text-creme shadow-[0_3px_0_var(--ohm-cacao)] hover:bg-cacao"
            >
              Être prévenu sur WhatsApp<span className="sr-only"> (nouvel onglet)</span>
            </a>
            <button
              type="button"
              aria-expanded={mode === "email"}
              aria-controls={`alerte-email-${source}`}
              onClick={() => {
                shownAt.current = Date.now();
                setMode("email");
              }}
              className="inline-flex min-h-12 items-center justify-center rounded-[10px] border-2 border-chocolat bg-creme px-5 py-2 text-center font-bold hover:bg-blanc-casse"
            >
              Être prévenu par e-mail
            </button>
          </div>
          <p className="text-[0.95rem] text-encre-douce">
            WhatsApp : un message est prêt à envoyer à OHMEGATO. L&apos;inscription n&apos;est pas automatique : OHMEGATO ajoutera votre numéro à sa liste de diffusion après réception de votre message.
          </p>

          {mode === "email" && (
            <form
              id={`alerte-email-${source}`}
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
              className="flex flex-col gap-4 rounded-[12px] border-2 border-dashed border-chocolat/40 p-4"
            >
              <Field label="Votre adresse e-mail" error={error?.field === "email" ? error.message : undefined}>
                {({ id, describedBy, invalid }) => (
                  <TextInput id={id} type="email" inputMode="email" autoComplete="email" required value={email} aria-describedby={describedBy} aria-invalid={invalid} onChange={(e) => setEmail(e.target.value)} />
                )}
              </Field>
              {/* Champ piège : invisible et ignoré des personnes, souvent rempli par les robots. */}
              <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label>
                  Ne pas remplir
                  <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
                </label>
              </div>
              <div>
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-describedby={error?.field === "consent" ? `alerte-consent-${source}` : undefined} className="mt-1 size-5 shrink-0 accent-chocolat" />
                  <span>{CONSENT}</span>
                </label>
                {error?.field === "consent" && (
                  <p id={`alerte-consent-${source}`} role="alert" className="mt-1 font-bold text-erreur">
                    {error.message}
                  </p>
                )}
              </div>
              {error && !error.field && (
                <p role="alert" className="font-bold text-erreur">
                  {error.message}
                </p>
              )}
              <Button type="submit" variant="primary" className="self-start" state={busy ? "loading" : "idle"} loadingLabel="Inscription…">
                Me prévenir par e-mail
              </Button>
              <p className="text-[0.95rem] text-encre-douce">Votre adresse sert uniquement à vous prévenir. Aucune adresse IP n&apos;est conservée.</p>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
