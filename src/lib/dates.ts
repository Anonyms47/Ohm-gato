/** Dates affichées à l'heure de Dakar (UTC+0, sans heure d'été). */
const TIME_ZONE = "Africa/Dakar";

const dayFormatter = new Intl.DateTimeFormat("fr-SN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: TIME_ZONE,
});
const timeFormatter = new Intl.DateTimeFormat("fr-SN", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});
const shortFormatter = new Intl.DateTimeFormat("fr-SN", {
  day: "numeric",
  month: "short",
  timeZone: TIME_ZONE,
});

/** « jeudi 9 octobre » */
export function formatDay(value: string | Date): string {
  return dayFormatter.format(typeof value === "string" ? parseDate(value) : value);
}

/** « 08 h 00 » */
export function formatTime(value: string | Date): string {
  return timeFormatter.format(typeof value === "string" ? new Date(value) : value).replace(":", " h ");
}

export function formatShortDay(value: string | Date): string {
  return shortFormatter.format(typeof value === "string" ? parseDate(value) : value);
}

/** « jeudi 9 octobre, 08 h 00 – 10 h 00 » */
export function formatSlot(startsAt: string, endsAt: string): string {
  return `${formatDay(startsAt)}, ${formatTime(startsAt)} – ${formatTime(endsAt)}`;
}

/** Les dates seules (AAAA-MM-JJ) sont interprétées à midi pour éviter les décalages. */
export function parseDate(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
}
