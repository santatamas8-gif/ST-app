import "server-only";

/**
 * ADMIN-ONLY Planner Week → official match persistence (Total Load Phase 1).
 * Identity / display metadata only. No GPS Actuals, Power BI, or auto-selection.
 * gps_date may fall outside planner_weeks.start_date..end_date.
 */

import { createClient } from "@/lib/supabase/server";
import {
  requirePlannerAdmin,
  requirePlannerAdminUser,
} from "@/lib/gpsPlanner/auth.server";
import {
  isPlannerIsoDate,
  isPlannerUuid,
  mapPlannerDbError,
  plannerErr,
  type PlannerResult,
} from "@/lib/gpsPlanner/common";

import type { PlannerWeekOfficialMatch } from "@/lib/gpsPlanner/types";

export type { PlannerWeekOfficialMatch };

type OfficialMatchDbRow = {
  id: string;
  week_id: string;
  gps_date: string;
  opponent: string;
  matchday: string;
  competition: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

const MATCH_SELECT =
  "id, week_id, gps_date, opponent, matchday, competition, created_by, updated_by, created_at, updated_at";

function normalizeRequiredText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapOfficialMatch(row: OfficialMatchDbRow): PlannerWeekOfficialMatch {
  return {
    id: row.id,
    weekId: row.week_id,
    gpsDate: row.gps_date,
    opponent: row.opponent,
    matchday: row.matchday,
    competition: row.competition,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function assertWeekExists(
  weekId: string
): Promise<ReturnType<typeof plannerErr> | null> {
  if (!isPlannerUuid(weekId)) {
    return plannerErr("invalid_input", "weekId must be a valid UUID.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_weeks")
    .select("id")
    .eq("id", weekId)
    .maybeSingle();
  if (error) return mapPlannerDbError("assertWeekExists", error);
  if (!data) return plannerErr("week_not_found", "Planner week was not found.");
  return null;
}

export type SetPlannerWeekOfficialMatchInput = {
  weekId: string;
  gpsDate: string;
  opponent: string;
  matchday: string;
  competition?: string | null;
};

function validateOfficialMatchInput(
  input: SetPlannerWeekOfficialMatchInput
):
  | {
      ok: true;
      weekId: string;
      gpsDate: string;
      opponent: string;
      matchday: string;
      competition: string | null;
    }
  | { ok: false; error: ReturnType<typeof plannerErr> } {
  if (!isPlannerUuid(input.weekId)) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "weekId must be a valid UUID."),
    };
  }
  if (!isPlannerIsoDate(input.gpsDate ?? "")) {
    return {
      ok: false,
      error: plannerErr("invalid_date", "gps_date must be a valid YYYY-MM-DD date."),
    };
  }
  const opponent = normalizeRequiredText(input.opponent ?? "");
  if (!opponent) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "Opponent is required."),
    };
  }
  const matchday = normalizeRequiredText(input.matchday ?? "");
  if (!matchday) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "Matchday is required."),
    };
  }
  return {
    ok: true,
    weekId: input.weekId,
    gpsDate: input.gpsDate,
    opponent,
    matchday,
    competition: normalizeOptionalText(input.competition),
  };
}

export async function getPlannerWeekOfficialMatch(
  weekId: string
): Promise<PlannerResult<PlannerWeekOfficialMatch | null>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  const weekError = await assertWeekExists(weekId);
  if (weekError) return { ok: false, error: weekError };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_week_official_matches")
    .select(MATCH_SELECT)
    .eq("week_id", weekId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: mapPlannerDbError("getPlannerWeekOfficialMatch", error),
    };
  }
  if (!data) return { ok: true, data: null };
  return { ok: true, data: mapOfficialMatch(data as OfficialMatchDbRow) };
}

/**
 * Create or correct the single official match for a Planner week.
 * Does not auto-select from Power BI. Does not persist GPS Actuals.
 * Does not require gps_date inside the stored week training range.
 */
export async function setPlannerWeekOfficialMatch(
  input: SetPlannerWeekOfficialMatchInput
): Promise<PlannerResult<PlannerWeekOfficialMatch>> {
  const auth = await requirePlannerAdminUser();
  if (!auth.ok) return { ok: false, error: auth.error };

  const parsed = validateOfficialMatchInput(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const weekError = await assertWeekExists(parsed.weekId);
  if (weekError) return { ok: false, error: weekError };

  const supabase = await createClient();
  const existing = await supabase
    .from("planner_week_official_matches")
    .select(MATCH_SELECT)
    .eq("week_id", parsed.weekId)
    .maybeSingle();

  if (existing.error) {
    return {
      ok: false,
      error: mapPlannerDbError("setPlannerWeekOfficialMatch", existing.error),
    };
  }

  const fields = {
    gps_date: parsed.gpsDate,
    opponent: parsed.opponent,
    matchday: parsed.matchday,
    competition: parsed.competition,
  };

  if (existing.data) {
    const { data, error } = await supabase
      .from("planner_week_official_matches")
      .update({
        ...fields,
        updated_by: auth.user.id,
      })
      .eq("week_id", parsed.weekId)
      .select(MATCH_SELECT)
      .maybeSingle();

    if (error) {
      return {
        ok: false,
        error: mapPlannerDbError("setPlannerWeekOfficialMatch", error),
      };
    }
    if (!data) {
      return {
        ok: false,
        error: plannerErr(
          "official_match_not_found",
          "Official match was not found for this planner week."
        ),
      };
    }
    return { ok: true, data: mapOfficialMatch(data as OfficialMatchDbRow) };
  }

  const { data, error } = await supabase
    .from("planner_week_official_matches")
    .insert({
      week_id: parsed.weekId,
      ...fields,
      created_by: auth.user.id,
      updated_by: auth.user.id,
    })
    .select(MATCH_SELECT)
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: mapPlannerDbError("setPlannerWeekOfficialMatch", error),
    };
  }
  return { ok: true, data: mapOfficialMatch(data as OfficialMatchDbRow) };
}

export async function deletePlannerWeekOfficialMatch(
  weekId: string
): Promise<PlannerResult<{ weekId: string }>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  const weekError = await assertWeekExists(weekId);
  if (weekError) return { ok: false, error: weekError };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_week_official_matches")
    .delete()
    .eq("week_id", weekId)
    .select("week_id")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: mapPlannerDbError("deletePlannerWeekOfficialMatch", error),
    };
  }
  if (!data) {
    return {
      ok: false,
      error: plannerErr(
        "official_match_not_found",
        "Official match was not found for this planner week."
      ),
    };
  }
  return { ok: true, data: { weekId } };
}
