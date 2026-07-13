/**
 * Consistent date formatting across the app (en-GB: day month).
 * Use these helpers so all dates look the same.
 */

/** "4 Mar" – day + short month, no year. Use in list headers, session by player. */
export function formatMonthDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    month: "short",
    day: "numeric",
  });
}

/** "Mon 4" – short weekday + day. Use in chart labels, short lists. */
export function formatDayShort(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
  });
}

/** "4 Mar 2025" – full date. Use for created_at, profile dates. */
export function formatDate(iso: string | null | undefined): string {
  if (iso == null || iso === "") return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
