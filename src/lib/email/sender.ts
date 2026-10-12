/** Expéditeur par défaut des e-mails de commande (adresse du domaine, à valider dans le service d'envoi). */
export const DEFAULT_EMAIL_FROM = "OHMEGATO <commandes@ohmegato.com>";

/** « OHMEGATO <commandes@ohmegato.com> » ou « commandes@ohmegato.com » → nom et adresse séparés. */
export function parseSender(raw: string): { name?: string; email: string } {
  const match = raw.trim().match(/^(.*?)\s*<([^<>\s]+@[^<>\s]+)>$/);
  if (match) {
    const name = match[1]!.trim().replace(/^"(.*)"$/, "$1");
    return name ? { name, email: match[2]! } : { email: match[2]! };
  }
  return { email: raw.trim() };
}
