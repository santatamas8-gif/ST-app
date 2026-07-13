import { getLocalDateString } from "@/lib/kioskRpe/localDate";
import type { SessionRow } from "@/lib/types";

/** Fixed display order for matchday groups (not alphabetical). */
export const MATCHDAY_TAG_ORDER = [
  "MD+4",
  "MD+3",
  "MD+2",
  "MD+1",
  "MD-4",
  "MD-3",
  "MD-2",
  "MD-1",
  "MD",
  "No tag",
] as const;

export type MatchdayTagLabel = (typeof MATCHDAY_TAG_ORDER)[number];

export const MAX_DATE_RANGE_DAYS = 365;

export const SESSION_TYPE_FILTER_OPTIONS = [
  "All session types",
  "Pitch",
  "Gym",
  "Recovery",
  "Rehab",
  "Individual",
  "Match",
  "Goalkeeper",
  "Extra",
] as const;

export type SessionTypeFilterOption = (typeof SESSION_TYPE_FILTER_OPTIONS)[number];

export type MatchdayAnalysisMode = "team" | "individual";

export type MatchdayAnalyticsRow = {
  tag: MatchdayTagLabel;
  sessionCount: number;
  uniquePlayerCount: number;
  averageRpe: number | null;
  averageDuration: number | null;
  averageLoad: number | null;
  totalLoad: number;
};

export type MatchdayChartMetric = "averageLoad" | "averageRpe" | "averageDuration";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseLocalDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function normalizeMatchdayTag(value?: string | null): MatchdayTagLabel {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "No tag";
  if ((MATCHDAY_TAG_ORDER as readonly string[]).includes(trimmed)) {
    return trimmed as MatchdayTagLabel;
  }
  return "No tag";
}

export function getDefaultDateRange(today: Date = new Date()): { from: string; to: string } {
  const to = getLocalDateString(today);
  const fromDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 28);
  return { from: getLocalDateString(fromDate), to };
}

export function validateDateRange(
  from: string,
  to: string
): { valid: true } | { valid: false; message: string } {
  if (!from.trim() || !to.trim()) {
    return { valid: false, message: "Both From and To dates are required." };
  }
  const fromDate = parseLocalDate(from);
  const toDate = parseLocalDate(to);
  if (!fromDate || !toDate) {
    return { valid: false, message: "Enter valid calendar dates (YYYY-MM-DD)." };
  }
  if (fromDate > toDate) {
    return { valid: false, message: "From date cannot be after To date." };
  }
  const daySpan =
    Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (daySpan > MAX_DATE_RANGE_DAYS) {
    return {
      valid: false,
      message: `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days.`,
    };
  }
  return { valid: true };
}

export function filterSessionsForMatchdayAnalysis(
  sessions: SessionRow[],
  options: {
    from: string;
    to: string;
    mode: MatchdayAnalysisMode;
    playerId?: string | null;
    sessionType: SessionTypeFilterOption;
  }
): SessionRow[] {
  return sessions.filter((session) => {
    if (session.date < options.from || session.date > options.to) return false;
    if (options.mode === "individual") {
      if (!options.playerId || session.user_id !== options.playerId) return false;
    }
    if (options.sessionType !== "All session types") {
      const type = (session.session_type ?? "").trim();
      if (type !== options.sessionType) return false;
    }
    return true;
  });
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildMatchdayAnalytics(sessions: SessionRow[]): MatchdayAnalyticsRow[] {
  const byTag = new Map<MatchdayTagLabel, SessionRow[]>();
  for (const tag of MATCHDAY_TAG_ORDER) {
    byTag.set(tag, []);
  }

  for (const session of sessions) {
    const tag = normalizeMatchdayTag(session.matchday_tag);
    byTag.get(tag)!.push(session);
  }

  const rows: MatchdayAnalyticsRow[] = [];
  for (const tag of MATCHDAY_TAG_ORDER) {
    const group = byTag.get(tag)!;
    if (group.length === 0) continue;

    const rpeValues = group.map((s) => s.rpe).filter(isFiniteNumber);
    const durationValues = group.map((s) => s.duration).filter(isFiniteNumber);
    const loadValues = group.map((s) => s.load).filter(isFiniteNumber);
    const uniquePlayers = new Set(group.map((s) => s.user_id));

    rows.push({
      tag,
      sessionCount: group.length,
      uniquePlayerCount: uniquePlayers.size,
      averageRpe: mean(rpeValues),
      averageDuration: mean(durationValues),
      averageLoad: mean(loadValues),
      totalLoad: group.reduce((sum, s) => sum + (isFiniteNumber(s.load) ? s.load : 0), 0),
    });
  }

  return rows;
}

export function sortMatchdayAnalyticsRows(rows: MatchdayAnalyticsRow[]): MatchdayAnalyticsRow[] {
  const order = new Map(MATCHDAY_TAG_ORDER.map((tag, index) => [tag, index]));
  return [...rows].sort(
    (a, b) => (order.get(a.tag) ?? 999) - (order.get(b.tag) ?? 999)
  );
}

export function formatAverageRpe(value: number | null): string {
  if (value == null) return "—";
  return value.toFixed(1);
}

export function formatAverageDuration(value: number | null): string {
  if (value == null) return "—";
  return Math.round(value).toString();
}

export function formatAverageLoad(value: number | null): string {
  if (value == null) return "—";
  return Math.round(value).toString();
}

export function formatTotalLoad(value: number): string {
  return Math.round(value).toString();
}

export function chartMetricValue(
  row: MatchdayAnalyticsRow,
  metric: MatchdayChartMetric
): number | null {
  switch (metric) {
    case "averageLoad":
      return row.averageLoad;
    case "averageRpe":
      return row.averageRpe;
    case "averageDuration":
      return row.averageDuration;
  }
}

export function chartMetricLabel(metric: MatchdayChartMetric): string {
  switch (metric) {
    case "averageLoad":
      return "Avg Load (AU)";
    case "averageRpe":
      return "Avg RPE";
    case "averageDuration":
      return "Avg Duration (min)";
  }
}
