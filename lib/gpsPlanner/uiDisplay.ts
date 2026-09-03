/**
 * Pure GPS Planner UI display helpers.
 * Display-only — never persist rounded values; never invent formulas.
 */

import {
  comparePlannerIsoDates,
  dateInInclusiveRange,
  type PlannerWeekStatus,
} from "@/lib/gpsPlanner/common";
import type { DayActualStatus } from "@/lib/gpsPlanner/types";

export type PlannerMetricKey = "td" | "hsr" | "sprint" | "acc" | "dec";

/** Round for display only. Do not persist. */
export function formatPlannerDisplayAbsolute(n: number): number {
  return Math.round(n);
}

export function formatMetricUnit(metric: PlannerMetricKey): string {
  return metric === "acc" || metric === "dec" ? "count" : "m";
}

export type AllocationStatusLabel = {
  kind: "remaining" | "full" | "over";
  text: string;
};

/** Remaining to Allocate = Weekly % − SUM(Daily %). Sign drives label only. */
export function allocationStatusLabel(remainingPct: number): AllocationStatusLabel {
  if (remainingPct > 0) {
    return {
      kind: "remaining",
      text: `${remainingPct}% remaining`,
    };
  }
  if (remainingPct < 0) {
    return {
      kind: "over",
      text: `${Math.abs(remainingPct)}% over-allocated`,
    };
  }
  return { kind: "full", text: "Fully allocated" };
}

/** Organizational week-status labels only — V1 does not lock editing. */
export const WEEK_STATUS_HELP: Record<
  PlannerWeekStatus,
  { label: string; meaning: string }
> = {
  draft: {
    label: "Draft",
    meaning: "Planning / not finalized yet",
  },
  active: {
    label: "Active",
    meaning: "Current week in use",
  },
  closed: {
    label: "Closed",
    meaning: "Week finished / historical",
  },
};

export const WEEK_STATUS_ORG_NOTE =
  "Status is an organizational label only — it does not lock editing or change calculations.";

/** Humanize progress day Actual status enums for Admin coaches. */
export function formatProgressDayStatus(status: DayActualStatus): string {
  switch (status) {
    case "actual_found":
      return "Found";
    case "actual_not_found":
      return "No data";
    case "actual_ambiguous":
      return "Ambiguous (not summed)";
    case "actual_error":
      return "Unavailable";
    case "actual_incomplete":
      return "Incomplete";
    default:
      return "Unavailable";
  }
}

export type BulkApplyOutcomeStatus = "created" | "updated" | "failed";

/** Display-only bulk apply outcome label (Weekly / Daily). */
export function formatBulkApplyOutcomeStatus(
  status: BulkApplyOutcomeStatus
): { mark: string; label: string; tone: "ok" | "fail" } {
  if (status === "failed") {
    return { mark: "!", label: "Failed", tone: "fail" };
  }
  if (status === "created") {
    return { mark: "✓", label: "Created", tone: "ok" };
  }
  return { mark: "✓", label: "Updated", tone: "ok" };
}

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "Admin access required.",
  invalid_input: "Please check the entered values.",
  database_error: "Could not complete this planner action. Try again.",
  week_not_found: "Planner week was not found.",
  duplicate_week: "A week with this Power BI Week ID and start date already exists.",
  invalid_date_range: "End date must be on or after start date.",
  invalid_week_type: "Week type must be deload, maintaining, or overload.",
  invalid_week_status: "Week status must be draft, active, or closed.",
  invalid_overload_focus:
    "Overload focus is only allowed for overload weeks (and must use valid metrics).",
  confirmation_required: "Please confirm this destructive action.",
  week_range_conflict:
    "Cannot change week dates: existing week days would fall outside the new range.",
  day_not_found: "Week day was not found.",
  day_outside_week: "Day date must fall within the planner week.",
  duplicate_day_date: "This week already has a day on that date.",
  duplicate_display_order: "This week already has a day with that order.",
  invalid_md_tag: "MD tag is required.",
  invalid_display_order: "Order must be a whole number ≥ 0.",
  group_not_found: "Group was not found.",
  duplicate_group_name: "A group with this name already exists in the week.",
  player_not_found: "Player was not found.",
  not_a_player: "Selected profile is not a player.",
  member_already_exists: "Player is already in this group.",
  member_not_found: "Group member was not found.",
  mapping_not_found:
    "Power BI mapping not set — map the player before creating a Weekly Target",
  mapping_changed: "Power BI player mapping changed unexpectedly.",
  player_already_mapped: "This ST-AMS player already has a Power BI mapping.",
  external_player_already_mapped:
    "This Power BI player is already mapped to another ST-AMS player.",
  external_player_not_found:
    "Selected Power BI player was not found in GPS_Log or Match Best.",
  match_best_not_found: "Match Best not found in Power BI",
  match_best_ambiguous: "Match Best is ambiguous in Power BI for this player.",
  match_best_incomplete: "Match Best from Power BI is incomplete for this player.",
  powerbi_error: "Power BI request failed. Try again later.",
  weekly_target_not_found: "Weekly Target not found",
  weekly_target_already_exists: "A weekly target already exists for this player in this week.",
  invalid_percentage: "Percentages must be numbers ≥ 0 (no upper bound).",
  daily_target_not_found: "Daily target was not found.",
  daily_target_already_exists: "A daily target already exists for this day and player.",
  actual_not_found: "No training Actual found in Power BI for this day.",
  actual_ambiguous: "Multiple training Actual rows found — not summed.",
  actual_incomplete: "Actual from Power BI is incomplete for this day.",
  invalid_date: "Date must be YYYY-MM-DD.",
  official_match_not_found: "Official match was not found for this planner week.",
  official_match_already_exists:
    "An official match is already selected for this planner week.",
  official_match_ambiguous:
    "Expected at most one official match for this planner week.",
  official_match_duplicate_order:
    "A match with this order already exists for this planner week.",
  official_match_duplicate_date:
    "A match with this GPS date already exists for this planner week.",
  stale_plan:
    "The selected plan is no longer available or has changed. Reload and choose again.",
};

export function plannerErrorMessage(code: string, fallback?: string): string {
  return ERROR_MESSAGES[code] ?? fallback ?? "Something went wrong with the planner.";
}

/**
 * Default through-date for weekly progress: today clamped into [weekStart, weekEnd].
 */
export function defaultThroughDate(
  weekStart: string,
  weekEnd: string,
  todayIso: string
): string {
  if (dateInInclusiveRange(todayIso, weekStart, weekEnd)) return todayIso;
  if (comparePlannerIsoDates(todayIso, weekStart) < 0) return weekStart;
  return weekEnd;
}

/**
 * When Review Week changes, through-date must be valid for the NEW week.
 * Same week: keep previous through-date if still in range; otherwise clamp.
 */
export function resolveReviewThroughDateForWeek(params: {
  previousWeekId: string;
  nextWeekId: string;
  previousThroughDate: string;
  nextWeekStart: string;
  nextWeekEnd: string;
  todayIso: string;
}): string {
  const {
    previousWeekId,
    nextWeekId,
    previousThroughDate,
    nextWeekStart,
    nextWeekEnd,
    todayIso,
  } = params;
  if (
    previousWeekId === nextWeekId &&
    previousThroughDate &&
    dateInInclusiveRange(previousThroughDate, nextWeekStart, nextWeekEnd)
  ) {
    return previousThroughDate;
  }
  return defaultThroughDate(nextWeekStart, nextWeekEnd, todayIso);
}

/**
 * Keep selected Review day if it belongs to the loaded week days; else first day.
 */
export function resolveReviewDayIdForWeekDays(
  previousDayId: string,
  dayIds: string[]
): string {
  if (previousDayId && dayIds.includes(previousDayId)) return previousDayId;
  return dayIds[0] ?? "";
}

/** Reference ranges only — never auto-fill Weekly Target %. */
export const WEEKLY_BENCHMARK_REFERENCE = {
  label: "Reference only",
  ranges: {
    deload: {
      td: "120–150%",
      hsr: "60–100%",
      sprint: "60–100%",
      acc: "200%",
      dec: "200%",
    },
    maintaining: {
      td: "200–250%",
      hsr: "100–150%",
      sprint: "100–150%",
      acc: "300%",
      dec: "300%",
    },
    overload: {
      td: "250–300%",
      hsr: "200%",
      sprint: "200%",
      acc: "350–400%",
      dec: "300–400%",
    },
  },
} as const;

export function formatWeekOptionLabel(
  powerBiWeekId: string,
  startDate: string,
  endDate: string
): string {
  return `${powerBiWeekId} · ${startDate} – ${endDate}`;
}

/**
 * Signed Planned − Actual display (To Target / Difference).
 * Null → "—". Positive includes "+". Display rounding only.
 */
export function formatPlannerDisplaySignedAbsolute(
  n: number | null | undefined
): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const rounded = formatPlannerDisplayAbsolute(n);
  if (rounded > 0) return `+${rounded.toLocaleString("en-US")}`;
  return rounded.toLocaleString("en-US");
}

/** Unsigned absolute display with locale separators; null → "—". */
export function formatPlannerDisplayAbsoluteOrDash(
  n: number | null | undefined
): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return formatPlannerDisplayAbsolute(n).toLocaleString("en-US");
}

export type ReviewActualQualityLabel =
  | "Complete"
  | "Incomplete"
  | "No data"
  | "Data issue"
  | "Unavailable";

/**
 * Coach-facing Weekly Review Actual quality from existing progress completeness.
 * Plan compliance only — not injury/risk language.
 */
export function formatWeeklyReviewActualQuality(input: {
  actualCompleteness: "complete" | "partial_not_found" | "incomplete";
  includedDays: number;
  foundDays: number;
  notFoundDays: number;
  problematicDays: number;
}): ReviewActualQualityLabel {
  const {
    actualCompleteness,
    includedDays,
    foundDays,
    notFoundDays,
    problematicDays,
  } = input;
  if (includedDays === 0) return "No data";
  if (foundDays === 0 && notFoundDays === includedDays) return "No data";
  if (actualCompleteness === "incomplete" || problematicDays > 0) {
    return "Data issue";
  }
  if (actualCompleteness === "complete") return "Complete";
  return "Incomplete";
}

/** Daily Review Actual status → coach label (reuses day semantics). */
export function formatDailyReviewActualQuality(
  status: DayActualStatus | null
): ReviewActualQualityLabel {
  if (status == null) return "No data";
  switch (status) {
    case "actual_found":
      return "Complete";
    case "actual_not_found":
      return "No data";
    case "actual_ambiguous":
    case "actual_incomplete":
      return "Data issue";
    case "actual_error":
      return "Unavailable";
    default:
      return "Unavailable";
  }
}
