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

export type CreatePlannerWeekOfficialMatchInput = {
  weekId: string;
  matchOrder: 1 | 2;
  gpsDate: string;
  mdTag: string;
  opponent?: string | null;
  matchday?: string | null;
  competition?: string | null;
};

export type UpdatePlannerWeekOfficialMatchByIdInput = {
  id: string;
  weekId: string;
  matchOrder: 1 | 2;
  gpsDate: string;
  mdTag: string;
  opponent?: string | null;
  matchday?: string | null;
  competition?: string | null;
};

export type DeletePlannerWeekOfficialMatchByIdInput = {
  id: string;
  weekId: string;
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

function validateMatchMutationInput(input: {
  weekId: string;
  matchOrder: unknown;
  gpsDate: string;
  mdTag: string;
  opponent?: string | null;
  matchday?: string | null;
  competition?: string | null;
}):
  | {
      ok: true;
      weekId: string;
      matchOrder: 1 | 2;
      gpsDate: string;
      mdTag: string;
      opponent: string | null;
      matchday: string | null;
      competition: string | null;
    }
  | { ok: false; error: ReturnType<typeof plannerErr> } {
  if (!isPlannerUuid(input.weekId)) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "weekId must be a valid UUID."),
    };
  }
  const matchOrder = parseMatchOrder(input.matchOrder);
  if (matchOrder == null) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "matchOrder must be 1 or 2."),
    };
  }
  if (!isPlannerIsoDate(input.gpsDate ?? "")) {
    return {
      ok: false,
      error: plannerErr("invalid_date", "gps_date must be a valid YYYY-MM-DD date."),
    };
  }
  const mdTag = mapNullableText(input.mdTag);
  if (!mdTag) {
    return {
      ok: false,
      error: plannerErr("invalid_md_tag", "mdTag is required."),
    };
  }
  return {
    ok: true,
    weekId: input.weekId,
    matchOrder,
    gpsDate: input.gpsDate,
    mdTag,
    opponent: mapNullableText(input.opponent),
    matchday: mapNullableText(input.matchday),
    competition: mapNullableText(input.competition),
  };
}

function mappedMatchResult(
  row: OfficialMatchDbRow | null
): PlannerResult<PlannerWeekOfficialMatch> {
  if (!row) {
    return {
      ok: false,
      error: plannerErr(
        "official_match_not_found",
        "Official match was not found for this planner week."
      ),
    };
  }
  const mapped = mapOfficialMatch(row);
  if (!mapped) {
    return {
      ok: false,
      error: plannerErr(
        "invalid_input",
        "Official match row is missing a valid match_order or md_tag."
      ),
    };
  }
  return { ok: true, data: mapped };
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
 * Explicit INSERT of one official Match row. Not an upsert.
 * Production UNIQUE(week_id) still rejects a second row in the same week.
 */
export async function createPlannerWeekOfficialMatch(
  input: CreatePlannerWeekOfficialMatchInput
): Promise<PlannerResult<PlannerWeekOfficialMatch>> {
  const auth = await requirePlannerAdminUser();
  if (!auth.ok) return { ok: false, error: auth.error };

  const parsed = validateMatchMutationInput(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const weekError = await assertWeekExists(parsed.weekId);
  if (weekError) return { ok: false, error: weekError };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_week_official_matches")
    .insert({
      week_id: parsed.weekId,
      match_order: parsed.matchOrder,
      gps_date: parsed.gpsDate,
      md_tag: parsed.mdTag,
      opponent: parsed.opponent,
      matchday: parsed.matchday,
      competition: parsed.competition,
      created_by: auth.user.id,
      updated_by: auth.user.id,
    })
    .select(MATCH_SELECT)
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: mapPlannerDbError("createPlannerWeekOfficialMatch", error),
    };
  }
  return mappedMatchResult(data as OfficialMatchDbRow);
}

/**
 * Update exactly one Match row by id + week_id. Never matches another row.
 */
export async function updatePlannerWeekOfficialMatchById(
  input: UpdatePlannerWeekOfficialMatchByIdInput
): Promise<PlannerResult<PlannerWeekOfficialMatch>> {
  const auth = await requirePlannerAdminUser();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!isPlannerUuid(input.id)) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "id must be a valid UUID."),
    };
  }

  const parsed = validateMatchMutationInput(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const weekError = await assertWeekExists(parsed.weekId);
  if (weekError) return { ok: false, error: weekError };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_week_official_matches")
    .update({
      match_order: parsed.matchOrder,
      gps_date: parsed.gpsDate,
      md_tag: parsed.mdTag,
      opponent: parsed.opponent,
      matchday: parsed.matchday,
      competition: parsed.competition,
      updated_by: auth.user.id,
    })
    .eq("id", input.id)
    .eq("week_id", parsed.weekId)
    .select(MATCH_SELECT)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: mapPlannerDbError("updatePlannerWeekOfficialMatchById", error),
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
  return mappedMatchResult(data as OfficialMatchDbRow);
}

/**
 * Delete exactly one Match row by id + weekId. Never deletes by week_id alone.
 */
export async function deletePlannerWeekOfficialMatchById(
  input: DeletePlannerWeekOfficialMatchByIdInput
): Promise<PlannerResult<{ id: string; weekId: string }>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  if (!isPlannerUuid(input.id)) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "id must be a valid UUID."),
    };
  }
  const weekError = await assertWeekExists(input.weekId);
  if (weekError) return { ok: false, error: weekError };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_week_official_matches")
    .delete()
    .eq("id", input.id)
    .eq("week_id", input.weekId)
    .select("id, week_id")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: mapPlannerDbError("deletePlannerWeekOfficialMatchById", error),
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
  return { ok: true, data: { id: input.id, weekId: input.weekId } };
}

/**
 * V1 compatibility: one official Match per week.
 * Create uses matchOrder=1 and mdTag=MD. Correction updates the existing row
 * by its id and preserves stored matchOrder/mdTag.
 */
export async function setPlannerWeekOfficialMatch(
  input: SetPlannerWeekOfficialMatchInput
): Promise<PlannerResult<PlannerWeekOfficialMatch>> {
  const auth = await requirePlannerAdminUser();
  if (!auth.ok) return { ok: false, error: auth.error };

  const parsed = validateOfficialMatchInput(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const existing = await getPlannerWeekOfficialMatch(parsed.weekId);
  if (!existing.ok) return existing;

  if (existing.data) {
    return updatePlannerWeekOfficialMatchById({
      id: existing.data.id,
      weekId: parsed.weekId,
      matchOrder: existing.data.matchOrder,
      gpsDate: parsed.gpsDate,
      mdTag: existing.data.mdTag,
      opponent: parsed.opponent,
      matchday: parsed.matchday,
      competition: parsed.competition,
    });
  }

  return createPlannerWeekOfficialMatch({
    weekId: parsed.weekId,
    matchOrder: 1,
    gpsDate: parsed.gpsDate,
    mdTag: "MD",
    opponent: parsed.opponent,
    matchday: parsed.matchday,
    competition: parsed.competition,
  });
}

/**
 * V1 compatibility: delete the week's single official Match by week_id.
 * Future two-match UI must use deletePlannerWeekOfficialMatchById.
 */
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
