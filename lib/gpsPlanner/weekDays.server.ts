import "server-only";

/**
 * ADMIN-ONLY Planner Week Days domain (Phase A).
 * No auto-reorder. No MD uniqueness. week_id immutable on update.
 */

import { createClient } from "@/lib/supabase/server";
import { requirePlannerAdmin } from "@/lib/gpsPlanner/auth.server";
import {
  dateInInclusiveRange,
  isPlannerIsoDate,
  isPlannerUuid,
  mapPlannerDbError,
  plannerErr,
  type PlannerResult,
} from "@/lib/gpsPlanner/common";

import type { PlannerWeekDayRow } from "@/lib/gpsPlanner/types";

export type { PlannerWeekDayRow };

type DayDbRow = {
  id: string;
  week_id: string;
  date: string;
  md_tag: string;
  display_order: number;
  created_at: string;
};

type WeekRangeRow = {
  id: string;
  start_date: string;
  end_date: string;
};

const DAY_SELECT = "id, week_id, date, md_tag, display_order, created_at";

function mapDay(row: DayDbRow): PlannerWeekDayRow {
  return {
    id: row.id,
    weekId: row.week_id,
    date: row.date,
    mdTag: row.md_tag,
    displayOrder: row.display_order,
    createdAt: row.created_at,
  };
}

function normalizeMdTag(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseDisplayOrder(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return null;
  }
  return value;
}

async function loadWeekRange(
  weekId: string
): Promise<
  | { ok: true; week: WeekRangeRow }
  | { ok: false; error: ReturnType<typeof plannerErr> }
> {
  if (!isPlannerUuid(weekId)) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "weekId must be a valid UUID."),
    };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_weeks")
    .select("id, start_date, end_date")
    .eq("id", weekId)
    .maybeSingle();
  if (error) {
    return { ok: false, error: mapPlannerDbError("loadWeekRange", error) };
  }
  if (!data) {
    return {
      ok: false,
      error: plannerErr("week_not_found", "Planner week was not found."),
    };
  }
  return { ok: true, week: data as WeekRangeRow };
}

/** List days for a week ordered by display_order, then date. */
export async function listPlannerWeekDays(
  weekId: string
): Promise<PlannerResult<PlannerWeekDayRow[]>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  const week = await loadWeekRange(weekId);
  if (!week.ok) return { ok: false, error: week.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_week_days")
    .select(DAY_SELECT)
    .eq("week_id", weekId)
    .order("display_order", { ascending: true })
    .order("date", { ascending: true });

  if (error) {
    return { ok: false, error: mapPlannerDbError("listPlannerWeekDays", error) };
  }
  return { ok: true, data: ((data ?? []) as DayDbRow[]).map(mapDay) };
}

export type CreatePlannerWeekDayInput = {
  weekId: string;
  date: string;
  mdTag: string;
  displayOrder: number;
};

export async function createPlannerWeekDay(
  input: CreatePlannerWeekDayInput
): Promise<PlannerResult<PlannerWeekDayRow>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  const week = await loadWeekRange(input.weekId);
  if (!week.ok) return { ok: false, error: week.error };

  if (!isPlannerIsoDate(input.date)) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "date must be YYYY-MM-DD."),
    };
  }
  const mdTag = normalizeMdTag(input.mdTag ?? "");
  if (!mdTag) {
    return {
      ok: false,
      error: plannerErr("invalid_md_tag", "mdTag is required."),
    };
  }
  const displayOrder = parseDisplayOrder(input.displayOrder);
  if (displayOrder == null) {
    return {
      ok: false,
      error: plannerErr(
        "invalid_display_order",
        "displayOrder must be an integer >= 0."
      ),
    };
  }
  if (
    !dateInInclusiveRange(
      input.date,
      week.week.start_date,
      week.week.end_date
    )
  ) {
    return {
      ok: false,
      error: plannerErr(
        "day_outside_week",
        "Day date must be within the parent planner week start and end dates."
      ),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_week_days")
    .insert({
      week_id: input.weekId,
      date: input.date,
      md_tag: mdTag,
      display_order: displayOrder,
    })
    .select(DAY_SELECT)
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: mapPlannerDbError("createPlannerWeekDay", error),
    };
  }
  return { ok: true, data: mapDay(data as DayDbRow) };
}

export type UpdatePlannerWeekDayInput = {
  dayId: string;
  date: string;
  mdTag: string;
  displayOrder: number;
};

/**
 * Update date/md_tag/display_order. week_id is immutable in Phase A.
 * Does not auto-shift other display orders.
 */
export async function updatePlannerWeekDay(
  input: UpdatePlannerWeekDayInput
): Promise<PlannerResult<PlannerWeekDayRow>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  if (!isPlannerUuid(input.dayId)) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "dayId must be a valid UUID."),
    };
  }
  if (!isPlannerIsoDate(input.date)) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "date must be YYYY-MM-DD."),
    };
  }
  const mdTag = normalizeMdTag(input.mdTag ?? "");
  if (!mdTag) {
    return {
      ok: false,
      error: plannerErr("invalid_md_tag", "mdTag is required."),
    };
  }
  const displayOrder = parseDisplayOrder(input.displayOrder);
  if (displayOrder == null) {
    return {
      ok: false,
      error: plannerErr(
        "invalid_display_order",
        "displayOrder must be an integer >= 0."
      ),
    };
  }

  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase
    .from("planner_week_days")
    .select("id, week_id")
    .eq("id", input.dayId)
    .maybeSingle();

  if (existingError) {
    return {
      ok: false,
      error: mapPlannerDbError("updatePlannerWeekDay.load", existingError),
    };
  }
  if (!existing) {
    return {
      ok: false,
      error: plannerErr("day_not_found", "Planner week day was not found."),
    };
  }

  const week = await loadWeekRange((existing as { week_id: string }).week_id);
  if (!week.ok) return { ok: false, error: week.error };

  if (
    !dateInInclusiveRange(
      input.date,
      week.week.start_date,
      week.week.end_date
    )
  ) {
    return {
      ok: false,
      error: plannerErr(
        "day_outside_week",
        "Day date must be within the parent planner week start and end dates."
      ),
    };
  }

  const { data, error } = await supabase
    .from("planner_week_days")
    .update({
      date: input.date,
      md_tag: mdTag,
      display_order: displayOrder,
    })
    .eq("id", input.dayId)
    .select(DAY_SELECT)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: mapPlannerDbError("updatePlannerWeekDay", error),
    };
  }
  if (!data) {
    return {
      ok: false,
      error: plannerErr("day_not_found", "Planner week day was not found."),
    };
  }
  return { ok: true, data: mapDay(data as DayDbRow) };
}

export type DeletePlannerWeekDayInput = {
  weekDayId: string;
  /**
   * Must be true. Deleting a week day cascades Daily Targets via DB FK.
   * Domain does not manually delete daily targets and does not reorder days.
   */
  confirm: true;
};

/**
 * Destructive delete of a planner week day.
 * Cascades planner_daily_targets via approved FK. Requires confirm: true.
 * Does not auto-reorder remaining days.
 */
export async function deletePlannerWeekDay(
  input: DeletePlannerWeekDayInput
): Promise<PlannerResult<{ weekDayId: string }>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  if (input.confirm !== true) {
    return {
      ok: false,
      error: plannerErr(
        "confirmation_required",
        "Deleting a planner week day requires confirm: true (cascades daily targets)."
      ),
    };
  }

  if (!isPlannerUuid(input.weekDayId)) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "weekDayId must be a valid UUID."),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_week_days")
    .delete()
    .eq("id", input.weekDayId)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: mapPlannerDbError("deletePlannerWeekDay", error),
    };
  }
  if (!data) {
    return {
      ok: false,
      error: plannerErr("day_not_found", "Planner week day was not found."),
    };
  }
  return { ok: true, data: { weekDayId: input.weekDayId } };
}
