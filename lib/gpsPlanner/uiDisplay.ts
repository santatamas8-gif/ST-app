/**
 * Pure GPS Planner UI display helpers.
 * Display-only — never persist rounded values; never invent formulas.
 */

import { comparePlannerIsoDates, dateInInclusiveRange } from "@/lib/gpsPlanner/common";

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
      text: `${remainingPct}% remaining to allocate`,
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
  duplicate_display_order: "This week already has a day with that display order.",
  invalid_md_tag: "MD tag is required.",
  invalid_display_order: "Display order must be a whole number ≥ 0.",
  group_not_found: "Group was not found.",
  duplicate_group_name: "A group with this name already exists in the week.",
  player_not_found: "Player was not found.",
  not_a_player: "Selected profile is not a player.",
  member_already_exists: "Player is already in this group.",
  member_not_found: "Group member was not found.",
  mapping_not_found:
    "No Power BI player mapping for this player. Map them before creating a Weekly Target.",
  mapping_changed: "Power BI player mapping changed unexpectedly.",
  match_best_not_found: "Match Best was not found in Power BI for this player.",
  match_best_ambiguous: "Match Best is ambiguous in Power BI for this player.",
  match_best_incomplete: "Match Best from Power BI is incomplete for this player.",
  powerbi_error: "Power BI request failed. Try again later.",
  weekly_target_not_found: "Weekly target was not found for this player.",
  weekly_target_already_exists: "A weekly target already exists for this player in this week.",
  invalid_percentage: "Percentages must be numbers ≥ 0 (no upper bound).",
  daily_target_not_found: "Daily target was not found.",
  daily_target_already_exists: "A daily target already exists for this day and player.",
  actual_not_found: "No Full Training Actual found in Power BI for this day.",
  actual_ambiguous: "Multiple Full Training Actual rows found — not summed.",
  actual_incomplete: "Actual from Power BI is incomplete for this day.",
  invalid_date: "Date must be YYYY-MM-DD.",
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
