import "server-only";

/**
 * ADMIN-ONLY Persistent Week Squad (§J2).
 * List: planner_week_players only.
 * Save: planner_save_week_players RPC only.
 * No Weekly Targets, Groups, snapshots, or Power BI.
 */

import { createClient } from "@/lib/supabase/server";
import { requirePlannerAdmin } from "@/lib/gpsPlanner/auth.server";
import {
  isPlannerUuid,
  logPlannerError,
  mapPlannerDbError,
  plannerErr,
  type PlannerResult,
  type PlannerSafeError,
} from "@/lib/gpsPlanner/common";
import type {
  PlannerSaveWeekPlayersResult,
  PlannerWeekPlayersView,
  SavePlannerWeekPlayersInput,
} from "@/lib/gpsPlanner/types";

export type {
  PlannerSaveWeekPlayersResult,
  PlannerWeekPlayersView,
  SavePlannerWeekPlayersInput,
};

type MembershipDbRow = {
  player_id: string;
};

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

/**
 * Load persisted saved-squad player ids for one planner week.
 * Empty array is valid (no membership rows).
 */
export async function listPlannerWeekPlayers(
  weekId: string
): Promise<PlannerResult<PlannerWeekPlayersView>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  const weekError = await assertWeekExists(weekId);
  if (weekError) return { ok: false, error: weekError };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_week_players")
    .select("player_id")
    .eq("week_id", weekId)
    .order("player_id", { ascending: true });

  if (error) {
    return {
      ok: false,
      error: mapPlannerDbError("listPlannerWeekPlayers", error),
    };
  }

  const playerIds = ((data ?? []) as MembershipDbRow[]).map(
    (row) => row.player_id
  );
  return { ok: true, data: { playerIds } };
}

function normalizeSelectedPlayerIds(
  selectedPlayerIds: unknown
): PlannerResult<string[]> {
  if (!Array.isArray(selectedPlayerIds)) {
    return {
      ok: false,
      error: plannerErr(
        "invalid_input",
        "selectedPlayerIds must be an array of player UUIDs."
      ),
    };
  }

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const raw of selectedPlayerIds) {
    if (typeof raw !== "string" || raw.trim() === "") {
      return {
        ok: false,
        error: plannerErr(
          "invalid_input",
          "Each selected player id must be a valid UUID."
        ),
      };
    }
    if (!isPlannerUuid(raw)) {
      return {
        ok: false,
        error: plannerErr(
          "invalid_input",
          "Each selected player id must be a valid UUID."
        ),
      };
    }
    if (seen.has(raw)) continue;
    seen.add(raw);
    normalized.push(raw);
  }
  return { ok: true, data: normalized };
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function parseSaveWeekPlayersResult(
  data: unknown
): PlannerResult<PlannerSaveWeekPlayersResult> {
  if (!data || typeof data !== "object") {
    return {
      ok: false,
      error: plannerErr(
        "database_error",
        "Could not save week squad (unexpected response)."
      ),
    };
  }
  const row = data as Record<string, unknown>;
  if (
    !isStringArray(row.savedPlayerIds) ||
    !isStringArray(row.addedPlayerIds) ||
    !isStringArray(row.removedPlayerIds) ||
    typeof row.changed !== "boolean"
  ) {
    return {
      ok: false,
      error: plannerErr(
        "database_error",
        "Could not save week squad (unexpected response)."
      ),
    };
  }
  return {
    ok: true,
    data: {
      savedPlayerIds: row.savedPlayerIds,
      addedPlayerIds: row.addedPlayerIds,
      removedPlayerIds: row.removedPlayerIds,
      changed: row.changed,
    },
  };
}

function mapSaveWeekPlayersRpcError(
  message: string,
  code?: string
): PlannerSafeError {
  const lower = message.toLowerCase();
  if (
    lower.includes("authentication required") ||
    lower.includes("admin access required")
  ) {
    return plannerErr("unauthorized", "Admin access required.");
  }
  if (lower.includes("planner week was not found") || code === "P0002") {
    return plannerErr("week_not_found", "Planner week was not found.");
  }
  if (lower.includes("role = player") || lower.includes("role = 'player'")) {
    return plannerErr(
      "not_a_player",
      "Only profiles with role 'player' may be saved in the week squad."
    );
  }
  if (
    lower.includes("player_ids must not be null") ||
    lower.includes("player_ids must not contain null") ||
    lower.includes("week_id is required")
  ) {
    return plannerErr("invalid_input", "Week squad save input was invalid.");
  }
  const safe = plannerErr("database_error", "Could not save week squad.");
  logPlannerError("savePlannerWeekPlayers.rpc", safe, { code, message });
  return safe;
}

/**
 * Atomically persist the complete desired week squad via RPC.
 * Membership only. Empty selectedPlayerIds is a valid explicit clear.
 */
export async function savePlannerWeekPlayers(
  input: SavePlannerWeekPlayersInput
): Promise<PlannerResult<PlannerSaveWeekPlayersResult>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  if (!isPlannerUuid(input.weekId)) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "weekId must be a valid UUID."),
    };
  }

  const normalized = normalizeSelectedPlayerIds(input.selectedPlayerIds);
  if (!normalized.ok) return normalized;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("planner_save_week_players", {
    p_week_id: input.weekId,
    p_player_ids: normalized.data,
  });

  if (error) {
    return {
      ok: false,
      error: mapSaveWeekPlayersRpcError(error.message ?? "", error.code),
    };
  }

  return parseSaveWeekPlayersResult(data);
}
