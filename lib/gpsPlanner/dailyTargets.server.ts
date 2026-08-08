import "server-only";

/**
 * ADMIN-ONLY Planner Phase C — Daily Target CRUD.
 * Daily Planned = Frozen Match Best × Daily % / 100 (NOT % of Weekly Target).
 * No Power BI. No mapping. No Actual. No UI. No service-role.
 */

import { createClient } from "@/lib/supabase/server";
import { playerDisplayName } from "@/lib/players/listPlayers";
import {
  requirePlannerAdmin,
  requirePlannerAdminUser,
} from "@/lib/gpsPlanner/auth.server";
import {
  isPlannerUuid,
  logPlannerError,
  mapPlannerDbError,
  plannerErr,
  type PlannerResult,
  type PlannerSafeError,
} from "@/lib/gpsPlanner/common";
import {
  calculateDailyPlannedAbsolutes,
  isValidPlannerPercentage,
  type MatchBestMetrics,
  type PercentageMetrics,
} from "@/lib/gpsPlanner/calculations";

import type { PlannerDailyTargetView } from "@/lib/gpsPlanner/types";

export type { PlannerDailyTargetView };

type DayDbRow = {
  id: string;
  week_id: string;
  date: string;
  md_tag: string;
};

type SnapshotDbRow = {
  week_id: string;
  player_id: string;
  td_best: number;
  hsr_best: number;
  sprint_best: number;
  acc_best: number;
  dec_best: number;
  powerbi_player_name: string;
};

type DailyTargetDbRow = {
  week_id: string;
  week_day_id: string;
  player_id: string;
  td_pct: number;
  hsr_pct: number;
  sprint_pct: number;
  acc_pct: number;
  dec_pct: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

const DAY_SELECT = "id, week_id, date, md_tag";
const SNAPSHOT_SELECT =
  "week_id, player_id, td_best, hsr_best, sprint_best, acc_best, dec_best, powerbi_player_name";
const DAILY_SELECT =
  "week_id, week_day_id, player_id, td_pct, hsr_pct, sprint_pct, acc_pct, dec_pct, created_at, updated_at, created_by, updated_by";

function validatePercentages(input: {
  tdPct: unknown;
  hsrPct: unknown;
  sprintPct: unknown;
  accPct: unknown;
  decPct: unknown;
}):
  | { ok: true; pct: PercentageMetrics }
  | { ok: false; error: PlannerSafeError } {
  const keys = ["tdPct", "hsrPct", "sprintPct", "accPct", "decPct"] as const;
  const pct: Partial<PercentageMetrics> = {};
  for (const key of keys) {
    const value = input[key];
    if (!isValidPlannerPercentage(value)) {
      return {
        ok: false,
        error: plannerErr(
          "invalid_percentage",
          `${key} must be a finite number >= 0 (no upper bound; human scale).`
        ),
      };
    }
    pct[key] = value;
  }
  return { ok: true, pct: pct as PercentageMetrics };
}

function bestFromSnapshot(row: SnapshotDbRow): MatchBestMetrics {
  return {
    tdBest: Number(row.td_best),
    hsrBest: Number(row.hsr_best),
    sprintBest: Number(row.sprint_best),
    accBest: Number(row.acc_best),
    decBest: Number(row.dec_best),
  };
}

function pctFromDaily(row: DailyTargetDbRow): PercentageMetrics {
  return {
    tdPct: Number(row.td_pct),
    hsrPct: Number(row.hsr_pct),
    sprintPct: Number(row.sprint_pct),
    accPct: Number(row.acc_pct),
    decPct: Number(row.dec_pct),
  };
}

function buildView(
  target: DailyTargetDbRow,
  day: DayDbRow,
  snapshot: SnapshotDbRow,
  displayName: string
): PlannerDailyTargetView {
  const pct = pctFromDaily(target);
  const best = bestFromSnapshot(snapshot);
  const planned = calculateDailyPlannedAbsolutes(best, pct);
  return {
    weekId: target.week_id,
    weekDayId: target.week_day_id,
    date: day.date,
    mdTag: day.md_tag,
    playerId: target.player_id,
    playerDisplayName: displayName,
    ...pct,
    ...best,
    powerBiPlayerName: snapshot.powerbi_player_name,
    ...planned,
    createdAt: target.created_at,
    updatedAt: target.updated_at,
    createdBy: target.created_by,
    updatedBy: target.updated_by,
  };
}

async function loadDisplayNames(
  playerIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (playerIds.length === 0) return map;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", playerIds);
  if (error) {
    logPlannerError(
      "dailyTargets.loadDisplayNames",
      plannerErr("database_error", "Could not load player display names."),
      { code: error.code, message: error.message }
    );
    for (const id of playerIds) map.set(id, "Unknown player");
    return map;
  }
  for (const row of (data ?? []) as {
    id: string;
    full_name: string | null;
    email: string | null;
  }[]) {
    map.set(row.id, playerDisplayName(row.full_name, row.email));
  }
  for (const id of playerIds) {
    if (!map.has(id)) map.set(id, "Unknown player");
  }
  return map;
}

async function loadWeekDay(
  weekDayId: string
): Promise<PlannerResult<DayDbRow>> {
  if (!isPlannerUuid(weekDayId)) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "weekDayId must be a valid UUID."),
    };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_week_days")
    .select(DAY_SELECT)
    .eq("id", weekDayId)
    .maybeSingle();
  if (error) {
    return { ok: false, error: mapPlannerDbError("loadWeekDay", error) };
  }
  if (!data) {
    return {
      ok: false,
      error: plannerErr("day_not_found", "Planner week day was not found."),
    };
  }
  return { ok: true, data: data as DayDbRow };
}

async function loadSnapshot(
  weekId: string,
  playerId: string
): Promise<PlannerResult<SnapshotDbRow>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_match_best_snapshots")
    .select(SNAPSHOT_SELECT)
    .eq("week_id", weekId)
    .eq("player_id", playerId)
    .maybeSingle();
  if (error) {
    return { ok: false, error: mapPlannerDbError("loadSnapshot", error) };
  }
  if (!data) {
    return {
      ok: false,
      error: plannerErr(
        "weekly_target_not_found",
        "No frozen Match Best snapshot / weekly target for this week and player."
      ),
    };
  }
  return { ok: true, data: data as SnapshotDbRow };
}

async function assertWeeklyTargetExists(
  weekId: string,
  playerId: string
): Promise<PlannerSafeError | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_weekly_targets")
    .select("week_id")
    .eq("week_id", weekId)
    .eq("player_id", playerId)
    .maybeSingle();
  if (error) return mapPlannerDbError("assertWeeklyTargetExists", error);
  if (!data) {
    return plannerErr(
      "weekly_target_not_found",
      "A weekly target is required before creating a daily target."
    );
  }
  return null;
}

export type CreatePlannerDailyTargetInput = {
  weekDayId: string;
  playerId: string;
  tdPct: number;
  hsrPct: number;
  sprintPct: number;
  accPct: number;
  decPct: number;
};

export async function createPlannerDailyTarget(
  input: CreatePlannerDailyTargetInput
): Promise<PlannerResult<PlannerDailyTargetView>> {
  const auth = await requirePlannerAdminUser();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!isPlannerUuid(input.playerId)) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "playerId must be a valid UUID."),
    };
  }

  const pctCheck = validatePercentages(input);
  if (!pctCheck.ok) return { ok: false, error: pctCheck.error };

  const dayResult = await loadWeekDay(input.weekDayId);
  if (!dayResult.ok) return dayResult;
  const day = dayResult.data;

  const weeklyError = await assertWeeklyTargetExists(day.week_id, input.playerId);
  if (weeklyError) return { ok: false, error: weeklyError };

  const snapshotResult = await loadSnapshot(day.week_id, input.playerId);
  if (!snapshotResult.ok) return snapshotResult;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_daily_targets")
    .insert({
      week_id: day.week_id,
      week_day_id: input.weekDayId,
      player_id: input.playerId,
      td_pct: pctCheck.pct.tdPct,
      hsr_pct: pctCheck.pct.hsrPct,
      sprint_pct: pctCheck.pct.sprintPct,
      acc_pct: pctCheck.pct.accPct,
      dec_pct: pctCheck.pct.decPct,
      created_by: auth.user.id,
      updated_by: auth.user.id,
    })
    .select(DAILY_SELECT)
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: mapPlannerDbError("createPlannerDailyTarget", error),
    };
  }

  const names = await loadDisplayNames([input.playerId]);
  return {
    ok: true,
    data: buildView(
      data as DailyTargetDbRow,
      day,
      snapshotResult.data,
      names.get(input.playerId) ?? "Unknown player"
    ),
  };
}

export async function getPlannerDailyTarget(
  weekDayId: string,
  playerId: string
): Promise<PlannerResult<PlannerDailyTargetView | null>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  if (!isPlannerUuid(weekDayId) || !isPlannerUuid(playerId)) {
    return {
      ok: false,
      error: plannerErr(
        "invalid_input",
        "weekDayId and playerId must be valid UUIDs."
      ),
    };
  }

  const dayResult = await loadWeekDay(weekDayId);
  if (!dayResult.ok) return dayResult;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_daily_targets")
    .select(DAILY_SELECT)
    .eq("week_day_id", weekDayId)
    .eq("player_id", playerId)
    .maybeSingle();
  if (error) {
    return { ok: false, error: mapPlannerDbError("getPlannerDailyTarget", error) };
  }
  if (!data) return { ok: true, data: null };

  const snapshotResult = await loadSnapshot(dayResult.data.week_id, playerId);
  if (!snapshotResult.ok) return snapshotResult;

  const names = await loadDisplayNames([playerId]);
  return {
    ok: true,
    data: buildView(
      data as DailyTargetDbRow,
      dayResult.data,
      snapshotResult.data,
      names.get(playerId) ?? "Unknown player"
    ),
  };
}

export async function listPlannerDailyTargetsForDay(
  weekDayId: string
): Promise<PlannerResult<PlannerDailyTargetView[]>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  const dayResult = await loadWeekDay(weekDayId);
  if (!dayResult.ok) return dayResult;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_daily_targets")
    .select(DAILY_SELECT)
    .eq("week_day_id", weekDayId)
    .order("player_id", { ascending: true });
  if (error) {
    return {
      ok: false,
      error: mapPlannerDbError("listPlannerDailyTargetsForDay", error),
    };
  }

  const rows = (data ?? []) as DailyTargetDbRow[];
  if (rows.length === 0) return { ok: true, data: [] };

  const playerIds = rows.map((r) => r.player_id);
  const { data: snapshots, error: snapError } = await supabase
    .from("planner_match_best_snapshots")
    .select(SNAPSHOT_SELECT)
    .eq("week_id", dayResult.data.week_id)
    .in("player_id", playerIds);
  if (snapError) {
    return {
      ok: false,
      error: mapPlannerDbError("listPlannerDailyTargetsForDay.snapshots", snapError),
    };
  }

  const snapByPlayer = new Map<string, SnapshotDbRow>();
  for (const row of (snapshots ?? []) as SnapshotDbRow[]) {
    snapByPlayer.set(row.player_id, row);
  }

  const names = await loadDisplayNames(playerIds);
  const out: PlannerDailyTargetView[] = [];
  for (const target of rows) {
    const snapshot = snapByPlayer.get(target.player_id);
    if (!snapshot) {
      return {
        ok: false,
        error: plannerErr(
          "database_error",
          "Daily target exists without a Match Best snapshot."
        ),
      };
    }
    out.push(
      buildView(
        target,
        dayResult.data,
        snapshot,
        names.get(target.player_id) ?? "Unknown player"
      )
    );
  }
  return { ok: true, data: out };
}

/** List Daily Targets for one player in a planner week (allocation / progress). */
export async function listPlannerDailyTargetsForPlayerWeek(
  weekId: string,
  playerId: string
): Promise<PlannerResult<PlannerDailyTargetView[]>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  if (!isPlannerUuid(weekId) || !isPlannerUuid(playerId)) {
    return {
      ok: false,
      error: plannerErr(
        "invalid_input",
        "weekId and playerId must be valid UUIDs."
      ),
    };
  }

  const supabase = await createClient();
  const { data: targets, error } = await supabase
    .from("planner_daily_targets")
    .select(DAILY_SELECT)
    .eq("week_id", weekId)
    .eq("player_id", playerId);
  if (error) {
    return {
      ok: false,
      error: mapPlannerDbError("listPlannerDailyTargetsForPlayerWeek", error),
    };
  }

  const rows = (targets ?? []) as DailyTargetDbRow[];
  if (rows.length === 0) return { ok: true, data: [] };

  const dayIds = rows.map((r) => r.week_day_id);
  const { data: days, error: daysError } = await supabase
    .from("planner_week_days")
    .select(DAY_SELECT)
    .in("id", dayIds);
  if (daysError) {
    return {
      ok: false,
      error: mapPlannerDbError(
        "listPlannerDailyTargetsForPlayerWeek.days",
        daysError
      ),
    };
  }

  const dayById = new Map<string, DayDbRow>();
  for (const d of (days ?? []) as DayDbRow[]) dayById.set(d.id, d);

  const snapshotResult = await loadSnapshot(weekId, playerId);
  if (!snapshotResult.ok) return snapshotResult;

  const names = await loadDisplayNames([playerId]);
  const out: PlannerDailyTargetView[] = [];
  for (const target of rows) {
    const day = dayById.get(target.week_day_id);
    if (!day) {
      return {
        ok: false,
        error: plannerErr("day_not_found", "Daily target references missing week day."),
      };
    }
    out.push(
      buildView(
        target,
        day,
        snapshotResult.data,
        names.get(playerId) ?? "Unknown player"
      )
    );
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { ok: true, data: out };
}

export type UpdatePlannerDailyTargetInput = {
  weekDayId: string;
  playerId: string;
  tdPct: number;
  hsrPct: number;
  sprintPct: number;
  accPct: number;
  decPct: number;
};

export async function updatePlannerDailyTarget(
  input: UpdatePlannerDailyTargetInput
): Promise<PlannerResult<PlannerDailyTargetView>> {
  const auth = await requirePlannerAdminUser();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!isPlannerUuid(input.weekDayId) || !isPlannerUuid(input.playerId)) {
    return {
      ok: false,
      error: plannerErr(
        "invalid_input",
        "weekDayId and playerId must be valid UUIDs."
      ),
    };
  }

  const pctCheck = validatePercentages(input);
  if (!pctCheck.ok) return { ok: false, error: pctCheck.error };

  const dayResult = await loadWeekDay(input.weekDayId);
  if (!dayResult.ok) return dayResult;

  const snapshotResult = await loadSnapshot(
    dayResult.data.week_id,
    input.playerId
  );
  if (!snapshotResult.ok) return snapshotResult;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_daily_targets")
    .update({
      td_pct: pctCheck.pct.tdPct,
      hsr_pct: pctCheck.pct.hsrPct,
      sprint_pct: pctCheck.pct.sprintPct,
      acc_pct: pctCheck.pct.accPct,
      dec_pct: pctCheck.pct.decPct,
      updated_by: auth.user.id,
    })
    .eq("week_day_id", input.weekDayId)
    .eq("player_id", input.playerId)
    .select(DAILY_SELECT)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: mapPlannerDbError("updatePlannerDailyTarget", error),
    };
  }
  if (!data) {
    return {
      ok: false,
      error: plannerErr(
        "daily_target_not_found",
        "Daily target was not found."
      ),
    };
  }

  const names = await loadDisplayNames([input.playerId]);
  return {
    ok: true,
    data: buildView(
      data as DailyTargetDbRow,
      dayResult.data,
      snapshotResult.data,
      names.get(input.playerId) ?? "Unknown player"
    ),
  };
}

export type DeletePlannerDailyTargetInput = {
  weekDayId: string;
  playerId: string;
  confirm: true;
};

/**
 * Delete Daily Target only. Does not delete Weekly Target, snapshot, or Week Day.
 */
export async function deletePlannerDailyTarget(
  input: DeletePlannerDailyTargetInput
): Promise<PlannerResult<{ weekDayId: string; playerId: string }>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  if (input.confirm !== true) {
    return {
      ok: false,
      error: plannerErr(
        "confirmation_required",
        "Deleting a daily target requires confirm: true."
      ),
    };
  }
  if (!isPlannerUuid(input.weekDayId) || !isPlannerUuid(input.playerId)) {
    return {
      ok: false,
      error: plannerErr(
        "invalid_input",
        "weekDayId and playerId must be valid UUIDs."
      ),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_daily_targets")
    .delete()
    .eq("week_day_id", input.weekDayId)
    .eq("player_id", input.playerId)
    .select("week_day_id, player_id")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: mapPlannerDbError("deletePlannerDailyTarget", error),
    };
  }
  if (!data) {
    return {
      ok: false,
      error: plannerErr(
        "daily_target_not_found",
        "Daily target was not found."
      ),
    };
  }

  return {
    ok: true,
    data: { weekDayId: input.weekDayId, playerId: input.playerId },
  };
}
