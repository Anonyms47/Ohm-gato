import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/AdminUi";
import { LegalDraftEditor } from "@/components/admin/LegalEditors";
import { restoreLegalVersion } from "@/app/admin/_actions/legal";
import { getLegalDocumentAdmin, recentAcceptances } from "@/lib/admin/legal";
import { requireAdmin } from "@/lib/auth/session";
import { ACCEPTED_AT_CHECKOUT, formatLegalDate, getLegalVariables } from "@/lib/legal/documents";

const STATUS_LABEL = { draft: "Brouillon", published: "En ligne", archived: "Archivée" } as const;

export default async function AdminDocument({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  const [document, variables] = await Promise.all([getLegalDocumentAdmin(slug), getLegalVariables()]);
  if (!document) notFound();
  const accepted = (ACCEPTED_AT_CHECKOUT as readonly string[]).includes(document.slug);
  const recent = accepted && document.published ? await recentAcceptances(document.published.id) : [];
  const highest = document.versions.filter((v) => v.status !== "draft")[0]?.version ?? "0.0";
  const [major, minor] = highest.split(".").map(Number) as [number, number];
  const base = document.published ?? document.versions[0];

  return (
    <div className="flex max-w-5xl flex-col gap-8">
      <header>
        <Link href="/admin/documents" className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
          ← Documents et règles
        </Link>
        <h1 className="mt-2 font-display text-[clamp(1.8rem,4vw,2.4rem)]">{document.title}</h1>
        <p className="text-encre-douce">
          {document.published ? (
            <>
              Version {document.published.version} en ligne ·{" "}
              <a href={`/${document.slug}`} target="_blank" rel="noopener" className="underline underline-offset-4">
                voir la page publique
              </a>
            </>
          ) : (
            "Aucune version en ligne."
          )}
        </p>
      </header>

      <section aria-labelledby="brouillon" className="flex flex-col gap-3 rounded-[12px] bg-blanc-casse p-4 sm:p-5">
        <h2 id="brouillon" className="font-display text-[1.5rem]">
          {document.draft ? `Brouillon ${document.draft.version}` : "Préparer une nouvelle version"}
        </h2>
        <LegalDraftEditor
          key={document.draft ? `${document.draft.id}-${document.draft.updatedAt}` : "nouveau"}
          slug={document.slug}
          draft={document.draft}
          suggestedVersion={`${major}.${minor + 1}`}
          fallback={{ title: base?.title ?? document.title, content: base?.content ?? "" }}
          variables={variables}
        />
      </section>

      <section aria-labelledby="historique" className="flex flex-col gap-3">
        <h2 id="historique" className="font-display text-[1.5rem]">
          Historique des versions
        </h2>
        <ul className="flex flex-col gap-2">
          {document.versions.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] bg-blanc-casse p-3" data-testid={`version-${v.version}`}>
              <div className="min-w-0">
                <p>
                  <strong>Version {v.version}</strong> · {STATUS_LABEL[v.status]}
                  {v.publishedAt && ` · publiée le ${formatLegalDate(v.publishedAt)}`}
                  {v.effectiveAt && ` · en vigueur le ${formatLegalDate(v.effectiveAt)}`}
                </p>
                <p className="text-[0.95rem] text-encre-douce">
                  Modifiée le {formatLegalDate(v.updatedAt)}
                  {v.updatedBy && ` par ${v.updatedBy}`}
                  {accepted && ` · ${v.acceptances} commande${v.acceptances > 1 ? "s" : ""}`} · empreinte {v.contentHash.slice(0, 12)}
                </p>
              </div>
              {v.status !== "draft" && (
                <ActionButton
                  label="Reprendre ce texte"
                  variant="text"
                  run={restoreLegalVersion.bind(null, v.id)}
                  confirm={{
                    title: `Reprendre la version ${v.version} ?`,
                    description: <p>Son texte remplace le brouillon en cours. Il faudra le publier pour qu&apos;il soit en ligne, sous un nouveau numéro.</p>,
                    confirmLabel: "Reprendre",
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      </section>

      {accepted && (
        <section aria-labelledby="acceptations" className="flex flex-col gap-3">
          <h2 id="acceptations" className="font-display text-[1.5rem]">
            Dernières commandes ayant accepté la version en ligne
          </h2>
          {recent.length === 0 ? (
            <p className="text-encre-douce">Aucune commande pour le moment.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {recent.map((r) => (
                <li key={r.orderId}>
                  <Link href={`/admin/commandes/${r.orderId}`} className="font-bold underline underline-offset-4">
                    {r.reference}
                  </Link>{" "}
                  · {formatLegalDate(r.acceptedAt)}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
