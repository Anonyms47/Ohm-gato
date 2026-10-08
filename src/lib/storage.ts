/**
 * Conseils de conservation (règle d'Alima). Conseils de qualité : aucune autre durée n'est inventée.
 * - Sauce, crème ou fruits : réfrigérateur, 2 jours maximum.
 * - Sans sauce, crème ni fruits : boîte hermétique à température ambiante, 2 jours maximum.
 * - Cake à l'orange : jusqu'à une semaine, correctement emballé, dans un endroit frais.
 */
export const STORAGE_RULES = ["refrigerated_48h", "ambient_airtight_48h", "cool_wrapped_1w"] as const;
export type StorageRule = (typeof STORAGE_RULES)[number];

export const storageText: Record<StorageRule, string> = {
  refrigerated_48h: "À conserver au réfrigérateur et à consommer sous 2 jours.",
  ambient_airtight_48h: "À conserver dans une boîte hermétique à température ambiante et à consommer sous 2 jours.",
  cool_wrapped_1w: "Peut être conservé jusqu'à une semaine, correctement emballé et gardé dans un endroit frais.",
};

/** Texte complet : règle + précision du produit (ex. « Peuvent être légèrement réchauffés… »). */
export function storageAdvice(rule: StorageRule, note: string | null): string {
  return note ? `${storageText[rule]} ${note}` : storageText[rule];
}
