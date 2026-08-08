import "server-only";

/**
 * ADMIN-ONLY Planner Week domain (Phase A).
 * No Power BI calls. No target/snapshot logic. No UI.
 */

import { createClient } from "@/lib/supabase/server";
import { requirePlannerAdmin, requirePlannerAdminUser } from "@/lib/gpsPlanner/auth.server";
import {
  dateInInclusiveRange,
  isPlannerIsoDate,
  isPlannerUuid,
  mapPlannerDbError,
  normalizeOverloadFocus,
  normalizePowerBiWeekId,
  parseWeekStatus,
  parseWeekType,
  plannerErr,
  type OverloadFocusMetric,
  type PlannerResult,
  type PlannerWeekStatus,
  type PlannerWeekType,
} from "@/lib/gpsPlanner/common";
import type { PlannerWeekRow } from "@/lib/gpsPlanner/types";

export type { PlannerWeekRow };

type WeekDbRow = {
  id: string;
  powerbi_week_id: string;
  start_date: string;
  end_date: string;
  week_type: string;
  overload_focus: string[] | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const WEEK_SELECT =
  "id, powerbi_week_id, start_date, end_date, week_type, overload_focus, status, created_by, created_at, updated_at";

function mapWeek(row: WeekDbRow): PlannerWeekRow {
  return {
    id: row.id,
    powerbiWeekId: row.powerbi_week_id,
    startDate: row.start_date,
    endDate: row.end_date,
    weekType: row.week_type as PlannerWeekType,
    overloadFocus: (row.overload_focus ?? []) as OverloadFocusMetric[],
    status: row.status as PlannerWeekStatus,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateWeekFields(input: {
  powerBiWeekId: string;
  startDate: string;
  endDate: string;
  weekType: string;
  overloadFocus?: unknown;
  status: string;
}):
  | {
      ok: true;
      powerBiWeekId: string;
      startDate: string;
      endDate: string;
      weekType: PlannerWeekType;
      overloadFocus: OverloadFocusMetric[];
      status: PlannerWeekStatus;
    }
  | { ok: false; error: ReturnType<typeof plannerErr> } {
  const powerBiWeekId = normalizePowerBiWeekId(input.powerBiWeekId ?? "");
  if (!powerBiWeekId) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "powerBiWeekId is required."),
    };
  }
  if (!isPlannerIsoDate(input.startDate) || !isPlannerIsoDate(input.endDate)) {
    return {
      ok: false,
      error: plannerErr(
        "invalid_input",
        "startDate and endDate must be YYYY-MM-DD calendar dates."
      ),
    };
  }
  if (input.endDate < input.startDate) {
    return {
      ok: false,
      error: plannerErr(
        "invalid_date_range",
        "endDate must be on or after startDate."
      ),
    };
  }
  const weekType = parseWeekType(input.weekType);
  if (!weekType) {
    return {
      ok: false,
      error: plannerErr(
        "invalid_week_type",
        "weekType must be deload, maintaining, or overload."
      ),
    };
  }
  const status = parseWeekStatus(input.status);
  if (!status) {
    return {
      ok: false,
      error: plannerErr(
        "invalid_week_status",
        "status must be draft, active, or closed."
      ),
    };
  }
  const focus = normalizeOverloadFocus(weekType, input.overloadFocus ?? []);
  if (!focus.ok) return focus;
  return {
    ok: true,
    powerBiWeekId,
    startDate: input.startDate,
    endDate: input.endDate,
    weekType,
    overloadFocus: focus.focus,
    status,
  };
}

/** List planner weeks, newest start_date first. */
export async function listPlannerWeeks(): Promise<
  PlannerResult<PlannerWeekRow[]>
> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_weeks")
    .select(WEEK_SELECT)
    .order("start_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return { ok: false, error: mapPlannerDbError("listPlannerWeeks", error) };
  }
  return { ok: true, data: ((data ?? []) as WeekDbRow[]).map(mapWeek) };
}

export async function getPlannerWeek(
  weekId: string
): Promise<PlannerResult<PlannerWeekRow | null>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  if (!isPlannerUuid(weekId)) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "weekId must be a valid UUID."),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_weeks")
    .select(WEEK_SELECT)
    .eq("id", weekId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: mapPlannerDbError("getPlannerWeek", error) };
  }
  if (!data) return { ok: true, data: null };
  return { ok: true, data: mapWeek(data as WeekDbRow) };
}

export type CreatePlannerWeekInput = {
  powerBiWeekId: string;
  startDate: string;
  endDate: string;
  weekType: PlannerWeekType | string;
  overloadFocus?: OverloadFocusMetric[] | string[];
  status?: PlannerWeekStatus | string;
};

export async function createPlannerWeek(
  input: CreatePlannerWeekInput
): Promise<PlannerResult<PlannerWeekRow>> {
  const auth = await requirePlannerAdminUser();
  if (!auth.ok) return { ok: false, error: auth.error };

  const validated = validateWeekFields({
    powerBiWeekId: input.powerBiWeekId,
    startDate: input.startDate,
    endDate: input.endDate,
    weekType: String(input.weekType ?? ""),
    overloadFocus: input.overloadFocus ?? [],
    status: String(input.status ?? "draft"),
  });
  if (!validated.ok) return { ok: false, error: validated.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_weeks")
    .insert({
      powerbi_week_id: validated.powerBiWeekId,
      start_date: validated.startDate,
      end_date: validated.endDate,
      week_type: validated.weekType,
      overload_focus: validated.overloadFocus,
      status: validated.status,
      created_by: auth.user.id,
    })
    .select(WEEK_SELECT)
    .single();

  if (error || !data) {
    return { ok: false, error: mapPlannerDbError("createPlannerWeek", error) };
  }
  return { ok: true, data: mapWeek(data as WeekDbRow) };
}

export type UpdatePlannerWeekInput = {
  weekId: string;
  powerBiWeekId: string;
  startDate: string;
  endDate: string;
  weekType: PlannerWeekType | string;
  overloadFocus?: OverloadFocusMetric[] | string[];
  status: PlannerWeekStatus | string;
};

/**
 * Update week metadata. Date-range shrinks that leave existing days outside
 * the range are rejected by domain pre-check and/or DB trigger.
 * Does not auto-delete, move, or rewrite week days.
 */
export async function updatePlannerWeek(
  input: UpdatePlannerWeekInput
): Promise<PlannerResult<PlannerWeekRow>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  if (!isPlannerUuid(input.weekId)) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "weekId must be a valid UUID."),
    };
  }

  const validated = validateWeekFields({
    powerBiWeekId: input.powerBiWeekId,
    startDate: input.startDate,
    endDate: input.endDate,
    weekType: String(input.weekType ?? ""),
    overloadFocus: input.overloadFocus ?? [],
    status: String(input.status ?? ""),
  });
  if (!validated.ok) return { ok: false, error: validated.error };

  const supabase = await createClient();

  // Friendly pre-check: existing days must remain inside new range.
  const { data: days, error: daysError } = await supabase
    .from("planner_week_days")
    .select("date")
    .eq("week_id", input.weekId);

  if (daysError) {
    return {
      ok: false,
      error: mapPlannerDbError("updatePlannerWeek.days", daysError),
    };
  }

  for (const day of days ?? []) {
    const d = String((day as { date: string }).date);
    if (
      !dateInInclusiveRange(d, validated.startDate, validated.endDate)
    ) {
      return {
        ok: false,
        error: plannerErr(
          "week_range_conflict",
          "Cannot change week dates: existing week days would fall outside the new range."
        ),
      };
    }
  }

  const { data, error } = await supabase
    .from("planner_weeks")
    .update({
      powerbi_week_id: validated.powerBiWeekId,
      start_date: validated.startDate,
      end_date: validated.endDate,
      week_type: validated.weekType,
      overload_focus: validated.overloadFocus,
      status: validated.status,
    })
    .eq("id", input.weekId)
    .select(WEEK_SELECT)
    .maybeSingle();

  if (error) {
    return { ok: false, error: mapPlannerDbError("updatePlannerWeek", error) };
  }
  if (!data) {
    return {
      ok: false,
      error: plannerErr("week_not_found", "Planner week was not found."),
    };
  }
  return { ok: true, data: mapWeek(data as WeekDbRow) };
}

export type DeletePlannerWeekInput = {
  weekId: string;
  /** Must be true. Future UI must require deliberate confirmation. */
  confirm: true;
};

/**
 * Destructive delete. Cascades to week days, groups/members, snapshots, targets
 * via approved DB FKs. Requires explicit confirm: true.
 */
export async function deletePlannerWeek(
  input: DeletePlannerWeekInput
): Promise<PlannerResult<{ weekId: string }>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  if (input.confirm !== true) {
    return {
      ok: false,
      error: plannerErr(
        "confirmation_required",
        "Deleting a planner week requires confirm: true."
      ),
    };
  }
  if (!isPlannerUuid(input.weekId)) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "weekId must be a valid UUID."),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_weeks")
    .delete()
    .eq("id", input.weekId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: mapPlannerDbError("deletePlannerWeek", error) };
  }
  if (!data) {
    return {
      ok: false,
      error: plannerErr("week_not_found", "Planner week was not found."),
    };
  }
  return { ok: true, data: { weekId: input.weekId } };
}
