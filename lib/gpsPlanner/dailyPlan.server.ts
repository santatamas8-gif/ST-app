import "server-only";

/**
 * ADMIN-ONLY Daily Plan print read model.
 * Absolute targets from existing Daily Target views only.
 * Weekly % / Daily % / Team Average are read-only projections (not persisted).
 * No Power BI Actual. No DB writes. No formula changes.
 */

import { createClient } from "@/lib/supabase/server";
import { playerDisplayName } from "@/lib/players/listPlayers";
import { requirePlannerAdmin } from "@/lib/gpsPlanner/auth.server";
import {
  isPlannerUuid,
  logPlannerError,
  mapPlannerDbError,
  plannerErr,
  type PlannerResult,
} from "@/lib/gpsPlanner/common";
import { getPlannerDailyTarget } from "@/lib/gpsPlanner/dailyTargets.server";
import {
  buildPctSummary,
  buildTeamAverage,
} from "@/lib/gpsPlanner/dailyPlanSummary";
import { getPlannerWeek } from "@/lib/gpsPlanner/weeks.server";
import { getPlannerWeeklyTarget } from "@/lib/gpsPlanner/weeklyTargets.server";
import type {
  DailyPlanPrintPlayerRow,
  DailyPlanPrintResult,
} from "@/lib/gpsPlanner/types";

export type { DailyPlanPrintPlayerRow, DailyPlanPrintResult };

type WeekDayDbRow = {
  id: string;
  week_id: string;
  date: string;
  md_tag: string;
};

async function loadWeekDay(
  weekDayId: string
): Promise<PlannerResult<WeekDayDbRow>> {
  if (!isPlannerUuid(weekDayId)) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "weekDayId must be a valid UUID."),
    };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_week_days")
    .select("id, week_id, date, md_tag")
    .eq("id", weekDayId)
    .maybeSingle();
  if (error) {
    return { ok: false, error: mapPlannerDbError("dailyPlan.loadWeekDay", error) };
  }
  if (!data) {
    return {
      ok: false,
      error: plannerErr("day_not_found", "Planner week day was not found."),
    };
  }
  return { ok: true, data: data as WeekDayDbRow };
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
      "dailyPlan.loadDisplayNames",
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

function missingTargetRow(
  playerId: string,
  playerDisplayName: string
): DailyPlanPrintPlayerRow {
  return {
    playerId,
    playerDisplayName,
    hasDailyTarget: false,
    totalDistance: null,
    hsr: null,
    sprint: null,
    accelerations: null,
    decelerations: null,
  };
}

function emptyPctLists() {
  return {
    td: [] as number[],
    hsr: [] as number[],
    sprint: [] as number[],
    acc: [] as number[],
    dec: [] as number[],
  };
}

function emptyAbsoluteLists() {
  return {
    totalDistance: [] as number[],
    hsr: [] as number[],
    sprint: [] as number[],
    accelerations: [] as number[],
    decelerations: [] as number[],
  };
}

/**
 * Build printable Daily Plan for selected players on one week day.
 * Preserves playerIds order. Missing daily targets → null metrics (not zeros).
 * Summaries are derived only from existing persisted Weekly/Daily targets.
 */
export async function getDailyPlanForPrint(input: {
  weekDayId: string;
  playerIds: string[];
}): Promise<PlannerResult<DailyPlanPrintResult>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  const weekDayId = input.weekDayId;
  // Preserve first-seen order; drop duplicate IDs.
  const seen = new Set<string>();
  const playerIds: string[] = [];
  for (const id of input.playerIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    playerIds.push(id);
  }

  if (!Array.isArray(playerIds) || playerIds.length === 0) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "playerIds must be a non-empty array."),
    };
  }

  for (const playerId of playerIds) {
    if (!isPlannerUuid(playerId)) {
      return {
        ok: false,
        error: plannerErr(
          "invalid_input",
          "Each playerId must be a valid UUID."
        ),
      };
    }
  }

  const dayResult = await loadWeekDay(weekDayId);
  if (!dayResult.ok) return dayResult;

  const weekResult = await getPlannerWeek(dayResult.data.week_id);
  if (!weekResult.ok) return weekResult;
  if (!weekResult.data) {
    return {
      ok: false,
      error: plannerErr("week_not_found", "Planner week was not found."),
    };
  }

  const weekId = dayResult.data.week_id;
  const missingIds: string[] = [];
  const players: DailyPlanPrintPlayerRow[] = [];

  const weeklyPctLists = emptyPctLists();
  const dailyPctLists = emptyPctLists();
  const absoluteLists = emptyAbsoluteLists();

  for (const playerId of playerIds) {
    const weeklyResult = await getPlannerWeeklyTarget(weekId, playerId);
    if (!weeklyResult.ok) return weeklyResult;
    if (weeklyResult.data) {
      weeklyPctLists.td.push(weeklyResult.data.tdPct);
      weeklyPctLists.hsr.push(weeklyResult.data.hsrPct);
      weeklyPctLists.sprint.push(weeklyResult.data.sprintPct);
      weeklyPctLists.acc.push(weeklyResult.data.accPct);
      weeklyPctLists.dec.push(weeklyResult.data.decPct);
    }

    const targetResult = await getPlannerDailyTarget(weekDayId, playerId);
    if (!targetResult.ok) return targetResult;

    if (targetResult.data) {
      const view = targetResult.data;
      dailyPctLists.td.push(view.tdPct);
      dailyPctLists.hsr.push(view.hsrPct);
      dailyPctLists.sprint.push(view.sprintPct);
      dailyPctLists.acc.push(view.accPct);
      dailyPctLists.dec.push(view.decPct);
      absoluteLists.totalDistance.push(view.totalDistance);
      absoluteLists.hsr.push(view.hsr);
      absoluteLists.sprint.push(view.sprint);
      absoluteLists.accelerations.push(view.accelerations);
      absoluteLists.decelerations.push(view.decelerations);
      players.push({
        playerId: view.playerId,
        playerDisplayName: view.playerDisplayName,
        hasDailyTarget: true,
        totalDistance: view.totalDistance,
        hsr: view.hsr,
        sprint: view.sprint,
        accelerations: view.accelerations,
        decelerations: view.decelerations,
      });
    } else {
      missingIds.push(playerId);
      players.push(missingTargetRow(playerId, "Unknown player"));
    }
  }

  if (missingIds.length > 0) {
    const names = await loadDisplayNames(missingIds);
    for (let i = 0; i < players.length; i++) {
      const row = players[i];
      if (!row.hasDailyTarget) {
        players[i] = missingTargetRow(
          row.playerId,
          names.get(row.playerId) ?? "Unknown player"
        );
      }
    }
  }

  return {
    ok: true,
    data: {
      weekDayId: dayResult.data.id,
      weekId,
      powerBiWeekId: weekResult.data.powerbiWeekId,
      date: dayResult.data.date,
      mdTag: dayResult.data.md_tag,
      players,
      weeklyPct: buildPctSummary(weeklyPctLists),
      dailyPct: buildPctSummary(dailyPctLists),
      teamAverage: buildTeamAverage(absoluteLists),
    },
  };
}
