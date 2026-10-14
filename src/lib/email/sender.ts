/** Expéditeur par défaut des e-mails de commande : adresse du domaine autorisée dans Brevo (modifiable par EMAIL_FROM). */
export const DEFAULT_EMAIL_FROM = "OHMEGATO <contact@ohmegato.com>";

/** « OHMEGATO <contact@ohmegato.com> » ou « contact@ohmegato.com » → nom et adresse séparés. */
export function parseSender(raw: string): { name?: string; email: string } {
  const match = raw.trim().match(/^(.*?)\s*<([^<>\s]+@[^<>\s]+)>$/);
  if (match) {
    const name = match[1]!.trim().replace(/^"(.*)"$/, "$1");
    return name ? { name, email: match[2]! } : { email: match[2]! };
  }
  return { email: raw.trim() };
}
