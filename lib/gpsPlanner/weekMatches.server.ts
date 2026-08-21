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
  match_order: number;
  md_tag: string;
  opponent: string | null;
  matchday: string | null;
  competition: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

const MATCH_SELECT =
  "id, week_id, gps_date, match_order, md_tag, opponent, matchday, competition, created_by, updated_by, created_at, updated_at";

function normalizeRequiredText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseMatchOrder(value: unknown): 1 | 2 | null {
  const n = typeof value === "string" ? Number(value) : value;
  return n === 1 || n === 2 ? n : null;
}

function mapNullableText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapOfficialMatch(row: OfficialMatchDbRow): PlannerWeekOfficialMatch | null {
  const matchOrder = parseMatchOrder(row.match_order);
  const mdTag = mapNullableText(row.md_tag);
  if (matchOrder == null || mdTag == null) return null;
  return {
    id: row.id,
    weekId: row.week_id,
    gpsDate: row.gps_date,
    matchOrder,
    mdTag,
    opponent: mapNullableText(row.opponent),
    matchday: mapNullableText(row.matchday),
    competition: mapNullableText(row.competition),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sortOfficialMatches(
  rows: PlannerWeekOfficialMatch[]
): PlannerWeekOfficialMatch[] {
  return rows.slice().sort((a, b) => {
    if (a.matchOrder !== b.matchOrder) return a.matchOrder - b.matchOrder;
    return a.gpsDate.localeCompare(b.gpsDate);
  });
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

export async function getPlannerWeekOfficialMatches(
  weekId: string
): Promise<PlannerResult<PlannerWeekOfficialMatch[]>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  const weekError = await assertWeekExists(weekId);
  if (weekError) return { ok: false, error: weekError };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_week_official_matches")
    .select(MATCH_SELECT)
    .eq("week_id", weekId)
    .order("match_order", { ascending: true })
    .order("gps_date", { ascending: true });

  if (error) {
    return {
      ok: false,
      error: mapPlannerDbError("getPlannerWeekOfficialMatches", error),
    };
  }

  const mapped: PlannerWeekOfficialMatch[] = [];
  for (const row of Array.isArray(data) ? data : []) {
    const match = mapOfficialMatch(row as OfficialMatchDbRow);
    if (!match) {
      return {
        ok: false,
        error: plannerErr(
          "invalid_input",
          "Official match row is missing a valid match_order or md_tag."
        ),
      };
    }
    mapped.push(match);
  }
  return { ok: true, data: sortOfficialMatches(mapped) };
}

/**
 * Temporary V1 compatibility wrapper. Production UNIQUE(week_id) still
 * guarantees 0 or 1 row. Does not silently pick the first of many.
 */
export async function getPlannerWeekOfficialMatch(
  weekId: string
): Promise<PlannerResult<PlannerWeekOfficialMatch | null>> {
  const result = await getPlannerWeekOfficialMatches(weekId);
  if (!result.ok) return result;
  if (result.data.length === 0) return { ok: true, data: null };
  if (result.data.length === 1) return { ok: true, data: result.data[0] };
  return {
    ok: false,
    error: plannerErr(
      "official_match_ambiguous",
      "Expected at most one official match for this planner week."
    ),
  };
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
    const updated = mapOfficialMatch(data as OfficialMatchDbRow);
    if (!updated) {
      return {
        ok: false,
        error: plannerErr(
          "invalid_input",
          "Official match row is missing a valid match_order or md_tag."
        ),
      };
    }
    return { ok: true, data: updated };
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
  const created = mapOfficialMatch(data as OfficialMatchDbRow);
  if (!created) {
    return {
      ok: false,
      error: plannerErr(
        "invalid_input",
        "Official match row is missing a valid match_order or md_tag."
      ),
    };
  }
  return { ok: true, data: created };
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
