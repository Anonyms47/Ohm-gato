import Link from "next/link";
import { CoordinatesEditor, IdentityEditor, RefundDelayEditor, RetentionEditor } from "@/components/admin/LegalEditors";
import { IDENTITY_ALERT, IDENTITY_FIELDS, getLegalSettings, listLegalDocuments, missingIdentityFields } from "@/lib/admin/legal";
import { requireAdmin } from "@/lib/auth/session";
import { brand } from "@/config/brand";
import { formatLegalDate } from "@/lib/legal/documents";
import { formatSenegalPhone } from "@/lib/phone";

export const metadata = { title: "Documents et règles" };

export default async function AdminDocuments() {
  await requireAdmin();
  const [documents, settings] = await Promise.all([listLegalDocuments(), getLegalSettings()]);
  const missing = missingIdentityFields(settings.identity);
  return (
    <div className="flex max-w-4xl flex-col gap-10">
      <header>
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">Documents et règles</h1>
        <p className="text-encre-douce">
          Chaque publication crée une nouvelle version. Les commandes gardent la version acceptée au moment de l&apos;achat.
        </p>
      </header>

      {missing.length > 0 && (
        <section role="note" aria-labelledby="identite-alerte" className="rounded-[12px] border-2 border-erreur bg-blanc-casse p-4" data-testid="alerte-identite">
          <h2 id="identite-alerte" className="font-bold text-erreur">
            {IDENTITY_ALERT}
          </h2>
          <p className="mt-1 text-encre-douce">Champs manquants (visibles uniquement ici) : {missing.join(", ")}.</p>
        </section>
      )}

      <section aria-labelledby="documents" className="flex flex-col gap-3">
        <h2 id="documents" className="font-display text-[1.5rem]">
          Documents publiés
        </h2>
        <ul className="flex flex-col gap-3">
          {documents.map((d) => (
            <li key={d.slug} className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-blanc-casse p-4">
              <div className="min-w-0">
                <Link href={`/admin/documents/${d.slug}`} className="font-bold underline decoration-caramel decoration-2 underline-offset-4">
                  {d.title}
                </Link>
                <p className="text-encre-douce">
                  {d.published
                    ? `Version ${d.published.version} en ligne depuis le ${formatLegalDate(d.published.effectiveAt ?? d.published.publishedAt)}`
                    : "Aucune version publiée : la page est introuvable sur le site."}
                  {d.published && d.published.acceptances > 0 && ` · acceptée par ${d.published.acceptances} commande${d.published.acceptances > 1 ? "s" : ""}`}
                </p>
              </div>
              {d.draft && <span className="rounded-full bg-caramel/30 px-3 py-1 font-bold">Brouillon {d.draft.version}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="coordonnees" className="flex flex-col gap-3">
        <h2 id="coordonnees" className="font-display text-[1.5rem]">
          Coordonnées publiques
        </h2>
        <p className="text-encre-douce">Reprises automatiquement dans les pages légales.</p>
        <CoordinatesEditor
          initial={{
            email: settings.email || brand.email,
            phone: formatSenegalPhone(settings.phone || brand.phoneE164),
            pickupAddress: settings.pickupAddress || brand.pickupAddress,
          }}
        />
      </section>

      <section aria-labelledby="delais" className="flex flex-col gap-3">
        <h2 id="delais" className="font-display text-[1.5rem]">
          Délais affichés
        </h2>
        <p className="text-encre-douce">Un délai vide n&apos;est jamais affiché : aucun délai n&apos;est inventé.</p>
        <RefundDelayEditor initial={settings.refundDelay} />
        <h3 className="mt-4 font-bold">Durées de conservation des données</h3>
        <RetentionEditor initial={settings.retention} />
      </section>

      <section aria-labelledby="identite" className="flex flex-col gap-3">
        <h2 id="identite" className="font-display text-[1.5rem]">
          Identité légale (privée)
        </h2>
        <p className="text-encre-douce">
          Ces informations ne sont pas affichées sur le site. Elles serviront à compléter les mentions légales après la formalisation, une fois validées.
        </p>
        <IdentityEditor initial={{ ...settings.identity }} fields={IDENTITY_FIELDS} />
      </section>
    </div>
  );
}
