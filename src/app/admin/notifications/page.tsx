import type { Metadata } from "next";
import Link from "next/link";
import { MarkAllRead, NotificationLink, RunAutomationsButton } from "@/components/admin/AutomationEditors";
import { requireAdmin } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { formatShortDay, formatTime } from "@/lib/dates";
import { emailChannel } from "@/lib/email/outbox";
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
  const [list, pending, failed, lastRun] = await Promise.all([
    query,
    db.from("email_outbox").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("email_outbox").select("id", { count: "exact", head: true }).eq("status", "failed"),
    db.from("automation_runs").select("started_at, trigger").eq("job", "atelier").order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (list.error) throw list.error;
  const rows = (list.data ?? []) as NotificationRow[];
  const channel = emailChannel();

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

      <section aria-labelledby="automatismes" className="flex flex-col gap-3 rounded-[12px] border-2 border-chocolat/15 bg-blanc-casse p-5">
        <h2 id="automatismes" className="font-display text-[1.4rem]">
          Automatisations
        </h2>
        <ul className="flex flex-col gap-1">
          <li>
            Dernier passage :{" "}
            {lastRun.data ? `${formatShortDay(lastRun.data.started_at as string)} ${formatTime(lastRun.data.started_at as string)}` : "jamais"}
            {" · "}chaque jour à 6 h (heure de Dakar), à chaque visite de l&apos;atelier et après chaque action.
          </li>
          <li>
            E-mails aux clientes :{" "}
            {channel === "brevo" ? "envoyés par Brevo." : channel === "resend" ? "service d'envoi configuré." : channel === "test" ? "mode test (aucun e-mail réel n'est envoyé)." : <strong className="text-erreur">aucun service d&apos;envoi configuré : les e-mails restent en attente.</strong>}
          </li>
          <li>
            En attente : {pending.count ?? 0}
            {(failed.count ?? 0) > 0 && <strong className="text-erreur"> · en échec : {failed.count}</strong>}
          </li>
        </ul>
        <div>
          <RunAutomationsButton />
        </div>
        <Link href="/admin/reglages#automatisations" className="self-start font-bold underline decoration-caramel decoration-2 underline-offset-4">
          Régler les délais et les e-mails
        </Link>
      </section>
    </div>
  );
}
