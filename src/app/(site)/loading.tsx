import { LoadingScreen } from "@/components/brand/LoadingScreen";

/** Affiché pendant le chargement d'une page du site (changement de page, première ouverture). */
export default function Loading() {
  return <LoadingScreen label="Chargement de la page…" />;
}
