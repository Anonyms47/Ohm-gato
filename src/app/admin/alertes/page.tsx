import Link from "next/link";
import { ActionButton, StatCard } from "@/components/admin/AdminUi";
import { getAlertsOverview } from "@/lib/admin/alerts";
import { processAlertsNow, retryBatchAlert, triggerBatchAlert, unsubscribeAlertSubscriber } from "@/app/admin/_actions/alerts";
import { requireAdmin } from "@/lib/auth/session";
import { formatShortDay, formatTime } from "@/lib/dates";
import { errorLabel } from "@/lib/email/delivery";
import { emailChannel, providerBlock } from "@/lib/email/outbox";

export const metadata = { title: "Alertes prochaine fournée" };

const SOURCES: Record<string, string> = {
  accueil: "Accueil",
  fournees: "Nos fournées",
  carte: "La carte",
  pied_de_page: "Pied de page",
  administration: "Administration",
  autre: "Autre",
};

export default async function AdminAlertes({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q = "" } = await searchParams;
  const [overview, channel] = await Promise.all([getAlertsOverview(q), Promise.resolve(emailChannel())]);
  const block = channel === "brevo" || channel === "resend" ? await providerBlock(channel) : null;
  const waiting = overview.history.reduce((n, a) => n + a.pending + a.held, 0);
  const cycle = overview.openCycle;
  const canTrigger = Boolean(cycle && !cycle.alertId && overview.active > 0);

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <div>
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">Alertes prochaine fournée</h1>
        <p className="mt-2 text-encre-douce">
          Les personnes inscrites par e-mail sont prévenues quand vous le décidez : rien n&apos;est envoyé automatiquement et une fournée n&apos;est annoncée qu&apos;une fois. Celles qui préfèrent
          WhatsApp vous écrivent : vous les ajoutez vous-même à votre liste de diffusion.
        </p>
      </div>

      {(channel === "none" || block) && (
        <p role="alert" className="rounded-[12px] border-2 border-erreur bg-blanc-casse p-4 font-bold text-erreur" data-testid="alerte-envoi">
          {channel === "none" ? "Aucun service d'e-mail n'est configuré." : `${errorLabel(block!.category)}.`} Les alertes déclenchées restent en attente et partiront après correction (voir{" "}
          <Link href="/admin/notifications" className="underline">
            Notifications
          </Link>
          ).
        </p>
      )}

      <section aria-labelledby="titre-etat" className="grid gap-4 sm:grid-cols-3">
        <h2 id="titre-etat" className="sr-only">
          État des inscriptions
        </h2>
        <StatCard label="Inscrits actifs" value={overview.active} />
        <StatCard label="Désinscrits" value={overview.inactive} />
        <StatCard label="Envois en attente ou en pause" value={waiting} tone={waiting > 0 ? "alert" : "default"} />
      </section>

      <section aria-labelledby="titre-declencher" className="atelier-ticket flex flex-col gap-3 p-5">
        <h2 id="titre-declencher" className="font-display text-[1.5rem]">
          Annoncer l&apos;ouverture
        </h2>
        {!cycle ? (
          <p>Aucune fournée n&apos;est ouverte. Ouvrez la fournée, puis revenez ici pour prévenir les inscrits.</p>
        ) : cycle.alertId ? (
          <p data-testid="alerte-deja-envoyee">L&apos;alerte de la fournée n°{cycle.number} a déjà été déclenchée : aucun second envoi n&apos;est possible.</p>
        ) : overview.active === 0 ? (
          <p>La fournée n°{cycle.number} est ouverte, mais il n&apos;y a aucun inscrit actif à prévenir.</p>
        ) : (
          <p>
            La fournée n°{cycle.number} est ouverte : {overview.active} personne{overview.active > 1 ? "s" : ""} peu{overview.active > 1 ? "vent" : "t"} être prévenue{overview.active > 1 ? "s" : ""}.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          {canTrigger && cycle && (
            <ActionButton
              label={`Prévenir les ${overview.active} inscrits`}
              variant="primary"
              run={() => triggerBatchAlert(cycle.id)}
              confirm={{
                title: `Prévenir ${overview.active} inscrit${overview.active > 1 ? "s" : ""} ?`,
                description: (
                  <p>
                    Un e-mail annonçant la fournée n°{cycle.number} (dates et lien vers la carte) sera envoyé à chaque inscrit actif. Cette action ne peut être faite qu&apos;une fois pour cette fournée.
                  </p>
                ),
                confirmLabel: "Oui, envoyer l'alerte",
              }}
            />
          )}
          {waiting > 0 && <ActionButton label="Envoyer les messages en attente" variant="secondary" run={processAlertsNow} />}
        </div>
      </section>

      <section aria-labelledby="titre-historique" className="flex flex-col gap-3">
        <h2 id="titre-historique" className="font-display text-[1.5rem]">
          Envois
        </h2>
        {overview.history.length === 0 ? (
          <p className="text-encre-douce">Aucune alerte envoyée pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {overview.history.map((a) => (
              <li key={a.id} className="rounded-[12px] border-2 border-chocolat/20 bg-blanc-casse p-4" data-testid="envoi-alerte">
                <p className="font-bold">
                  Fournée n°{a.cycleNumber ?? "?"} · {formatShortDay(a.createdAt)} à {formatTime(a.createdAt)} · {a.recipients} destinataire{a.recipients > 1 ? "s" : ""}
                </p>
                <p>
                  {a.sent} réussi{a.sent > 1 ? "s" : ""} · {a.pending} en attente · {a.held} en pause · {a.failed} en échec{a.skipped ? ` · ${a.skipped} ignoré${a.skipped > 1 ? "s" : ""}` : ""}
                </p>
                {a.lastError && <p className="font-bold text-erreur">Dernière erreur : {a.lastError}</p>}
                {(a.held > 0 || a.failed > 0) && <ActionButton className="mt-2" label="Reprendre les envois en pause ou en échec" variant="secondary" run={() => retryBatchAlert(a.id)} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="titre-inscrits" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="titre-inscrits" className="font-display text-[1.5rem]">
            Inscrits
          </h2>
          <a href="/admin/alertes/export" className="inline-flex min-h-11 items-center font-bold underline decoration-caramel decoration-2 underline-offset-4">
            Exporter la liste (CSV)
          </a>
        </div>
        <form method="get" className="flex flex-wrap items-end gap-3" role="search">
          <label className="flex flex-col gap-1.5 font-bold">
            Rechercher une adresse
            <input name="q" defaultValue={q} type="search" maxLength={80} className="min-h-12 w-72 max-w-full rounded-[10px] border-2 border-chocolat/35 bg-blanc-casse px-4 font-normal" />
          </label>
          <button type="submit" className="min-h-12 rounded-[10px] border-2 border-chocolat bg-creme px-5 font-bold">
            Rechercher
          </button>
        </form>
        {overview.subscribers.length === 0 ? (
          <p className="text-encre-douce">{q ? "Aucune adresse ne correspond." : "Aucun inscrit pour l'instant."}</p>
        ) : (
          <ul className="flex flex-col divide-y-2 divide-dashed divide-chocolat/15 rounded-[12px] border-2 border-chocolat/15 bg-blanc-casse">
            {overview.subscribers.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" data-testid="inscrit">
                <div>
                  <p className="font-bold break-all">{s.email}</p>
                  <p className="text-[0.95rem] text-encre-douce">
                    {s.status === "active" ? "Actif" : `Désinscrit${s.unsubscribedAt ? ` le ${formatShortDay(s.unsubscribedAt)}` : ""}${s.unsubscribedBy === "administration" ? " (par l'équipe)" : ""}`} · {SOURCES[s.source] ?? s.source} · consentement du{" "}
                    {formatShortDay(s.consentAt)}
                  </p>
                </div>
                {s.status === "active" && (
                  <ActionButton
                    label="Désinscrire"
                    variant="destructive"
                    run={() => unsubscribeAlertSubscriber(s.id)}
                    confirm={{ title: "Désinscrire cette personne ?", description: <p>{s.email} ne recevra plus d&apos;alerte d&apos;ouverture de fournée.</p>, destructive: true }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        {overview.truncated && <p className="text-encre-douce">Seuls les 50 premiers résultats sont affichés : précisez la recherche ou exportez la liste.</p>}
      </section>
    </div>
  );
}
