/** Nettoie une saisie avant de l'injecter dans un filtre PostgREST (aucune syntaxe de filtre possible). */
export function cleanQuery(raw: string): string {
  return raw.replace(/[%,()*\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}
