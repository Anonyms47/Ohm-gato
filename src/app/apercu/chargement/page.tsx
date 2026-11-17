import type { Metadata } from "next";
import { LoadingOhmegato } from "@/components/brand/logo-morph/LoadingOhmegato";

// Aperçu isolé de l'écran de chargement (non branché sur le site, non indexé).
export const metadata: Metadata = {
  title: "Aperçu — écran de chargement",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <LoadingOhmegato />;
}
