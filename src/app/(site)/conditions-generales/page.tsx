import { LegalPage, legalMetadata } from "@/components/legal/LegalPage";

export const metadata = legalMetadata("conditions-generales");

export default function Page() {
  return <LegalPage slug="conditions-generales" />;
}
