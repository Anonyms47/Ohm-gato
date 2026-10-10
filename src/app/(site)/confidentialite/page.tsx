import { LegalPage, legalMetadata } from "@/components/legal/LegalPage";
import { getPublicSettings } from "@/lib/catalog";

export const metadata = legalMetadata("confidentialite");

const LABELS: Record<string, string> = {
  orders: "Commandes",
  accounts: "Comptes clients",
  custom_requests: "Demandes sur mesure",
};

export default async function Page() {
  const settings = await getPublicSettings();
  const retention = (settings["legal.retention"] ?? {}) as Record<string, unknown>;
  // Durées précises : affichées seulement une fois validées et renseignées dans l'administration.
  const rows = Object.entries(LABELS).flatMap(([key, label]) =>
    typeof retention[key] === "string" && (retention[key] as string).trim() ? [{ label, value: (retention[key] as string).trim() }] : [],
  );
  return (
    <LegalPage
      slug="confidentialite"
      after={
        rows.length > 0 ? (
          <section aria-labelledby="durees-conservation">
            <h2 id="durees-conservation" className="scroll-mt-28 font-display text-[1.6rem]">
              Durées de conservation précises
            </h2>
            <dl className="mt-3 flex flex-col gap-2 text-[1.0625rem]">
              {rows.map((row) => (
                <div key={row.label}>
                  <dt className="font-bold">{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null
      }
    />
  );
}
