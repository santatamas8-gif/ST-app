import { TEAM_SESSION_TIME_ZONE } from "@/lib/kioskRpe/localDate";
import { formatMatchdayTagDisplay, formatSessionTypeDisplay } from "@/lib/sessionDisplay";

export function formatKioskSessionDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return "—";
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatKioskSubmittedTime(submittedAt: string | null): string {
  if (!submittedAt) return "—";
  const date = new Date(submittedAt);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: TEAM_SESSION_TIME_ZONE,
  }).format(date);
}

export function formatKioskAverageRpe(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(1);
}

export function formatKioskDetailRpe(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(1).replace(/\.0$/, "");
}

export function formatKioskLoadAu(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value).toLocaleString("en-GB")} AU`;
}

export function formatKioskDurationMinutes(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value).toLocaleString("en-GB")} min`;
}

export function formatKioskSessionType(value: string | null): string {
  return formatSessionTypeDisplay(value);
}

export function formatKioskMatchdayTag(value: string | null): string {
  return formatMatchdayTagDisplay(value);
}
