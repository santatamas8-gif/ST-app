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
  sumAbsoluteMetrics,
  sumPercentageMetrics,
  type AbsoluteMetrics,
  type MatchBestMetrics,
  type PercentageMetrics,
} from "@/lib/gpsPlanner/calculations";
import { getTrainingActualGps } from "@/lib/powerbi/queries/trainingActual.server";
import type {
  DayActualStatus,
  PlannerWeeklyProgressResult,
  WeeklyProgressDayActual,
} from "@/lib/gpsPlanner/types";

export type PlannerActualMetrics = AbsoluteMetrics;

export type { DayActualStatus, WeeklyProgressDayActual, PlannerWeeklyProgressResult };

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

export type PlannerDailyAnalysisResult = {
  weekId: string;
  powerBiWeekId: string;
  weekDayId: string;
  date: string;
  mdTag: string;
  playerId: string;
  playerDisplayName: string;
  powerBiPlayerName: string;
  hasDailyTarget: boolean;
  dailyPct: PercentageMetrics | null;
  planned: AbsoluteMetrics | null;
  actualStatus: DayActualStatus | null;
  actual: PlannerActualMetrics | null;
  difference: AbsoluteMetrics | null;
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
 * Daily Analysis: Planned / Actual / Difference when safely available.
 * Missing Actual ≠ zero. Ambiguous/error → no Difference.
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
  const foundActuals: AbsoluteMetrics[] = [];
  let foundDays = 0;
  let notFoundDays = 0;
  let problematicDays = 0;

  // Sequential Power BI calls — bounded by planner week day count (~4–5).
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
        notFoundDays += 1;
      } else if (pbi.error.code === "ambiguous") {
        status = "actual_ambiguous";
        problematicDays += 1;
      } else {
        status = "actual_error";
        problematicDays += 1;
      }
    } else {
      const mapped = mapFoundActual(pbi.data);
      status = mapped.status;
      actual = mapped.actual;
      if (mapped.status === "actual_found" && mapped.actual) {
        foundDays += 1;
        foundActuals.push(mapped.actual);
      } else {
        problematicDays += 1;
      }
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

  let actualCompleteness: PlannerWeeklyProgressResult["actualCompleteness"];
  let weeklyActual: AbsoluteMetrics | null = null;
  let weeklyToTarget: AbsoluteMetrics | null = null;

  if (includedDays.length === 0) {
    // No days in throughDate range — not a measured-zero week.
    actualCompleteness = "partial_not_found";
    weeklyActual = null;
    weeklyToTarget = null;
  } else if (problematicDays > 0) {
    actualCompleteness = "incomplete";
    // Partial found values may be returned for inspection, but Weekly To Target is withheld.
    weeklyActual =
      foundActuals.length > 0 ? sumAbsoluteMetrics(foundActuals) : null;
    weeklyToTarget = null;
  } else if (notFoundDays > 0) {
    actualCompleteness = "partial_not_found";
    // not_found ≠ measured zero: only sum genuine found rows.
    if (foundActuals.length > 0) {
      weeklyActual = sumAbsoluteMetrics(foundActuals);
      weeklyToTarget = differenceAbsolute(weeklyPlanned, weeklyActual);
    } else {
      weeklyActual = null;
      weeklyToTarget = null;
    }
  } else {
    actualCompleteness = "complete";
    weeklyActual = sumAbsoluteMetrics(foundActuals);
    weeklyToTarget = differenceAbsolute(weeklyPlanned, weeklyActual);
  }

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
      foundDays,
      notFoundDays,
      problematicDays,
      weeklyActual,
      weeklyToTarget,
      actualCompleteness,
    },
  };
}
