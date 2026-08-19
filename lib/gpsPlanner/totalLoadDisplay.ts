/**
 * Total Load presentation helpers.
 * Display-only — never persist rounded values; never recompute Total / % / ranking.
 */

import { formatPlannerDisplayAbsoluteOrDash } from "@/lib/gpsPlanner/uiDisplay";
import type { DailyPlanPctSummary, DailyPlanSharedPct } from "@/lib/gpsPlanner/types";
import type {
  TotalLoadMatchQuality,
  TotalLoadPlayerRow,
  TotalLoadQuality,
} from "@/lib/gpsPlanner/totalLoadAggregation";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function parseIso(iso: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/** GPS match duration as total minutes:seconds. Null → "—". 0 → "0:00". */
export function formatMatchDurationSeconds(
  seconds: number | null | undefined
): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";
  const total = Math.trunc(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/** Table display: nearest whole minute. Null → "—". 0 → "0". Does not change stored seconds. */
export function formatMatchTimeMinutes(
  seconds: number | null | undefined
): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";
  return String(Math.round(Math.trunc(seconds) / 60));
}

/** Whole-percentage display. Null → "—". Domain value is not mutated. */
export function formatTotalLoadPercent(
  value: number | null | undefined
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}%`;
}

export function formatWeeklyPlanSharedPct(value: DailyPlanSharedPct): string {
  if (value === "Mixed") return "Mixed";
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}%`;
}

export function formatWeeklyPlanSummaryLine(
  summary: DailyPlanPctSummary
): string {
  return [
    `TD ${formatWeeklyPlanSharedPct(summary.td)}`,
    `HSR ${formatWeeklyPlanSharedPct(summary.hsr)}`,
    `Sprint ${formatWeeklyPlanSharedPct(summary.sprint)}`,
    `Acc ${formatWeeklyPlanSharedPct(summary.acc)}`,
    `Dec ${formatWeeklyPlanSharedPct(summary.dec)}`,
  ].join(" | ");
}

export function formatCompactIsoDate(iso: string): string {
  const parts = parseIso(iso);
  if (!parts) return iso;
  return `${parts.day} ${MONTHS[parts.month - 1]} ${parts.year}`;
}

export function formatCompactDateRange(startIso: string, endIso: string): string {
  const start = parseIso(startIso);
  const end = parseIso(endIso);
  if (!start || !end) return `${startIso} – ${endIso}`;
  if (start.year === end.year && start.month === end.month) {
    return `${start.day}–${end.day} ${MONTHS[start.month - 1]} ${start.year}`;
  }
  if (start.year === end.year) {
    return `${start.day} ${MONTHS[start.month - 1]} – ${end.day} ${MONTHS[end.month - 1]} ${start.year}`;
  }
  return `${formatCompactIsoDate(startIso)} – ${formatCompactIsoDate(endIso)}`;
}

export type TotalLoadQualityBadge = "Complete" | "Partial" | "Data issue";

export function formatTotalLoadQualityBadge(
  quality: TotalLoadQuality
): TotalLoadQualityBadge | null {
  switch (quality) {
    case "complete":
      return "Complete";
    case "partial":
      return "Partial";
    case "unsafe":
      return "Data issue";
    case "match_not_selected":
      return null;
  }
}

export function totalLoadCellValue(
  row: TotalLoadPlayerRow,
  field: keyof NonNullable<TotalLoadPlayerRow["total"]["metrics"]>
): number | null {
  return row.total.metrics?.[field] ?? null;
}

export function totalLoadCellPercent(
  row: TotalLoadPlayerRow,
  field: keyof NonNullable<TotalLoadPlayerRow["total"]["percentages"]>
): number | null {
  return row.total.percentages?.[field] ?? null;
}

export type TotalLoadMetricField =
  keyof NonNullable<TotalLoadPlayerRow["total"]["metrics"]>;

/** Display-only table order. Does not recompute totals, %, or Top Values. */
export function sortTotalLoadRowsByTotal(
  rows: TotalLoadPlayerRow[],
  field: TotalLoadMetricField,
  direction: "desc" | "asc"
): TotalLoadPlayerRow[] {
  return [...rows].sort((a, b) => {
    const av = totalLoadCellValue(a, field);
    const bv = totalLoadCellValue(b, field);
    if (av == null && bv == null) {
      return a.playerDisplayName.localeCompare(b.playerDisplayName);
    }
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av !== bv) return direction === "desc" ? bv - av : av - bv;
    return a.playerDisplayName.localeCompare(b.playerDisplayName);
  });
}

function unsafeReason(
  quality: TotalLoadQuality,
  matchQuality: TotalLoadMatchQuality
): string {
  if (quality !== "unsafe") return "";
  if (matchQuality === "match_ambiguous") {
    return "Match GPS is ambiguous for this player. Total Week is unavailable.";
  }
  if (matchQuality === "match_query_error") {
    return "Match GPS is unavailable for this player. Total Week is unavailable.";
  }
  if (matchQuality === "data_issue") {
    return "Match GPS has a data issue for this player. Total Week is unavailable.";
  }
  if (matchQuality === "match_not_selected") {
    return "Select the official match to calculate Total Load.";
  }
  return "Training or Match GPS is incomplete. Total Week is unavailable.";
}

export function formatTotalLoadMetricBreakdown(input: {
  quality: TotalLoadQuality;
  trainingValue: number | null;
  matchValue: number | null;
  totalValue: number | null;
  matchQuality: TotalLoadMatchQuality;
}): string {
  if (input.quality === "unsafe" || input.quality === "match_not_selected") {
    return unsafeReason(input.quality, input.matchQuality);
  }

  const training = formatPlannerDisplayAbsoluteOrDash(input.trainingValue);
  const match = formatPlannerDisplayAbsoluteOrDash(input.matchValue);
  const total = formatPlannerDisplayAbsoluteOrDash(input.totalValue);
  const trainingLabel =
    input.quality === "partial" ? `Training: ${training} (Partial)` : `Training: ${training}`;

  return `${trainingLabel}\nMatch: ${match}\nTotal: ${total}`;
}
