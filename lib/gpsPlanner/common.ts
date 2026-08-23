/** Pure GPS Planner shared types/validation (safe for unit tests). */

export type PlannerErrorCode =
  | "unauthorized"
  | "invalid_input"
  | "database_error"
  | "week_not_found"
  | "duplicate_week"
  | "invalid_date_range"
  | "invalid_week_type"
  | "invalid_week_status"
  | "invalid_overload_focus"
  | "confirmation_required"
  | "week_range_conflict"
  | "day_not_found"
  | "day_outside_week"
  | "duplicate_day_date"
  | "duplicate_display_order"
  | "invalid_md_tag"
  | "invalid_display_order"
  | "group_not_found"
  | "duplicate_group_name"
  | "player_not_found"
  | "not_a_player"
  | "member_already_exists"
  | "member_not_found"
  | "mapping_not_found"
  | "mapping_changed"
  | "match_best_not_found"
  | "match_best_ambiguous"
  | "match_best_incomplete"
  | "powerbi_error"
  | "weekly_target_not_found"
  | "weekly_target_already_exists"
  | "invalid_percentage"
  | "daily_target_not_found"
  | "daily_target_already_exists"
  | "actual_not_found"
  | "actual_ambiguous"
  | "actual_incomplete"
  | "invalid_date"
  | "official_match_not_found"
  | "official_match_already_exists"
  | "official_match_ambiguous"
  | "official_match_duplicate_order"
  | "official_match_duplicate_date"
  | "stale_plan";

export type PlannerSafeError = {
  code: PlannerErrorCode;
  message: string;
};

export type PlannerResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: PlannerSafeError };

export const WEEK_TYPES = ["deload", "maintaining", "overload"] as const;
export type PlannerWeekType = (typeof WEEK_TYPES)[number];

export const WEEK_STATUSES = ["draft", "active", "closed"] as const;
export type PlannerWeekStatus = (typeof WEEK_STATUSES)[number];

export const OVERLOAD_FOCUS_VALUES = [
  "td",
  "hsr",
  "sprint",
  "acc",
  "dec",
] as const;
export type OverloadFocusMetric = (typeof OVERLOAD_FOCUS_VALUES)[number];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const WEEK_TYPE_SET = new Set<string>(WEEK_TYPES);
const WEEK_STATUS_SET = new Set<string>(WEEK_STATUSES);
const FOCUS_SET = new Set<string>(OVERLOAD_FOCUS_VALUES);

export function plannerErr(
  code: PlannerErrorCode,
  message: string
): PlannerSafeError {
  return { code, message };
}

export function logPlannerError(
  area: string,
  error: PlannerSafeError,
  detail?: Record<string, unknown>
): void {
  console.error("[gpsPlanner]", {
    area,
    code: error.code,
    message: error.message,
    ...(detail ? { detail } : {}),
  });
}

export function isPlannerUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Date-only YYYY-MM-DD with real calendar validity (no timezone shift). */
export function isPlannerIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/** Lexicographic compare safe for YYYY-MM-DD. */
export function comparePlannerIsoDates(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function dateInInclusiveRange(
  date: string,
  start: string,
  end: string
): boolean {
  return (
    comparePlannerIsoDates(date, start) >= 0 &&
    comparePlannerIsoDates(date, end) <= 0
  );
}

export function parseWeekType(value: unknown): PlannerWeekType | null {
  if (typeof value !== "string") return null;
  return WEEK_TYPE_SET.has(value) ? (value as PlannerWeekType) : null;
}

export function parseWeekStatus(value: unknown): PlannerWeekStatus | null {
  if (typeof value !== "string") return null;
  return WEEK_STATUS_SET.has(value) ? (value as PlannerWeekStatus) : null;
}

export function normalizePowerBiWeekId(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeOverloadFocus(
  weekType: PlannerWeekType,
  focus: unknown
):
  | { ok: true; focus: OverloadFocusMetric[] }
  | { ok: false; error: PlannerSafeError } {
  if (focus == null) {
    return { ok: true, focus: [] };
  }
  if (!Array.isArray(focus)) {
    return {
      ok: false,
      error: plannerErr(
        "invalid_overload_focus",
        "overloadFocus must be an array of metric keys."
      ),
    };
  }
  const seen = new Set<string>();
  const out: OverloadFocusMetric[] = [];
  for (const item of focus) {
    if (typeof item !== "string" || !FOCUS_SET.has(item)) {
      return {
        ok: false,
        error: plannerErr(
          "invalid_overload_focus",
          "overloadFocus values must be td, hsr, sprint, acc, or dec."
        ),
      };
    }
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item as OverloadFocusMetric);
  }
  if (weekType !== "overload" && out.length > 0) {
    return {
      ok: false,
      error: plannerErr(
        "invalid_overload_focus",
        "overloadFocus must be empty unless weekType is overload."
      ),
    };
  }
  return { ok: true, focus: out };
}

export function normalizeGroupName(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function mapPlannerDbError(
  area: string,
  supabaseError: { code?: string; message?: string } | null
): PlannerSafeError {
  const message = supabaseError?.message ?? "Database error.";
  const lower = message.toLowerCase();

  if (
    lower.includes("planner_weeks_powerbi_week_id_start_date_key") ||
    (lower.includes("powerbi_week_id") && lower.includes("unique"))
  ) {
    const e = plannerErr(
      "duplicate_week",
      "A planner week with this Power BI week id and start date already exists."
    );
    logPlannerError(area, e, { code: supabaseError?.code });
    return e;
  }

  if (
    lower.includes("planner_week_days_week_id_date_key") ||
    (lower.includes("week_id_date") && lower.includes("unique"))
  ) {
    const e = plannerErr(
      "duplicate_day_date",
      "This week already has a day on that date."
    );
    logPlannerError(area, e, { code: supabaseError?.code });
    return e;
  }

  if (
    lower.includes("planner_week_days_week_id_display_order_key") ||
    (lower.includes("display_order") && lower.includes("unique"))
  ) {
    const e = plannerErr(
      "duplicate_display_order",
      "This week already has a day with that display order."
    );
    logPlannerError(area, e, { code: supabaseError?.code });
    return e;
  }

  if (
    lower.includes("planner_groups_week_id_lower_trim_name_uidx") ||
    (lower.includes("planner_groups") && lower.includes("unique"))
  ) {
    const e = plannerErr(
      "duplicate_group_name",
      "A group with this name already exists in the week."
    );
    logPlannerError(area, e, { code: supabaseError?.code });
    return e;
  }

  if (
    lower.includes("planner_group_members") &&
    (lower.includes("unique") ||
      lower.includes("duplicate") ||
      lower.includes("pkey") ||
      lower.includes("primary key"))
  ) {
    const e = plannerErr(
      "member_already_exists",
      "This player is already a member of the group."
    );
    logPlannerError(area, e, { code: supabaseError?.code });
    return e;
  }

  if (
    lower.includes("planner_weekly_targets") &&
    (lower.includes("unique") ||
      lower.includes("duplicate") ||
      lower.includes("pkey") ||
      lower.includes("primary key") ||
      supabaseError?.code === "23505")
  ) {
    const e = plannerErr(
      "weekly_target_already_exists",
      "A weekly target already exists for this week and player."
    );
    logPlannerError(area, e, { code: supabaseError?.code });
    return e;
  }

  if (
    lower.includes("planner_match_best_snapshots") &&
    (lower.includes("unique") ||
      lower.includes("duplicate") ||
      lower.includes("pkey") ||
      lower.includes("primary key") ||
      supabaseError?.code === "23505")
  ) {
    const e = plannerErr(
      "weekly_target_already_exists",
      "A Match Best snapshot or weekly target already exists for this week and player."
    );
    logPlannerError(area, e, { code: supabaseError?.code });
    return e;
  }

  if (
    lower.includes("planner_week_official_matches") &&
    (lower.includes("unique") ||
      lower.includes("duplicate") ||
      lower.includes("week_id_key") ||
      supabaseError?.code === "23505")
  ) {
    if (lower.includes("week_id_gps_date_key")) {
      const e = plannerErr(
        "official_match_duplicate_date",
        "A match with this GPS date already exists for this planner week."
      );
      logPlannerError(area, e, { code: supabaseError?.code });
      return e;
    }
    if (lower.includes("week_id_match_order_key")) {
      const e = plannerErr(
        "official_match_duplicate_order",
        "A match with this order already exists for this planner week."
      );
      logPlannerError(area, e, { code: supabaseError?.code });
      return e;
    }
    const e = plannerErr(
      "official_match_already_exists",
      "An official match is already selected for this planner week."
    );
    logPlannerError(area, e, { code: supabaseError?.code });
    return e;
  }

  if (
    lower.includes("planner_daily_targets") &&
    (lower.includes("unique") ||
      lower.includes("duplicate") ||
      lower.includes("pkey") ||
      lower.includes("primary key") ||
      supabaseError?.code === "23505")
  ) {
    const e = plannerErr(
      "daily_target_already_exists",
      "A daily target already exists for this week day and player."
    );
    logPlannerError(area, e, { code: supabaseError?.code });
    return e;
  }

  if (
    lower.includes("snapshot or weekly target already exists") ||
    (supabaseError?.code === "23505" &&
      lower.includes("planner_create_snapshot_and_weekly_target"))
  ) {
    const e = plannerErr(
      "weekly_target_already_exists",
      "A weekly target already exists for this week and player."
    );
    logPlannerError(area, e, { code: supabaseError?.code });
    return e;
  }

  if (
    lower.includes("existing planner_week_days dates fall outside") ||
    lower.includes("cannot set start_date")
  ) {
    const e = plannerErr(
      "week_range_conflict",
      "Cannot change week dates: existing week days would fall outside the new range."
    );
    logPlannerError(area, e, { code: supabaseError?.code });
    return e;
  }

  if (
    lower.includes("must be between planner_weeks.start_date") ||
    lower.includes("planner_week_days.date")
  ) {
    const e = plannerErr(
      "day_outside_week",
      "Day date must be within the parent planner week start and end dates."
    );
    logPlannerError(area, e, { code: supabaseError?.code });
    return e;
  }

  const safe = plannerErr(
    "database_error",
    "Could not complete planner operation."
  );
  logPlannerError(area, safe, { code: supabaseError?.code, message });
  return safe;
}
