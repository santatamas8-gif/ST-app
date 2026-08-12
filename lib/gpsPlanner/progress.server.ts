import "server-only";

/**
 * ADMIN-ONLY Planner Phase C — Daily Actual / Analysis + Weekly Progress.
 *
 * Actual identity: frozen snapshot.powerbi_player_name (NEVER current mapping).
 * Power BI weekId: planner_weeks.powerbi_week_id (NEVER internal UUID).
 * Difference / Weekly To Target: Planned − Actual.
 *
 * No Actual persistence. No carry-over. No coaching. No UI.
 */

import { createClient } from "@/lib/supabase/server";
import { playerDisplayName } from "@/lib/players/listPlayers";
import { requirePlannerAdmin } from "@/lib/gpsPlanner/auth.server";
import {
  isPlannerIsoDate,
  isPlannerUuid,
  mapPlannerDbError,
  plannerErr,
  type PlannerResult,
} from "@/lib/gpsPlanner/common";
import {
  calculateDailyPlannedAbsolutes,
  calculateWeeklyPlannedAbsolutes,
  differenceAbsolute,
  isPresentActualValue,
  remainingToAllocate,
  sumPercentageMetrics,
  type AbsoluteMetrics,
  type MatchBestMetrics,
  type PercentageMetrics,
} from "@/lib/gpsPlanner/calculations";
import { aggregateWeeklyActualFromDays } from "@/lib/gpsPlanner/weeklyActualAggregation";
import {
  getTrainingActualGps,
  getTrainingActualGpsBatchForDay,
} from "@/lib/powerbi/queries/trainingActual.server";
import type {
  DayActualStatus,
  PlannerDailyAnalysisResult,
  PlannerWeeklyProgressResult,
  WeeklyProgressDayActual,
} from "@/lib/gpsPlanner/types";

export type PlannerActualMetrics = AbsoluteMetrics;

export type {
  DayActualStatus,
  WeeklyProgressDayActual,
  PlannerWeeklyProgressResult,
  PlannerDailyAnalysisResult,
};

export type PlannerDailyActualResult = {
  weekId: string;
  powerBiWeekId: string;
  weekDayId: string;
  date: string;
  mdTag: string;
  playerId: string;
  powerBiPlayerName: string;
  status: DayActualStatus;
  actual: PlannerActualMetrics | null;
};

type WeekDbRow = {
  id: string;
  powerbi_week_id: string;
};

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
  source_method: string;
};

type WeeklyTargetDbRow = {
  week_id: string;
  player_id: string;
  td_pct: number;
  hsr_pct: number;
  sprint_pct: number;
  acc_pct: number;
  dec_pct: number;
};

type DailyTargetDbRow = {
  week_day_id: string;
  player_id: string;
  td_pct: number;
  hsr_pct: number;
  sprint_pct: number;
  acc_pct: number;
  dec_pct: number;
};

function snapshotBest(row: SnapshotDbRow): MatchBestMetrics {
  return {
    tdBest: Number(row.td_best),
    hsrBest: Number(row.hsr_best),
    sprintBest: Number(row.sprint_best),
    accBest: Number(row.acc_best),
    decBest: Number(row.dec_best),
  };
}

function pctFromWeekly(row: WeeklyTargetDbRow): PercentageMetrics {
  return {
    tdPct: Number(row.td_pct),
    hsrPct: Number(row.hsr_pct),
    sprintPct: Number(row.sprint_pct),
    accPct: Number(row.acc_pct),
    decPct: Number(row.dec_pct),
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

function mapFoundActual(data: {
  totalDistance: number | null;
  hsr: number | null;
  sprint: number | null;
  accelerations: number | null;
  decelerations: number | null;
}):
  | { status: "actual_found"; actual: AbsoluteMetrics }
  | { status: "actual_incomplete"; actual: null } {
  if (
    !isPresentActualValue(data.totalDistance) ||
    !isPresentActualValue(data.hsr) ||
    !isPresentActualValue(data.sprint) ||
    !isPresentActualValue(data.accelerations) ||
    !isPresentActualValue(data.decelerations)
  ) {
    return { status: "actual_incomplete", actual: null };
  }
  return {
    status: "actual_found",
    actual: {
      totalDistance: data.totalDistance,
      hsr: data.hsr,
      sprint: data.sprint,
      accelerations: data.accelerations,
      decelerations: data.decelerations,
    },
  };
}

async function loadDisplayName(playerId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", playerId)
    .maybeSingle();
  return playerDisplayName(
    (data as { full_name?: string | null } | null)?.full_name,
    (data as { email?: string | null } | null)?.email
  );
}

async function loadWeek(weekId: string): Promise<PlannerResult<WeekDbRow>> {
  if (!isPlannerUuid(weekId)) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "weekId must be a valid UUID."),
    };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planner_weeks")
    .select("id, powerbi_week_id")
    .eq("id", weekId)
    .maybeSingle();
  if (error) return { ok: false, error: mapPlannerDbError("loadWeek", error) };
  if (!data) {
    return {
      ok: false,
      error: plannerErr("week_not_found", "Planner week was not found."),
    };
  }
  return { ok: true, data: data as WeekDbRow };
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
    .select("id, week_id, date, md_tag")
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
    .select(
      "week_id, player_id, td_best, hsr_best, sprint_best, acc_best, dec_best, powerbi_player_name, source_method"
    )
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
        "No frozen Match Best snapshot for this week and player."
      ),
    };
  }
  return { ok: true, data: data as SnapshotDbRow };
}

/**
 * Fetch Full Training Actual for one planner day + player.
 * Uses frozen Power BI name + planner_weeks.powerbi_week_id + day.md_tag + day.date.
 * Does NOT require a Daily Target. Does NOT use current player mapping.
 */
export async function getPlannerDailyActual(input: {
  weekDayId: string;
  playerId: string;
}): Promise<PlannerResult<PlannerDailyActualResult>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  if (!isPlannerUuid(input.playerId)) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "playerId must be a valid UUID."),
    };
  }

  const dayResult = await loadWeekDay(input.weekDayId);
  if (!dayResult.ok) return dayResult;
  const day = dayResult.data;

  const weekResult = await loadWeek(day.week_id);
  if (!weekResult.ok) return weekResult;

  const snapshotResult = await loadSnapshot(day.week_id, input.playerId);
  if (!snapshotResult.ok) return snapshotResult;
  const snapshot = snapshotResult.data;

  const pbi = await getTrainingActualGps({
    playerName: snapshot.powerbi_player_name,
    weekId: weekResult.data.powerbi_week_id,
    mdTag: day.md_tag,
    date: day.date,
  });

  const base = {
    weekId: day.week_id,
    powerBiWeekId: weekResult.data.powerbi_week_id,
    weekDayId: day.id,
    date: day.date,
    mdTag: day.md_tag,
    playerId: input.playerId,
    powerBiPlayerName: snapshot.powerbi_player_name,
  };

  if (!pbi.ok) {
    if (pbi.error.code === "not_found") {
      return {
        ok: true,
        data: { ...base, status: "actual_not_found", actual: null },
      };
    }
    if (pbi.error.code === "ambiguous") {
      return {
        ok: true,
        data: { ...base, status: "actual_ambiguous", actual: null },
      };
    }
    return {
      ok: true,
      data: { ...base, status: "actual_error", actual: null },
    };
  }

  const mapped = mapFoundActual(pbi.data);
  return {
    ok: true,
    data: {
      ...base,
      status: mapped.status,
      actual: mapped.actual,
    },
  };
}

/**
 * Daily Analysis (single player): Planned / Actual / Difference when safely available.
 * Missing Actual ≠ zero. Ambiguous/error → no Difference.
 * Planning / single-player callers keep this path (sequential getTrainingActualGps).
 * Daily Review multi-player uses getPlannerDailyReviewAnalysis (day-batch).
 */
export async function getPlannerDailyAnalysis(input: {
  weekDayId: string;
  playerId: string;
}): Promise<PlannerResult<PlannerDailyAnalysisResult>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  if (!isPlannerUuid(input.playerId)) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "playerId must be a valid UUID."),
    };
  }

  const dayResult = await loadWeekDay(input.weekDayId);
  if (!dayResult.ok) return dayResult;
  const day = dayResult.data;

  const weekResult = await loadWeek(day.week_id);
  if (!weekResult.ok) return weekResult;

  const snapshotResult = await loadSnapshot(day.week_id, input.playerId);
  if (!snapshotResult.ok) return snapshotResult;
  const snapshot = snapshotResult.data;
  const best = snapshotBest(snapshot);

  const supabase = await createClient();
  const { data: dailyRow, error: dailyError } = await supabase
    .from("planner_daily_targets")
    .select(
      "week_day_id, player_id, td_pct, hsr_pct, sprint_pct, acc_pct, dec_pct"
    )
    .eq("week_day_id", input.weekDayId)
    .eq("player_id", input.playerId)
    .maybeSingle();
  if (dailyError) {
    return {
      ok: false,
      error: mapPlannerDbError("getPlannerDailyAnalysis.daily", dailyError),
    };
  }

  const hasDailyTarget = !!dailyRow;
  const dailyPct = dailyRow
    ? pctFromDaily(dailyRow as DailyTargetDbRow)
    : null;
  const planned = dailyPct
    ? calculateDailyPlannedAbsolutes(best, dailyPct)
    : null;

  const actualResult = await getPlannerDailyActual(input);
  if (!actualResult.ok) return actualResult;

  let difference: AbsoluteMetrics | null = null;
  if (
    planned &&
    actualResult.data.status === "actual_found" &&
    actualResult.data.actual
  ) {
    difference = differenceAbsolute(planned, actualResult.data.actual);
  }

  const displayName = await loadDisplayName(input.playerId);

  return {
    ok: true,
    data: {
      weekId: day.week_id,
      powerBiWeekId: weekResult.data.powerbi_week_id,
      weekDayId: day.id,
      date: day.date,
      mdTag: day.md_tag,
      playerId: input.playerId,
      playerDisplayName: displayName,
      powerBiPlayerName: snapshot.powerbi_player_name,
      hasDailyTarget,
      dailyPct,
      planned,
      actualStatus: actualResult.data.status,
      actual: actualResult.data.actual,
      difference,
    },
  };
}

/**
 * Daily Review: day-batched Full Training Actual for all Weekly Target players
 * on ONE selected Week Day.
 *
 * Power BI strategy: one Execute Queries call via getTrainingActualGpsBatchForDay
 * (not one request per player). Planned / Difference / compliance contracts are
 * identical to getPlannerDailyAnalysis.
 */
export async function getPlannerDailyReviewAnalysis(input: {
  weekDayId: string;
}): Promise<PlannerResult<PlannerDailyAnalysisResult[]>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  const dayResult = await loadWeekDay(input.weekDayId);
  if (!dayResult.ok) return dayResult;
  const day = dayResult.data;

  const weekResult = await loadWeek(day.week_id);
  if (!weekResult.ok) return weekResult;

  const supabase = await createClient();

  const { data: weeklyRows, error: weeklyError } = await supabase
    .from("planner_weekly_targets")
    .select(
      "week_id, player_id, td_pct, hsr_pct, sprint_pct, acc_pct, dec_pct"
    )
    .eq("week_id", day.week_id);
  if (weeklyError) {
    return {
      ok: false,
      error: mapPlannerDbError(
        "getPlannerDailyReviewAnalysis.weekly",
        weeklyError
      ),
    };
  }

  const targets = (weeklyRows ?? []) as WeeklyTargetDbRow[];
  if (targets.length === 0) {
    return { ok: true, data: [] };
  }

  const playerIds = targets.map((t) => t.player_id);

  const { data: snapshotRows, error: snapError } = await supabase
    .from("planner_match_best_snapshots")
    .select(
      "week_id, player_id, td_best, hsr_best, sprint_best, acc_best, dec_best, powerbi_player_name, source_method"
    )
    .eq("week_id", day.week_id)
    .in("player_id", playerIds);
  if (snapError) {
    return {
      ok: false,
      error: mapPlannerDbError(
        "getPlannerDailyReviewAnalysis.snapshots",
        snapError
      ),
    };
  }

  const snapshotByPlayer = new Map<string, SnapshotDbRow>();
  for (const row of (snapshotRows ?? []) as SnapshotDbRow[]) {
    snapshotByPlayer.set(row.player_id, row);
  }

  const { data: dailyRows, error: dailyError } = await supabase
    .from("planner_daily_targets")
    .select(
      "week_day_id, player_id, td_pct, hsr_pct, sprint_pct, acc_pct, dec_pct"
    )
    .eq("week_day_id", day.id)
    .in("player_id", playerIds);
  if (dailyError) {
    return {
      ok: false,
      error: mapPlannerDbError(
        "getPlannerDailyReviewAnalysis.dailies",
        dailyError
      ),
    };
  }

  const dailyByPlayer = new Map<string, DailyTargetDbRow>();
  for (const row of (dailyRows ?? []) as DailyTargetDbRow[]) {
    dailyByPlayer.set(row.player_id, row);
  }

  const frozenNames = [
    ...new Set(
      playerIds
        .map((id) => snapshotByPlayer.get(id)?.powerbi_player_name ?? "")
        .filter((n) => n.length > 0)
    ),
  ];

  type BatchEntry =
    | {
        status: "found";
        metrics: {
          totalDistance: number | null;
          hsr: number | null;
          sprint: number | null;
          accelerations: number | null;
          decelerations: number | null;
        };
      }
    | { status: "not_found" }
    | { status: "ambiguous" }
    | { status: "error" };

  const byPlayerName = new Map<string, BatchEntry>();

  if (frozenNames.length > 0) {
    const batch = await getTrainingActualGpsBatchForDay({
      weekId: weekResult.data.powerbi_week_id,
      mdTag: day.md_tag,
      date: day.date,
      playerNames: frozenNames,
    });

    if (!batch.ok) {
      for (const name of frozenNames) {
        byPlayerName.set(name, { status: "error" });
      }
    } else {
      for (const name of frozenNames) {
        const entry = batch.byPlayerName.get(name);
        if (!entry) {
          byPlayerName.set(name, { status: "not_found" });
        } else if (entry.status === "found") {
          byPlayerName.set(name, {
            status: "found",
            metrics: entry.metrics,
          });
        } else if (entry.status === "ambiguous") {
          byPlayerName.set(name, { status: "ambiguous" });
        } else {
          byPlayerName.set(name, { status: "not_found" });
        }
      }
    }
  }

  const displayNames = await loadDisplayNames(playerIds);
  const results: PlannerDailyAnalysisResult[] = [];

  for (const target of targets) {
    const snapshot = snapshotByPlayer.get(target.player_id);
    if (!snapshot) continue;

    const best = snapshotBest(snapshot);
    const dailyRow = dailyByPlayer.get(target.player_id) ?? null;
    const hasDailyTarget = !!dailyRow;
    const dailyPct = dailyRow ? pctFromDaily(dailyRow) : null;
    const planned = dailyPct
      ? calculateDailyPlannedAbsolutes(best, dailyPct)
      : null;

    const raw =
      byPlayerName.get(snapshot.powerbi_player_name) ??
      ({ status: "error" } as const);
    const mapped = dayStatusFromBatchPlayerResult(raw);

    let difference: AbsoluteMetrics | null = null;
    if (planned && mapped.status === "actual_found" && mapped.actual) {
      difference = differenceAbsolute(planned, mapped.actual);
    }

    results.push({
      weekId: day.week_id,
      powerBiWeekId: weekResult.data.powerbi_week_id,
      weekDayId: day.id,
      date: day.date,
      mdTag: day.md_tag,
      playerId: target.player_id,
      playerDisplayName:
        displayNames.get(target.player_id) ??
        playerDisplayName(null, null),
      powerBiPlayerName: snapshot.powerbi_player_name,
      hasDailyTarget,
      dailyPct,
      planned,
      actualStatus: mapped.status,
      actual: mapped.actual,
      difference,
    });
  }

  return { ok: true, data: results };
}

/**
 * Weekly Progress for one player.
 * throughDate is explicit YYYY-MM-DD (no server "today").
 * Weekly Actual sums Full Training Actuals for week days with date <= throughDate,
 * whether or not a Daily Target exists.
 * Weekly Planned comes from Weekly Target × frozen Best — NOT sum of Daily Planned.
 *
 * Power BI strategy: sequential getTrainingActualGps per included day (typically 4–5),
 * bounded and deterministic — no uncontrolled concurrency storm.
 */
export async function getPlannerWeeklyProgress(input: {
  weekId: string;
  playerId: string;
  throughDate: string;
}): Promise<PlannerResult<PlannerWeeklyProgressResult>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  if (!isPlannerUuid(input.weekId) || !isPlannerUuid(input.playerId)) {
    return {
      ok: false,
      error: plannerErr(
        "invalid_input",
        "weekId and playerId must be valid UUIDs."
      ),
    };
  }
  if (!isPlannerIsoDate(input.throughDate)) {
    return {
      ok: false,
      error: plannerErr(
        "invalid_date",
        "throughDate must be a YYYY-MM-DD calendar date."
      ),
    };
  }

  const weekResult = await loadWeek(input.weekId);
  if (!weekResult.ok) return weekResult;

  const snapshotResult = await loadSnapshot(input.weekId, input.playerId);
  if (!snapshotResult.ok) return snapshotResult;
  const snapshot = snapshotResult.data;
  const best = snapshotBest(snapshot);

  const supabase = await createClient();
  const { data: weeklyRow, error: weeklyError } = await supabase
    .from("planner_weekly_targets")
    .select(
      "week_id, player_id, td_pct, hsr_pct, sprint_pct, acc_pct, dec_pct"
    )
    .eq("week_id", input.weekId)
    .eq("player_id", input.playerId)
    .maybeSingle();
  if (weeklyError) {
    return {
      ok: false,
      error: mapPlannerDbError("getPlannerWeeklyProgress.weekly", weeklyError),
    };
  }
  if (!weeklyRow) {
    return {
      ok: false,
      error: plannerErr(
        "weekly_target_not_found",
        "Weekly target was not found for this week and player."
      ),
    };
  }

  const weeklyPct = pctFromWeekly(weeklyRow as WeeklyTargetDbRow);
  const weeklyPlanned = calculateWeeklyPlannedAbsolutes(best, weeklyPct);

  const { data: allDays, error: daysError } = await supabase
    .from("planner_week_days")
    .select("id, week_id, date, md_tag")
    .eq("week_id", input.weekId)
    .order("date", { ascending: true });
  if (daysError) {
    return {
      ok: false,
      error: mapPlannerDbError("getPlannerWeeklyProgress.days", daysError),
    };
  }

  const days = (allDays ?? []) as DayDbRow[];
  const includedDays = days.filter((d) => d.date <= input.throughDate);

  const { data: dailyRows, error: dailyError } = await supabase
    .from("planner_daily_targets")
    .select(
      "week_day_id, player_id, td_pct, hsr_pct, sprint_pct, acc_pct, dec_pct"
    )
    .eq("week_id", input.weekId)
    .eq("player_id", input.playerId);
  if (dailyError) {
    return {
      ok: false,
      error: mapPlannerDbError("getPlannerWeeklyProgress.dailies", dailyError),
    };
  }

  const dailyByDayId = new Map<string, DailyTargetDbRow>();
  for (const row of (dailyRows ?? []) as DailyTargetDbRow[]) {
    dailyByDayId.set(row.week_day_id, row);
  }

  // Allocation uses ALL daily targets in the week (not filtered by throughDate).
  const dailyAllocationSum = sumPercentageMetrics(
    [...dailyByDayId.values()].map(pctFromDaily)
  );
  const remaining = remainingToAllocate(weeklyPct, dailyAllocationSum);

  const dayResults: WeeklyProgressDayActual[] = [];

  // Sequential Power BI calls — bounded by planner week day count (~4–5).
  // Planning single-player Progress keeps this path (not the Review day-batch).
  for (const day of includedDays) {
    const pbi = await getTrainingActualGps({
      playerName: snapshot.powerbi_player_name,
      weekId: weekResult.data.powerbi_week_id,
      mdTag: day.md_tag,
      date: day.date,
    });

    let status: DayActualStatus;
    let actual: AbsoluteMetrics | null = null;

    if (!pbi.ok) {
      if (pbi.error.code === "not_found") {
        status = "actual_not_found";
      } else if (pbi.error.code === "ambiguous") {
        status = "actual_ambiguous";
      } else {
        status = "actual_error";
      }
    } else {
      const mapped = mapFoundActual(pbi.data);
      status = mapped.status;
      actual = mapped.actual;
    }

    dayResults.push({
      weekDayId: day.id,
      date: day.date,
      mdTag: day.md_tag,
      status,
      actual,
      hasDailyTarget: dailyByDayId.has(day.id),
    });
  }

  const aggregated = aggregateWeeklyActualFromDays(dayResults, weeklyPlanned);
  const displayName = await loadDisplayName(input.playerId);

  return {
    ok: true,
    data: {
      weekId: input.weekId,
      powerBiWeekId: weekResult.data.powerbi_week_id,
      playerId: input.playerId,
      playerDisplayName: displayName,
      throughDate: input.throughDate,
      frozen: {
        ...best,
        powerBiPlayerName: snapshot.powerbi_player_name,
        sourceMethod: snapshot.source_method,
      },
      weeklyPct,
      weeklyPlanned,
      dailyAllocationSum,
      remainingToAllocate: remaining,
      days: dayResults,
      includedDays: includedDays.length,
      foundDays: aggregated.foundDays,
      notFoundDays: aggregated.notFoundDays,
      problematicDays: aggregated.problematicDays,
      weeklyActual: aggregated.weeklyActual,
      weeklyToTarget: aggregated.weeklyToTarget,
      actualCompleteness: aggregated.actualCompleteness,
    },
  };
}

function dayStatusFromBatchPlayerResult(
  entry:
    | {
        status: "found";
        metrics: {
          totalDistance: number | null;
          hsr: number | null;
          sprint: number | null;
          accelerations: number | null;
          decelerations: number | null;
        };
      }
    | { status: "not_found" }
    | { status: "ambiguous" }
    | { status: "error" }
): { status: DayActualStatus; actual: AbsoluteMetrics | null } {
  if (entry.status === "error") {
    return { status: "actual_error", actual: null };
  }
  if (entry.status === "not_found") {
    return { status: "actual_not_found", actual: null };
  }
  if (entry.status === "ambiguous") {
    return { status: "actual_ambiguous", actual: null };
  }
  const mapped = mapFoundActual(entry.metrics);
  return { status: mapped.status, actual: mapped.actual };
}

async function loadDisplayNames(
  playerIds: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (playerIds.length === 0) return out;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", playerIds);
  for (const row of (data ?? []) as {
    id: string;
    full_name?: string | null;
    email?: string | null;
  }[]) {
    out.set(row.id, playerDisplayName(row.full_name, row.email));
  }
  for (const id of playerIds) {
    if (!out.has(id)) out.set(id, playerDisplayName(null, null));
  }
  return out;
}

/**
 * Weekly Review: day-batched Full Training Actual for all Weekly Target players.
 *
 * Power BI strategy: one Execute Queries call per included Week Day (not
 * players × days). Planning single-player Progress stays on getPlannerWeeklyProgress.
 *
 * Completeness / To Target contract is identical to getPlannerWeeklyProgress.
 */
export async function getPlannerWeeklyReviewProgress(input: {
  weekId: string;
  throughDate: string;
}): Promise<PlannerResult<PlannerWeeklyProgressResult[]>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  if (!isPlannerUuid(input.weekId)) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "weekId must be a valid UUID."),
    };
  }
  if (!isPlannerIsoDate(input.throughDate)) {
    return {
      ok: false,
      error: plannerErr(
        "invalid_date",
        "throughDate must be a YYYY-MM-DD calendar date."
      ),
    };
  }

  const weekResult = await loadWeek(input.weekId);
  if (!weekResult.ok) return weekResult;

  const supabase = await createClient();

  const { data: weeklyRows, error: weeklyError } = await supabase
    .from("planner_weekly_targets")
    .select(
      "week_id, player_id, td_pct, hsr_pct, sprint_pct, acc_pct, dec_pct"
    )
    .eq("week_id", input.weekId);
  if (weeklyError) {
    return {
      ok: false,
      error: mapPlannerDbError(
        "getPlannerWeeklyReviewProgress.weekly",
        weeklyError
      ),
    };
  }

  const targets = (weeklyRows ?? []) as WeeklyTargetDbRow[];
  if (targets.length === 0) {
    return { ok: true, data: [] };
  }

  const playerIds = targets.map((t) => t.player_id);

  const { data: snapshotRows, error: snapError } = await supabase
    .from("planner_match_best_snapshots")
    .select(
      "week_id, player_id, td_best, hsr_best, sprint_best, acc_best, dec_best, powerbi_player_name, source_method"
    )
    .eq("week_id", input.weekId)
    .in("player_id", playerIds);
  if (snapError) {
    return {
      ok: false,
      error: mapPlannerDbError(
        "getPlannerWeeklyReviewProgress.snapshots",
        snapError
      ),
    };
  }

  const snapshotByPlayer = new Map<string, SnapshotDbRow>();
  for (const row of (snapshotRows ?? []) as SnapshotDbRow[]) {
    snapshotByPlayer.set(row.player_id, row);
  }

  const { data: allDays, error: daysError } = await supabase
    .from("planner_week_days")
    .select("id, week_id, date, md_tag")
    .eq("week_id", input.weekId)
    .order("date", { ascending: true });
  if (daysError) {
    return {
      ok: false,
      error: mapPlannerDbError(
        "getPlannerWeeklyReviewProgress.days",
        daysError
      ),
    };
  }

  const days = (allDays ?? []) as DayDbRow[];
  const includedDays = days.filter((d) => d.date <= input.throughDate);

  const { data: dailyRows, error: dailyError } = await supabase
    .from("planner_daily_targets")
    .select(
      "week_day_id, player_id, td_pct, hsr_pct, sprint_pct, acc_pct, dec_pct"
    )
    .eq("week_id", input.weekId)
    .in("player_id", playerIds);
  if (dailyError) {
    return {
      ok: false,
      error: mapPlannerDbError(
        "getPlannerWeeklyReviewProgress.dailies",
        dailyError
      ),
    };
  }

  const dailyByPlayerDay = new Map<string, DailyTargetDbRow>();
  for (const row of (dailyRows ?? []) as DailyTargetDbRow[]) {
    dailyByPlayerDay.set(`${row.player_id}:${row.week_day_id}`, row);
  }

  const frozenNames = [
    ...new Set(
      playerIds
        .map((id) => snapshotByPlayer.get(id)?.powerbi_player_name ?? "")
        .filter((n) => n.length > 0)
    ),
  ];

  // dayId → powerBiPlayerName → day status/metrics
  type BatchDayEntry =
    | {
        status: "found";
        metrics: {
          totalDistance: number | null;
          hsr: number | null;
          sprint: number | null;
          accelerations: number | null;
          decelerations: number | null;
        };
      }
    | { status: "not_found" }
    | { status: "ambiguous" }
    | { status: "error" };

  const dayActualByPlayerName = new Map<string, Map<string, BatchDayEntry>>();

  // One Power BI Execute Queries call per included day (Review reliability path).
  for (const day of includedDays) {
    const perName = new Map<string, BatchDayEntry>();

    if (frozenNames.length === 0) {
      dayActualByPlayerName.set(day.id, perName);
      continue;
    }

    const batch = await getTrainingActualGpsBatchForDay({
      weekId: weekResult.data.powerbi_week_id,
      mdTag: day.md_tag,
      date: day.date,
      playerNames: frozenNames,
    });

    if (!batch.ok) {
      for (const name of frozenNames) {
        perName.set(name, { status: "error" });
      }
      dayActualByPlayerName.set(day.id, perName);
      continue;
    }

    for (const name of frozenNames) {
      const entry = batch.byPlayerName.get(name);
      if (!entry) {
        perName.set(name, { status: "not_found" });
      } else if (entry.status === "found") {
        perName.set(name, { status: "found", metrics: entry.metrics });
      } else if (entry.status === "ambiguous") {
        perName.set(name, { status: "ambiguous" });
      } else {
        perName.set(name, { status: "not_found" });
      }
    }

    dayActualByPlayerName.set(day.id, perName);
  }

  const displayNames = await loadDisplayNames(playerIds);
  const results: PlannerWeeklyProgressResult[] = [];

  for (const target of targets) {
    const snapshot = snapshotByPlayer.get(target.player_id);
    if (!snapshot) {
      continue;
    }
    const best = snapshotBest(snapshot);
    const weeklyPct = pctFromWeekly(target);
    const weeklyPlanned = calculateWeeklyPlannedAbsolutes(best, weeklyPct);

    const playerDailyPcts: PercentageMetrics[] = [];
    for (const day of days) {
      const daily = dailyByPlayerDay.get(`${target.player_id}:${day.id}`);
      if (daily) playerDailyPcts.push(pctFromDaily(daily));
    }
    const dailyAllocationSum = sumPercentageMetrics(playerDailyPcts);
    const remaining = remainingToAllocate(weeklyPct, dailyAllocationSum);

    const dayResults: WeeklyProgressDayActual[] = [];
    for (const day of includedDays) {
      const byName = dayActualByPlayerName.get(day.id);
      const raw =
        byName?.get(snapshot.powerbi_player_name) ??
        ({ status: "error" } as const);
      const mapped = dayStatusFromBatchPlayerResult(raw);
      dayResults.push({
        weekDayId: day.id,
        date: day.date,
        mdTag: day.md_tag,
        status: mapped.status,
        actual: mapped.actual,
        hasDailyTarget: dailyByPlayerDay.has(
          `${target.player_id}:${day.id}`
        ),
      });
    }

    const aggregated = aggregateWeeklyActualFromDays(
      dayResults,
      weeklyPlanned
    );

    results.push({
      weekId: input.weekId,
      powerBiWeekId: weekResult.data.powerbi_week_id,
      playerId: target.player_id,
      playerDisplayName:
        displayNames.get(target.player_id) ??
        playerDisplayName(null, null),
      throughDate: input.throughDate,
      frozen: {
        ...best,
        powerBiPlayerName: snapshot.powerbi_player_name,
        sourceMethod: snapshot.source_method,
      },
      weeklyPct,
      weeklyPlanned,
      dailyAllocationSum,
      remainingToAllocate: remaining,
      days: dayResults,
      includedDays: includedDays.length,
      foundDays: aggregated.foundDays,
      notFoundDays: aggregated.notFoundDays,
      problematicDays: aggregated.problematicDays,
      weeklyActual: aggregated.weeklyActual,
      weeklyToTarget: aggregated.weeklyToTarget,
      actualCompleteness: aggregated.actualCompleteness,
    });
  }

  return { ok: true, data: results };
}
