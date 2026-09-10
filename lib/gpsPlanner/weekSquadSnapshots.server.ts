import "server-only";

/**
 * Insert-only Match Best snapshots for the persisted week squad.
 * Triggered when a planner week is saved as active/closed, or when the
 * squad is saved while the week is already active/closed.
 * Does not create Weekly or Daily Targets. Never updates/deletes snapshots.
 */

import { getPlayerMapping } from "@/lib/gpsPlanner/playerMappings.server";
import { requirePlannerAdminUser } from "@/lib/gpsPlanner/auth.server";
import {
  isPlannerUuid,
  logPlannerError,
  mapPlannerDbError,
  plannerErr,
  type PlannerErrorCode,
  type PlannerResult,
  type PlannerSafeError,
  type PlannerWeekStatus,
} from "@/lib/gpsPlanner/common";
import { isValidMatchBestValue, type MatchBestMetrics } from "@/lib/gpsPlanner/calculations";
import {
  formatMappedSnapshotIssueWarning,
  formatMappedSnapshotTechnicalWarning,
} from "@/lib/gpsPlanner/uiDisplay";
import { playerDisplayName } from "@/lib/players/listPlayers";
import { getMatchBestGps } from "@/lib/powerbi/queries/matchBest.server";
import { createClient } from "@/lib/supabase/server";

export type WeekSquadSnapshotIssue = {
  playerId: string;
  code: PlannerErrorCode;
  message: string;
};

export type WeekSquadSnapshotSyncResult = {
  weekId: string;
  status: PlannerWeekStatus | null;
  ran: boolean;
  attemptedPlayerIds: string[];
  createdPlayerIds: string[];
  skippedExistingPlayerIds: string[];
  skippedUnmappedPlayerIds: string[];
  issues: WeekSquadSnapshotIssue[];
};

export function weekStatusFreezesSquadSnapshots(
  status: string | null | undefined
): boolean {
  return status === "active" || status === "closed";
}

function emptySync(
  weekId: string,
  extras?: Partial<WeekSquadSnapshotSyncResult>
): WeekSquadSnapshotSyncResult {
  return {
    weekId,
    status: extras?.status ?? null,
    ran: extras?.ran ?? false,
    attemptedPlayerIds: extras?.attemptedPlayerIds ?? [],
    createdPlayerIds: extras?.createdPlayerIds ?? [],
    skippedExistingPlayerIds: extras?.skippedExistingPlayerIds ?? [],
    skippedUnmappedPlayerIds: extras?.skippedUnmappedPlayerIds ?? [],
    issues: extras?.issues ?? [],
  };
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

function issue(
  playerId: string,
  error: PlannerSafeError
): WeekSquadSnapshotIssue {
  return { playerId, code: error.code, message: error.message };
}

async function loadWeekSquadPlayerIds(
  weekId: string
): Promise<PlannerResult<string[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_week_players")
    .select("player_id")
    .eq("week_id", weekId);

  if (error) {
    return {
      ok: false,
      error: mapPlannerDbError("ensureWeekSquadMatchBestSnapshots.squad", error),
    };
  }
  const ids = ((data ?? []) as { player_id: string }[])
    .map((row) => row.player_id)
    .filter((id) => isPlannerUuid(id));
  return { ok: true, data: [...new Set(ids)] };
}

async function loadExistingSnapshotPlayerIds(
  weekId: string
): Promise<PlannerResult<Set<string>>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_match_best_snapshots")
    .select("player_id")
    .eq("week_id", weekId);

  if (error) {
    return {
      ok: false,
      error: mapPlannerDbError(
        "ensureWeekSquadMatchBestSnapshots.existing",
        error
      ),
    };
  }
  return {
    ok: true,
    data: new Set(
      ((data ?? []) as { player_id: string }[]).map((row) => row.player_id)
    ),
  };
}

async function insertSnapshot(input: {
  weekId: string;
  playerId: string;
  powerBiPlayerName: string;
  best: MatchBestMetrics;
  createdBy: string;
}): Promise<"created" | "exists" | PlannerSafeError> {
  const supabase = await createClient();
  const { error } = await supabase.from("planner_match_best_snapshots").insert({
    week_id: input.weekId,
    player_id: input.playerId,
    td_best: input.best.tdBest,
    hsr_best: input.best.hsrBest,
    sprint_best: input.best.sprintBest,
    acc_best: input.best.accBest,
    dec_best: input.best.decBest,
    powerbi_player_name: input.powerBiPlayerName,
    source_method: "single-match best",
    created_by: input.createdBy,
  });

  if (!error) return "created";
  if (error.code === "23505") return "exists";
  const mapped = mapPlannerDbError(
    "ensureWeekSquadMatchBestSnapshots.insert",
    error
  );
  if (mapped.code === "weekly_target_already_exists") return "exists";
  return mapped;
}

type FreezeOutcome =
  | { kind: "created" }
  | { kind: "unmapped" }
  | { kind: "exists" }
  | { kind: "issue"; issue: WeekSquadSnapshotIssue };

async function freezeOnePlayer(input: {
  weekId: string;
  playerId: string;
  createdBy: string;
}): Promise<FreezeOutcome> {
  const mapping = await getPlayerMapping(input.playerId);
  if (!mapping.ok) {
    const code: PlannerErrorCode =
      mapping.error.code === "unauthorized"
        ? "unauthorized"
        : mapping.error.code === "powerbi_error"
          ? "powerbi_error"
          : "database_error";
    const message =
      code === "unauthorized"
        ? mapping.error.message
        : code === "powerbi_error"
          ? mapping.error.message
          : "Could not load Power BI mapping.";
    return { kind: "issue", issue: issue(input.playerId, plannerErr(code, message)) };
  }
  if (!mapping.data) {
    return { kind: "unmapped" };
  }

  const exactPowerBiName = mapping.data.externalPlayerName;
  const matchBest = await getMatchBestGps({ playerName: exactPowerBiName });
  if (!matchBest.ok) {
    if (matchBest.error.code === "not_found") {
      return {
        kind: "issue",
        issue: issue(
          input.playerId,
          plannerErr(
            "match_best_not_found",
            "No single-match best row matched this Power BI player."
          )
        ),
      };
    }
    if (matchBest.error.code === "ambiguous") {
      return {
        kind: "issue",
        issue: issue(
          input.playerId,
          plannerErr(
            "match_best_ambiguous",
            "Multiple single-match best rows matched this Power BI player."
          )
        ),
      };
    }
    if (matchBest.error.code === "invalid_input") {
      return {
        kind: "issue",
        issue: issue(
          input.playerId,
          plannerErr("invalid_input", matchBest.error.message)
        ),
      };
    }
    return {
      kind: "issue",
      issue: issue(
        input.playerId,
        plannerErr("powerbi_error", "Could not load Match Best from Power BI.")
      ),
    };
  }

  const bestCheck = validateMatchBestMetrics(matchBest.data);
  if (!bestCheck.ok) {
    return { kind: "issue", issue: issue(input.playerId, bestCheck.error) };
  }

  const inserted = await insertSnapshot({
    weekId: input.weekId,
    playerId: input.playerId,
    powerBiPlayerName: exactPowerBiName,
    best: bestCheck.best,
    createdBy: input.createdBy,
  });
  if (inserted === "created") return { kind: "created" };
  if (inserted === "exists") return { kind: "exists" };
  return { kind: "issue", issue: issue(input.playerId, inserted) };
}

/**
 * Insert-only freeze for every current week-squad member who has no snapshot.
 * Existing (week_id, player_id) rows are never updated or deleted.
 * Missing exact Power BI mapping is skipped silently (not an Admin issue).
 * Mapped Match Best / insert failures are recorded per player; others still freeze.
 */
export async function ensureWeekSquadMatchBestSnapshots(
  weekId: string,
  status: PlannerWeekStatus | null = null
): Promise<PlannerResult<WeekSquadSnapshotSyncResult>> {
  const auth = await requirePlannerAdminUser();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!isPlannerUuid(weekId)) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "weekId must be a valid UUID."),
    };
  }

  const squad = await loadWeekSquadPlayerIds(weekId);
  if (!squad.ok) return squad;

  const existing = await loadExistingSnapshotPlayerIds(weekId);
  if (!existing.ok) return existing;

  const skippedExistingPlayerIds = squad.data.filter((id) =>
    existing.data.has(id)
  );
  const attemptedPlayerIds = squad.data.filter((id) => !existing.data.has(id));
  const createdPlayerIds: string[] = [];
  const skippedUnmappedPlayerIds: string[] = [];
  const issues: WeekSquadSnapshotIssue[] = [];

  for (const playerId of attemptedPlayerIds) {
    const result = await freezeOnePlayer({
      weekId,
      playerId,
      createdBy: auth.user.id,
    });
    if (result.kind === "created") createdPlayerIds.push(playerId);
    else if (result.kind === "unmapped") skippedUnmappedPlayerIds.push(playerId);
    else if (result.kind === "exists") skippedExistingPlayerIds.push(playerId);
    else issues.push(result.issue);
  }

  return {
    ok: true,
    data: {
      weekId,
      status,
      ran: true,
      attemptedPlayerIds,
      createdPlayerIds,
      skippedExistingPlayerIds,
      skippedUnmappedPlayerIds,
      issues,
    },
  };
}

/**
 * Run insert-only snapshot freeze only when the week's stored status is
 * active or closed. Draft weeks do not freeze. Never backfills other weeks.
 */
export async function syncWeekSquadMatchBestSnapshotsIfActivated(
  weekId: string
): Promise<PlannerResult<WeekSquadSnapshotSyncResult>> {
  const authError = await requirePlannerAdminUser();
  if (!authError.ok) return { ok: false, error: authError.error };

  if (!isPlannerUuid(weekId)) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "weekId must be a valid UUID."),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_weeks")
    .select("status")
    .eq("id", weekId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: mapPlannerDbError(
        "syncWeekSquadMatchBestSnapshotsIfActivated",
        error
      ),
    };
  }
  if (!data) {
    return {
      ok: false,
      error: plannerErr("week_not_found", "Planner week was not found."),
    };
  }

  const status = String((data as { status: string }).status) as PlannerWeekStatus;
  if (!weekStatusFreezesSquadSnapshots(status)) {
    return { ok: true, data: emptySync(weekId, { status, ran: false }) };
  }

  return ensureWeekSquadMatchBestSnapshots(weekId, status);
}

async function loadIssuePlayerNames(
  playerIds: string[]
): Promise<string[]> {
  if (playerIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", playerIds);
  const names = new Map<string, string>();
  for (const row of (data ?? []) as {
    id: string;
    full_name?: string | null;
    email?: string | null;
  }[]) {
    names.set(row.id, playerDisplayName(row.full_name, row.email));
  }
  return playerIds
    .map((id) => names.get(id) ?? playerDisplayName(null, null))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export async function buildSnapshotSaveWarning(
  sync: PlannerResult<WeekSquadSnapshotSyncResult>,
  scope: "week" | "squad"
): Promise<string | undefined> {
  if (!sync.ok) {
    return formatMappedSnapshotTechnicalWarning(scope);
  }
  if (!sync.data.ran || sync.data.issues.length === 0) {
    return undefined;
  }
  const names = await loadIssuePlayerNames(
    sync.data.issues.map((item) => item.playerId)
  );
  return formatMappedSnapshotIssueWarning(scope, names);
}

export async function syncWeekSquadSnapshotsAfterStatusSave(
  weekId: string,
  status: PlannerWeekStatus
): Promise<string | undefined> {
  if (!weekStatusFreezesSquadSnapshots(status)) return undefined;
  const result = await ensureWeekSquadMatchBestSnapshots(weekId, status);
  if (!result.ok) {
    logPlannerError("syncWeekSquadSnapshotsAfterStatusSave", result.error, {
      weekId,
    });
  }
  return buildSnapshotSaveWarning(result, "week");
}
