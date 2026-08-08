import "server-only";

/**
 * ADMIN-ONLY Planner Phase B domain:
 * - Frozen Match Best snapshot read / reuse
 * - Weekly Target create / read / update / delete
 * - Derived weekly absolute planned (not persisted)
 *
 * No Daily Targets. No Actual. No UI. No service-role CRUD.
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
  calculateWeeklyPlannedAbsolutes,
  isValidMatchBestValue,
  isValidPlannerPercentage,
  type MatchBestMetrics,
  type WeeklyPercentageMetrics,
  type WeeklyPlannedAbsolutes,
} from "@/lib/gpsPlanner/calculations";
import { getPlayerMapping } from "@/lib/gpsPlanner/playerMappings.server";
import { getMatchBestGps } from "@/lib/powerbi/queries/matchBest.server";

import type {
  PlannerMatchBestSnapshot,
  PlannerWeeklyTargetView,
} from "@/lib/gpsPlanner/types";

export type { PlannerMatchBestSnapshot, PlannerWeeklyTargetView };

export type CreatePlannerWeeklyTargetResult = PlannerWeeklyTargetView & {
  /** true when this call created the immutable snapshot via RPC */
  snapshotCreated: boolean;
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
  source_method: string;
  created_at: string;
  created_by: string | null;
};

type WeeklyTargetDbRow = {
  week_id: string;
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

const SNAPSHOT_SELECT =
  "week_id, player_id, td_best, hsr_best, sprint_best, acc_best, dec_best, powerbi_player_name, source_method, created_at, created_by";

const TARGET_SELECT =
  "week_id, player_id, td_pct, hsr_pct, sprint_pct, acc_pct, dec_pct, created_at, updated_at, created_by, updated_by";

function mapSnapshot(row: SnapshotDbRow): PlannerMatchBestSnapshot {
  return {
    weekId: row.week_id,
    playerId: row.player_id,
    tdBest: Number(row.td_best),
    hsrBest: Number(row.hsr_best),
    sprintBest: Number(row.sprint_best),
    accBest: Number(row.acc_best),
    decBest: Number(row.dec_best),
    powerBiPlayerName: row.powerbi_player_name,
    sourceMethod: row.source_method,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

function percentagesFromTarget(row: WeeklyTargetDbRow): WeeklyPercentageMetrics {
  return {
    tdPct: Number(row.td_pct),
    hsrPct: Number(row.hsr_pct),
    sprintPct: Number(row.sprint_pct),
    accPct: Number(row.acc_pct),
    decPct: Number(row.dec_pct),
  };
}

function bestFromSnapshot(snapshot: PlannerMatchBestSnapshot): MatchBestMetrics {
  return {
    tdBest: snapshot.tdBest,
    hsrBest: snapshot.hsrBest,
    sprintBest: snapshot.sprintBest,
    accBest: snapshot.accBest,
    decBest: snapshot.decBest,
  };
}

function buildView(
  target: WeeklyTargetDbRow,
  snapshot: PlannerMatchBestSnapshot,
  displayName: string
): PlannerWeeklyTargetView {
  const pct = percentagesFromTarget(target);
  const planned: WeeklyPlannedAbsolutes = calculateWeeklyPlannedAbsolutes(
    bestFromSnapshot(snapshot),
    pct
  );
  return {
    weekId: target.week_id,
    playerId: target.player_id,
    playerDisplayName: displayName,
    ...pct,
    tdBest: snapshot.tdBest,
    hsrBest: snapshot.hsrBest,
    sprintBest: snapshot.sprintBest,
    accBest: snapshot.accBest,
    decBest: snapshot.decBest,
    powerBiPlayerName: snapshot.powerBiPlayerName,
    sourceMethod: snapshot.sourceMethod,
    ...planned,
    createdAt: target.created_at,
    updatedAt: target.updated_at,
    createdBy: target.created_by,
    updatedBy: target.updated_by,
  };
}

function validatePercentages(input: {
  tdPct: unknown;
  hsrPct: unknown;
  sprintPct: unknown;
  accPct: unknown;
  decPct: unknown;
}):
  | { ok: true; pct: WeeklyPercentageMetrics }
  | { ok: false; error: PlannerSafeError } {
  const keys = ["tdPct", "hsrPct", "sprintPct", "accPct", "decPct"] as const;
  const pct: Partial<WeeklyPercentageMetrics> = {};
  for (const key of keys) {
    const value = input[key];
    if (!isValidPlannerPercentage(value)) {
      return {
        ok: false,
        error: plannerErr(
          "invalid_percentage",
          `${key} must be a finite number >= 0 (no upper bound; human scale, e.g. 140).`
        ),
      };
    }
    pct[key] = value;
  }
  return { ok: true, pct: pct as WeeklyPercentageMetrics };
}

function validateMatchBestMetrics(data: {
  tdBest: number | null;
  hsrBest: number | null;
  sprintBest: number | null;
  accBest: number | null;
  decBest: number | null;
}):
  | { ok: true; best: MatchBestMetrics }
  | { ok: false; error: PlannerSafeError } {
  const values = [
    data.tdBest,
    data.hsrBest,
    data.sprintBest,
    data.accBest,
    data.decBest,
  ];
  for (const value of values) {
    if (value == null || !isValidMatchBestValue(value)) {
      return {
        ok: false,
        error: plannerErr(
          "match_best_incomplete",
          "Match Best values must all be finite numbers >= 0."
        ),
      };
    }
  }
  return {
    ok: true,
    best: {
      tdBest: data.tdBest as number,
      hsrBest: data.hsrBest as number,
      sprintBest: data.sprintBest as number,
      accBest: data.accBest as number,
      decBest: data.decBest as number,
    },
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
      "weeklyTargets.loadDisplayNames",
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

async function assertWeekExists(
  weekId: string
): Promise<PlannerSafeError | null> {
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
  if (!data) {
    return plannerErr("week_not_found", "Planner week was not found.");
  }
  return null;
}

async function assertPlayerProfile(
  playerId: string
): Promise<PlannerSafeError | null> {
  if (!isPlannerUuid(playerId)) {
    return plannerErr("invalid_input", "playerId must be a valid UUID.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", playerId)
    .maybeSingle();
  if (error) return mapPlannerDbError("assertPlayerProfile", error);
  if (!data) {
    return plannerErr("player_not_found", "ST-AMS player profile was not found.");
  }
  if ((data as { role: string }).role !== "player") {
    return plannerErr(
      "not_a_player",
      "Only profiles with role 'player' may receive weekly targets."
    );
  }
  return null;
}

async function lookupSnapshot(
  weekId: string,
  playerId: string
): Promise<PlannerResult<PlannerMatchBestSnapshot | null>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_match_best_snapshots")
    .select(SNAPSHOT_SELECT)
    .eq("week_id", weekId)
    .eq("player_id", playerId)
    .maybeSingle();
  if (error) {
    return { ok: false, error: mapPlannerDbError("lookupSnapshot", error) };
  }
  if (!data) return { ok: true, data: null };
  return { ok: true, data: mapSnapshot(data as SnapshotDbRow) };
}

function mapRpcError(message: string, code?: string): PlannerSafeError {
  const lower = message.toLowerCase();
  if (
    lower.includes("authentication required") ||
    lower.includes("admin access required")
  ) {
    return plannerErr("unauthorized", "Admin access required.");
  }
  if (lower.includes("role = player") || lower.includes("role = 'player'")) {
    return plannerErr(
      "not_a_player",
      "Only profiles with role 'player' may receive weekly targets."
    );
  }
  if (lower.includes("no exact powerbi mapping")) {
    return plannerErr(
      "mapping_changed",
      "Power BI mapping changed or is missing; Admin must retry deliberately."
    );
  }
  if (
    lower.includes("already exists") ||
    code === "23505"
  ) {
    return plannerErr(
      "weekly_target_already_exists",
      "A weekly target already exists for this week and player."
    );
  }
  if (lower.includes("foreign key") || code === "23503") {
    return plannerErr(
      "database_error",
      "Could not create weekly target (invalid week or player reference)."
    );
  }
  if (
    lower.includes("match best") ||
    lower.includes("percentages must") ||
    lower.includes("powerbi_player_name")
  ) {
    return plannerErr(
      "invalid_input",
      "Weekly target create was rejected by validation."
    );
  }
  const safe = plannerErr(
    "database_error",
    "Could not create weekly target."
  );
  logPlannerError("createPlannerWeeklyTarget.rpc", safe, { code, message });
  return safe;
}

/**
 * Admin-only read of frozen Match Best snapshot for week + player.
 * No mutation capability.
 */
export async function getPlannerMatchBestSnapshot(
  weekId: string,
  playerId: string
): Promise<PlannerResult<PlannerMatchBestSnapshot | null>> {
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

  return lookupSnapshot(weekId, playerId);
}

export type CreatePlannerWeeklyTargetInput = {
  weekId: string;
  playerId: string;
  tdPct: number;
  hsrPct: number;
  sprintPct: number;
  accPct: number;
  decPct: number;
};

/**
 * Create Weekly Target for week + player.
 * CRITICAL: snapshot lookup first.
 * - Snapshot exists → target-only INSERT (no Power BI, no mapping refresh).
 * - Snapshot missing → exact current mapping → getMatchBestGps → atomic RPC.
 */
export async function createPlannerWeeklyTarget(
  input: CreatePlannerWeeklyTargetInput
): Promise<PlannerResult<CreatePlannerWeeklyTargetResult>> {
  const auth = await requirePlannerAdminUser();
  if (!auth.ok) return { ok: false, error: auth.error };

  const pctCheck = validatePercentages(input);
  if (!pctCheck.ok) return { ok: false, error: pctCheck.error };

  const weekError = await assertWeekExists(input.weekId);
  if (weekError) return { ok: false, error: weekError };

  const playerError = await assertPlayerProfile(input.playerId);
  if (playerError) return { ok: false, error: playerError };

  const snapshotLookup = await lookupSnapshot(input.weekId, input.playerId);
  if (!snapshotLookup.ok) return snapshotLookup;

  // PATH A — existing frozen snapshot: target-only insert
  if (snapshotLookup.data) {
    const snapshot = snapshotLookup.data;
    const supabase = await createClient();

    const { data: existingTarget, error: existingError } = await supabase
      .from("planner_weekly_targets")
      .select("week_id")
      .eq("week_id", input.weekId)
      .eq("player_id", input.playerId)
      .maybeSingle();
    if (existingError) {
      return {
        ok: false,
        error: mapPlannerDbError("createPlannerWeeklyTarget.existing", existingError),
      };
    }
    if (existingTarget) {
      return {
        ok: false,
        error: plannerErr(
          "weekly_target_already_exists",
          "A weekly target already exists for this week and player."
        ),
      };
    }

    const { data, error } = await supabase
      .from("planner_weekly_targets")
      .insert({
        week_id: input.weekId,
        player_id: input.playerId,
        td_pct: pctCheck.pct.tdPct,
        hsr_pct: pctCheck.pct.hsrPct,
        sprint_pct: pctCheck.pct.sprintPct,
        acc_pct: pctCheck.pct.accPct,
        dec_pct: pctCheck.pct.decPct,
        created_by: auth.user.id,
        updated_by: auth.user.id,
      })
      .select(TARGET_SELECT)
      .single();

    if (error || !data) {
      return {
        ok: false,
        error: mapPlannerDbError("createPlannerWeeklyTarget.insert", error),
      };
    }

    const names = await loadDisplayNames([input.playerId]);
    return {
      ok: true,
      data: {
        ...buildView(
          data as WeeklyTargetDbRow,
          snapshot,
          names.get(input.playerId) ?? "Unknown player"
        ),
        snapshotCreated: false,
      },
    };
  }

  // PATH B — no snapshot: mapping → Match Best → atomic RPC
  const mapping = await getPlayerMapping(input.playerId);
  if (!mapping.ok) {
    if (mapping.error.code === "unauthorized") {
      return { ok: false, error: plannerErr("unauthorized", mapping.error.message) };
    }
    if (mapping.error.code === "powerbi_error") {
      return {
        ok: false,
        error: plannerErr("powerbi_error", mapping.error.message),
      };
    }
    return {
      ok: false,
      error: plannerErr("database_error", "Could not load Power BI mapping."),
    };
  }
  if (!mapping.data) {
    return {
      ok: false,
      error: plannerErr(
        "mapping_not_found",
        "No Power BI mapping found for this player."
      ),
    };
  }

  // Exact stored mapping string — no trim/case rewrite for identity.
  const exactPowerBiName = mapping.data.externalPlayerName;

  const matchBest = await getMatchBestGps({ playerName: exactPowerBiName });
  if (!matchBest.ok) {
    if (matchBest.error.code === "not_found") {
      return {
        ok: false,
        error: plannerErr(
          "match_best_not_found",
          "No single-match best row matched this Power BI player."
        ),
      };
    }
    if (matchBest.error.code === "ambiguous") {
      return {
        ok: false,
        error: plannerErr(
          "match_best_ambiguous",
          "Multiple single-match best rows matched this Power BI player."
        ),
      };
    }
    if (matchBest.error.code === "invalid_input") {
      return {
        ok: false,
        error: plannerErr("invalid_input", matchBest.error.message),
      };
    }
    return {
      ok: false,
      error: plannerErr(
        "powerbi_error",
        "Could not load Match Best from Power BI."
      ),
    };
  }

  const bestCheck = validateMatchBestMetrics(matchBest.data);
  if (!bestCheck.ok) return { ok: false, error: bestCheck.error };

  const supabase = await createClient();
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "planner_create_snapshot_and_weekly_target",
    {
      p_week_id: input.weekId,
      p_player_id: input.playerId,
      p_powerbi_player_name: exactPowerBiName,
      p_td_best: bestCheck.best.tdBest,
      p_hsr_best: bestCheck.best.hsrBest,
      p_sprint_best: bestCheck.best.sprintBest,
      p_acc_best: bestCheck.best.accBest,
      p_dec_best: bestCheck.best.decBest,
      p_td_pct: pctCheck.pct.tdPct,
      p_hsr_pct: pctCheck.pct.hsrPct,
      p_sprint_pct: pctCheck.pct.sprintPct,
      p_acc_pct: pctCheck.pct.accPct,
      p_dec_pct: pctCheck.pct.decPct,
    }
  );

  if (rpcError) {
    return {
      ok: false,
      error: mapRpcError(rpcError.message ?? "", rpcError.code),
    };
  }

  const payload = rpcData as {
    snapshot?: SnapshotDbRow;
    weekly_target?: WeeklyTargetDbRow;
  } | null;

  if (!payload?.snapshot || !payload?.weekly_target) {
    return {
      ok: false,
      error: plannerErr(
        "database_error",
        "Atomic create returned an unexpected response."
      ),
    };
  }

  const snapshot = mapSnapshot(payload.snapshot);
  const names = await loadDisplayNames([input.playerId]);
  return {
    ok: true,
    data: {
      ...buildView(
        payload.weekly_target,
        snapshot,
        names.get(input.playerId) ?? "Unknown player"
      ),
      snapshotCreated: true,
    },
  };
}

export async function getPlannerWeeklyTarget(
  weekId: string,
  playerId: string
): Promise<PlannerResult<PlannerWeeklyTargetView | null>> {
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
  const { data: target, error: targetError } = await supabase
    .from("planner_weekly_targets")
    .select(TARGET_SELECT)
    .eq("week_id", weekId)
    .eq("player_id", playerId)
    .maybeSingle();
  if (targetError) {
    return {
      ok: false,
      error: mapPlannerDbError("getPlannerWeeklyTarget", targetError),
    };
  }
  if (!target) return { ok: true, data: null };

  const snapshotLookup = await lookupSnapshot(weekId, playerId);
  if (!snapshotLookup.ok) return snapshotLookup;
  if (!snapshotLookup.data) {
    return {
      ok: false,
      error: plannerErr(
        "database_error",
        "Weekly target exists without a Match Best snapshot."
      ),
    };
  }

  const names = await loadDisplayNames([playerId]);
  return {
    ok: true,
    data: buildView(
      target as WeeklyTargetDbRow,
      snapshotLookup.data,
      names.get(playerId) ?? "Unknown player"
    ),
  };
}

/** List Weekly Targets for a planner week (with frozen snapshot + derived absolutes). */
export async function listPlannerWeeklyTargets(
  weekId: string
): Promise<PlannerResult<PlannerWeeklyTargetView[]>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  const weekError = await assertWeekExists(weekId);
  if (weekError) return { ok: false, error: weekError };

  const supabase = await createClient();
  const { data: targets, error: targetError } = await supabase
    .from("planner_weekly_targets")
    .select(TARGET_SELECT)
    .eq("week_id", weekId)
    .order("player_id", { ascending: true });
  if (targetError) {
    return {
      ok: false,
      error: mapPlannerDbError("listPlannerWeeklyTargets", targetError),
    };
  }

  const rows = (targets ?? []) as WeeklyTargetDbRow[];
  if (rows.length === 0) return { ok: true, data: [] };

  const playerIds = rows.map((r) => r.player_id);
  const { data: snapshots, error: snapError } = await supabase
    .from("planner_match_best_snapshots")
    .select(SNAPSHOT_SELECT)
    .eq("week_id", weekId)
    .in("player_id", playerIds);
  if (snapError) {
    return {
      ok: false,
      error: mapPlannerDbError("listPlannerWeeklyTargets.snapshots", snapError),
    };
  }

  const snapByPlayer = new Map<string, PlannerMatchBestSnapshot>();
  for (const row of (snapshots ?? []) as SnapshotDbRow[]) {
    snapByPlayer.set(row.player_id, mapSnapshot(row));
  }

  const names = await loadDisplayNames(playerIds);
  const out: PlannerWeeklyTargetView[] = [];
  for (const target of rows) {
    const snapshot = snapByPlayer.get(target.player_id);
    if (!snapshot) {
      return {
        ok: false,
        error: plannerErr(
          "database_error",
          "Weekly target exists without a Match Best snapshot."
        ),
      };
    }
    out.push(
      buildView(
        target,
        snapshot,
        names.get(target.player_id) ?? "Unknown player"
      )
    );
  }
  return { ok: true, data: out };
}

export type UpdatePlannerWeeklyTargetInput = {
  weekId: string;
  playerId: string;
  tdPct: number;
  hsrPct: number;
  sprintPct: number;
  accPct: number;
  decPct: number;
};

/**
 * Update Weekly Target percentages only.
 * Never touches snapshot / frozen Power BI name / Match Best / source_method.
 * Does not call Power BI or mapping resolvers.
 */
export async function updatePlannerWeeklyTarget(
  input: UpdatePlannerWeeklyTargetInput
): Promise<PlannerResult<PlannerWeeklyTargetView>> {
  const auth = await requirePlannerAdminUser();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!isPlannerUuid(input.weekId) || !isPlannerUuid(input.playerId)) {
    return {
      ok: false,
      error: plannerErr(
        "invalid_input",
        "weekId and playerId must be valid UUIDs."
      ),
    };
  }

  const pctCheck = validatePercentages(input);
  if (!pctCheck.ok) return { ok: false, error: pctCheck.error };

  const snapshotLookup = await lookupSnapshot(input.weekId, input.playerId);
  if (!snapshotLookup.ok) return snapshotLookup;
  if (!snapshotLookup.data) {
    return {
      ok: false,
      error: plannerErr(
        "weekly_target_not_found",
        "No Match Best snapshot / weekly target found for this week and player."
      ),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_weekly_targets")
    .update({
      td_pct: pctCheck.pct.tdPct,
      hsr_pct: pctCheck.pct.hsrPct,
      sprint_pct: pctCheck.pct.sprintPct,
      acc_pct: pctCheck.pct.accPct,
      dec_pct: pctCheck.pct.decPct,
      updated_by: auth.user.id,
    })
    .eq("week_id", input.weekId)
    .eq("player_id", input.playerId)
    .select(TARGET_SELECT)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: mapPlannerDbError("updatePlannerWeeklyTarget", error),
    };
  }
  if (!data) {
    return {
      ok: false,
      error: plannerErr(
        "weekly_target_not_found",
        "Weekly target was not found."
      ),
    };
  }

  const names = await loadDisplayNames([input.playerId]);
  return {
    ok: true,
    data: buildView(
      data as WeeklyTargetDbRow,
      snapshotLookup.data,
      names.get(input.playerId) ?? "Unknown player"
    ),
  };
}

export type DeletePlannerWeeklyTargetInput = {
  weekId: string;
  playerId: string;
  /** Must be true. Does NOT delete the frozen Match Best snapshot. */
  confirm: true;
};

/**
 * Delete Weekly Target only. Snapshot remains.
 * Future Daily Targets for this week/player will cascade from the weekly target FK.
 * Recreate later must reuse the existing snapshot (no Power BI).
 */
export async function deletePlannerWeeklyTarget(
  input: DeletePlannerWeeklyTargetInput
): Promise<PlannerResult<{ weekId: string; playerId: string }>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  if (input.confirm !== true) {
    return {
      ok: false,
      error: plannerErr(
        "confirmation_required",
        "Deleting a weekly target requires confirm: true."
      ),
    };
  }
  if (!isPlannerUuid(input.weekId) || !isPlannerUuid(input.playerId)) {
    return {
      ok: false,
      error: plannerErr(
        "invalid_input",
        "weekId and playerId must be valid UUIDs."
      ),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_weekly_targets")
    .delete()
    .eq("week_id", input.weekId)
    .eq("player_id", input.playerId)
    .select("week_id, player_id")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: mapPlannerDbError("deletePlannerWeeklyTarget", error),
    };
  }
  if (!data) {
    return {
      ok: false,
      error: plannerErr(
        "weekly_target_not_found",
        "Weekly target was not found."
      ),
    };
  }

  return {
    ok: true,
    data: { weekId: input.weekId, playerId: input.playerId },
  };
}
