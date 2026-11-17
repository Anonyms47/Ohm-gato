import type { Metadata } from "next";
import { LogoMorphPreview } from "./LogoMorphPreview";

// Scène de prévisualisation isolée (hors navigation du site, non indexée).
export const metadata: Metadata = {
  title: "Aperçu — morphing du logo",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <LogoMorphPreview />;
}
