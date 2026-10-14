import type { Metadata } from "next";
import Link from "next/link";
import { EmailIssueList, MarkAllRead, NotificationLink, RunAutomationsButton, TestEmailConnectionButton } from "@/components/admin/AutomationEditors";
import { requireAdmin } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { formatShortDay, formatTime } from "@/lib/dates";
import { getEmailHealth, templateLabel } from "@/lib/email/health";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Notifications" };

type Tab = "non-lues" | "importantes" | "terminees";
const TABS: { key: Tab; label: string }[] = [
  { key: "non-lues", label: "Non lues" },
  { key: "importantes", label: "Importantes" },
  { key: "terminees", label: "Terminées" },
];

const priorityLabel: Record<string, string> = { urgent: "Urgent", today: "Aujourd'hui", soon: "Bientôt", info: "À l'occasion" };

interface NotificationRow {
  id: number;
  priority: string;
  title: string;
  detail: string | null;
  href: string;
  created_at: string;
  read_at: string | null;
  done_at: string | null;
}

/** Centre de notifications : uniquement des actions nécessaires, chacune mène à l'élément concerné. */
export default async function Notifications({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  await requireAdmin();
  const { onglet } = await searchParams;
  const tab: Tab = onglet === "importantes" || onglet === "terminees" ? onglet : "non-lues";
  const db = supabaseAdmin();
  let query = db.from("admin_notifications").select("id, priority, title, detail, href, created_at, read_at, done_at").order("created_at", { ascending: false }).limit(60);
  if (tab === "non-lues") query = query.is("done_at", null).is("read_at", null);
  if (tab === "importantes") query = query.is("done_at", null).in("priority", ["urgent", "today"]);
  if (tab === "terminees") query = query.not("done_at", "is", null);
  const [list, health, lastRun] = await Promise.all([
    query,
    getEmailHealth(),
    db.from("automation_runs").select("started_at, trigger").eq("job", "atelier").order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (list.error) throw list.error;
  const rows = (list.data ?? []) as NotificationRow[];
  const when = (iso: string | null) => (iso ? `${formatShortDay(iso)} à ${formatTime(iso)}` : "jamais");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">Notifications</h1>
        <p className="text-encre-douce">Seulement ce qui demande une action. Une notification se termine d&apos;elle-même quand l&apos;action n&apos;est plus nécessaire.</p>
      </header>

      <nav aria-label="Filtrer les notifications" className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/notifications?onglet=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn("inline-flex min-h-11 items-center rounded-full border-2 px-4 font-bold", tab === t.key ? "border-chocolat bg-chocolat text-creme" : "border-chocolat/30 bg-blanc-casse")}
          >
            {t.label}
          </Link>
        ))}
        {tab === "non-lues" && rows.length > 0 && (
          <span className="ml-auto">
            <MarkAllRead />
          </span>
        )}
      </nav>

      {rows.length === 0 ? (
        <p className="atelier-ticket p-5">{tab === "terminees" ? "Aucune notification terminée pour le moment." : "Rien à signaler : aucune action n'attend."}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((n) => (
            <li key={n.id} className={cn("atelier-ticket flex flex-col gap-3 p-4 sm:flex-row sm:items-center", !n.read_at && !n.done_at && "border-l-[6px] border-l-caramel")}>
              <div className="min-w-0 flex-1">
                <p className="text-[0.82rem] font-bold uppercase tracking-[0.1em] text-encre-douce">
                  {priorityLabel[n.priority] ?? n.priority} · {formatShortDay(n.created_at)} {formatTime(n.created_at)}
                  {n.done_at ? " · terminée" : n.read_at ? " · lue" : ""}
                </p>
                <p className="font-bold">{n.title}</p>
                {n.detail && <p className="text-encre-douce">{n.detail}</p>}
              </div>
              {!n.done_at && (
                <NotificationLink id={n.id} href={n.href} unread={!n.read_at}>
                  Ouvrir
                </NotificationLink>
              )}
            </li>
          ))}
        </ul>
      )}

      <section id="emails" aria-labelledby="titre-emails" className="flex scroll-mt-24 flex-col gap-4 rounded-[12px] border-2 border-chocolat/15 bg-blanc-casse p-5">
        <h2 id="titre-emails" className="font-display text-[1.4rem]">
          État des e-mails
        </h2>
        {health.blocked && (
          <p role="alert" className="rounded-[10px] border-l-[6px] border-l-erreur bg-erreur/10 p-3 font-bold">
            Les e-mails aux clientes ne partent plus : {health.blocked.label}. Les messages attendent, rien n&apos;est perdu.
          </p>
        )}
        {health.channel === "test" ? (
          <p>Service d&apos;envoi : mode test (aucun e-mail réel n&apos;est envoyé, boîte de test).</p>
        ) : (
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2" data-testid="etat-emails">
            <div>
              <dt className="text-[0.82rem] font-bold uppercase tracking-[0.1em] text-encre-douce">API Brevo configurée</dt>
              <dd>{health.channel === "brevo" ? "Oui" : health.channel === "resend" ? "Non (service de secours utilisé)" : "Non"}</dd>
            </div>
            <div>
              <dt className="text-[0.82rem] font-bold uppercase tracking-[0.1em] text-encre-douce">Expéditeur</dt>
              <dd className="break-words">{health.sender}</dd>
            </div>
            <div>
              <dt className="text-[0.82rem] font-bold uppercase tracking-[0.1em] text-encre-douce">Dernier test réussi</dt>
              <dd>{when(health.lastTestOkAt)}</dd>
            </div>
            <div>
              <dt className="text-[0.82rem] font-bold uppercase tracking-[0.1em] text-encre-douce">Dernier envoi réussi</dt>
              <dd>{when(health.lastSentAt)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[0.82rem] font-bold uppercase tracking-[0.1em] text-encre-douce">Dernier échec</dt>
              <dd>{health.lastFailure ? `${when(health.lastFailure.at)} : ${health.lastFailure.label}` : "aucun"}</dd>
            </div>
          </dl>
        )}
        <ul className="flex flex-wrap gap-x-6 gap-y-1 font-bold">
          <li>En attente : {health.waiting}</li>
          <li>En pause : {health.held}</li>
          <li className={cn(health.failed > 0 && "text-erreur")}>Échecs définitifs : {health.failed}</li>
        </ul>
        <div className="flex flex-wrap items-start gap-3">
          <TestEmailConnectionButton />
          <RunAutomationsButton />
        </div>
        {health.issues.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="font-bold">Messages à reprendre ou abandonner</h3>
            <EmailIssueList
              issues={health.issues.map((i) => ({
                id: i.id,
                title: `${templateLabel(i.template)}${i.orderReference ? ` · ${i.orderReference}` : ""}`,
                detail: `${i.status === "held" ? "En pause" : "Échec"} : ${i.label} (créé ${when(i.createdAt)}).`,
                href: i.orderId ? `/admin/commandes/${i.orderId}` : null,
              }))}
            />
          </div>
        )}
        <p className="text-encre-douce">
          Dernier passage automatique : {lastRun.data ? when(lastRun.data.started_at as string) : "jamais"} · chaque jour à 6 h (heure de Dakar), à chaque visite de
          l&apos;atelier et après chaque action. Les e-mails ne sont envoyés qu&apos;aux clientes qui ont donné leur adresse ; les autres gardent leur lien
          personnel de suivi.
        </p>
        <Link href="/admin/reglages#automatisations" className="self-start font-bold underline decoration-caramel decoration-2 underline-offset-4">
          Régler les délais et les e-mails
        </Link>
      </section>
    </div>
  );
}
