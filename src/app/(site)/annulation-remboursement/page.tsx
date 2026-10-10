import { LegalPage, legalMetadata } from "@/components/legal/LegalPage";
import { getPublicSettings } from "@/lib/catalog";

export const metadata = legalMetadata("annulation-remboursement");

export default async function Page() {
  const settings = await getPublicSettings();
  const delay = typeof settings["legal.refund_delay"] === "string" ? (settings["legal.refund_delay"] as string).trim() : "";
  return (
    <LegalPage
      slug="annulation-remboursement"
      after={
        delay ? (
          <section aria-labelledby="delai-remboursement">
            <h2 id="delai-remboursement" className="scroll-mt-28 font-display text-[1.6rem]">
              Délai de remboursement
            </h2>
            <p className="mt-3 text-[1.0625rem]">{delay}</p>
          </section>
        ) : null
      }
    />
  );
}
