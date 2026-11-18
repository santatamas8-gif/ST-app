import { TEAM_SESSION_TIME_ZONE } from "@/lib/kioskRpe/localDate";

/** Club-local date and time when a wellness row was submitted. Admin display only. */
export function formatWellnessSubmittedAt(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: TEAM_SESSION_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return `Submitted ${formatted}`;
}
