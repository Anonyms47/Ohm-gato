/**
 * Numéros sénégalais : 9 chiffres après l'indicatif +221.
 * Mobiles : 70, 71, 72, 75, 76, 77, 78. Fixes : 33.
 */
const SENEGAL_PREFIXES = ["70", "71", "72", "75", "76", "77", "78", "33"] as const;

/** Renvoie le numéro au format E.164 (+221XXXXXXXXX) ou null s'il est invalide. */
export function normalizeSenegalPhone(input: string): string | null {
  let digits = input.replace(/[\s.\-()]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === 12 && digits.startsWith("221")) digits = digits.slice(3);
  if (digits.length !== 9) return null;
  if (!SENEGAL_PREFIXES.some((prefix) => digits.startsWith(prefix))) return null;
  return `+221${digits}`;
}

/** « +221 77 123 45 67 » */
export function formatSenegalPhone(e164: string): string {
  const local = e164.replace(/^\+221/, "");
  const match = /^(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(local);
  return match ? `+221 ${match[1]} ${match[2]} ${match[3]} ${match[4]}` : e164;
}
