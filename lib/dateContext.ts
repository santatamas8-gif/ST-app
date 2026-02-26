/**
 * Returns a short label for date context: (today), (yesterday), (tomorrow) or "".
 * Use next to displayed dates so users see at a glance which day it is.
 */
export function getDateContextLabel(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (dateStr === today) return " (today)";
  const d = new Date(today);
  d.setDate(d.getDate() - 1);
  if (dateStr === d.toISOString().slice(0, 10)) return " (yesterday)";
  d.setDate(d.getDate() + 2);
  if (dateStr === d.toISOString().slice(0, 10)) return " (tomorrow)";
  return "";
}
