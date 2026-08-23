import "server-only";

/**
 * ADMIN-ONLY Apply Existing Plan detection + apply (§J2.11–J2.18).
 * Separate from Save Squad. Membership is never written here.
 * Detection: persisted percentages only — no Power BI, Groups, or snapshots.
 * Apply: create path only (percentages). No overwrite of existing Weekly Targets.
 */

import { createClient } from "@/lib/supabase/server";
import { requirePlannerAdmin } from "@/lib/gpsPlanner/auth.server";
import {
  isPlannerUuid,
  mapPlannerDbError,
  plannerErr,
  type PlannerResult,
} from "@/lib/gpsPlanner/common";
import { createPlannerDailyTarget } from "@/lib/gpsPlanner/dailyTargets.server";
import { createPlannerWeeklyTarget } from "@/lib/gpsPlanner/weeklyTargets.server";
import {
  buildReusablePlans,
  classifyAddedPlayersForInheritance,
  normalizePlannerPlayerIds,
  sourceSquadPlayerIds,
  type InheritanceTrainingDay,
} from "@/lib/gpsPlanner/weekPlanInheritance";
import type { PercentageMetrics } from "@/lib/gpsPlanner/calculations";
import type {
  AnalyzePlannerWeekPlanInheritanceInput,
  ApplyExistingPlanDailyOutcome,
  ApplyExistingPlanPlayerOutcome,
  ApplyPlannerExistingPlanInput,
  ApplyPlannerExistingPlanResult,
  PlannerReusablePlan,
  PlannerWeekPlanInheritanceAnalysis,
} from "@/lib/gpsPlanner/types";

export type {
  AnalyzePlannerWeekPlanInheritanceInput,
  ApplyPlannerExistingPlanInput,
  ApplyPlannerExistingPlanResult,
  PlannerWeekPlanInheritanceAnalysis,
};

type WeeklyPctRow = {
  player_id: string;
  td_pct: number;
  hsr_pct: number;
  sprint_pct: number;
  acc_pct: number;
  dec_pct: number;
};

type DailyPctRow = {
  player_id: string;
  week_day_id: string;
  td_pct: number;
  hsr_pct: number;
  sprint_pct: number;
  acc_pct: number;
  dec_pct: number;
};

type DayRow = {
  id: string;
  date: string;
  md_tag: string;
  display_order: number;
};

type MembershipRow = {
  player_id: string;
};

type LoadedWeekPlanContext = {
  savedSquadPlayerIds: string[];
  trainingDays: InheritanceTrainingDay[];
  weeklyByPlayerId: Map<string, PercentageMetrics>;
  dailyByPlayerAndDay: Map<string, Map<string, PercentageMetrics>>;
};

function pctFromRow(row: {
  td_pct: number;
  hsr_pct: number;
  sprint_pct: number;
  acc_pct: number;
  dec_pct: number;
}): PercentageMetrics {
  return {
    tdPct: Number(row.td_pct),
    hsrPct: Number(row.hsr_pct),
    sprintPct: Number(row.sprint_pct),
    accPct: Number(row.acc_pct),
    decPct: Number(row.dec_pct),
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

async function loadWeekPlanContext(
  weekId: string
): Promise<PlannerResult<LoadedWeekPlanContext>> {
  const weekError = await assertWeekExists(weekId);
  if (weekError) return { ok: false, error: weekError };

  const supabase = await createClient();

  const { data: membership, error: membershipError } = await supabase
    .from("planner_week_players")
    .select("player_id")
    .eq("week_id", weekId);
  if (membershipError) {
    return {
      ok: false,
      error: mapPlannerDbError("loadWeekPlanContext.membership", membershipError),
    };
  }

  const { data: days, error: daysError } = await supabase
    .from("planner_week_days")
    .select("id, date, md_tag, display_order")
    .eq("week_id", weekId)
    .order("display_order", { ascending: true })
    .order("date", { ascending: true });
  if (daysError) {
    return {
      ok: false,
      error: mapPlannerDbError("loadWeekPlanContext.days", daysError),
    };
  }

  const { data: weeklyRows, error: weeklyError } = await supabase
    .from("planner_weekly_targets")
    .select("player_id, td_pct, hsr_pct, sprint_pct, acc_pct, dec_pct")
    .eq("week_id", weekId);
  if (weeklyError) {
    return {
      ok: false,
      error: mapPlannerDbError("loadWeekPlanContext.weekly", weeklyError),
    };
  }

  const { data: dailyRows, error: dailyError } = await supabase
    .from("planner_daily_targets")
    .select(
      "player_id, week_day_id, td_pct, hsr_pct, sprint_pct, acc_pct, dec_pct"
    )
    .eq("week_id", weekId);
  if (dailyError) {
    return {
      ok: false,
      error: mapPlannerDbError("loadWeekPlanContext.daily", dailyError),
    };
  }

  const weeklyByPlayerId = new Map<string, PercentageMetrics>();
  for (const row of (weeklyRows ?? []) as WeeklyPctRow[]) {
    weeklyByPlayerId.set(row.player_id, pctFromRow(row));
  }

  const dailyByPlayerAndDay = new Map<string, Map<string, PercentageMetrics>>();
  for (const row of (dailyRows ?? []) as DailyPctRow[]) {
    let byDay = dailyByPlayerAndDay.get(row.player_id);
    if (!byDay) {
      byDay = new Map();
      dailyByPlayerAndDay.set(row.player_id, byDay);
    }
    byDay.set(row.week_day_id, pctFromRow(row));
  }

  return {
    ok: true,
    data: {
      savedSquadPlayerIds: ((membership ?? []) as MembershipRow[]).map(
        (row) => row.player_id
      ),
      trainingDays: ((days ?? []) as DayRow[]).map((row) => ({
        weekDayId: row.id,
        mdTag: row.md_tag,
        date: row.date,
        displayOrder: Number(row.display_order),
      })),
      weeklyByPlayerId,
      dailyByPlayerAndDay,
    },
  };
}

function plansFromContext(
  context: LoadedWeekPlanContext,
  excludedPlayerIds: readonly string[]
): PlannerReusablePlan[] {
  return buildReusablePlans({
    sourcePlayerIds: sourceSquadPlayerIds(
      context.savedSquadPlayerIds,
      excludedPlayerIds
    ),
    trainingDays: context.trainingDays,
    weeklyByPlayerId: context.weeklyByPlayerId,
    dailyByPlayerAndDay: context.dailyByPlayerAndDay,
  });
}

/**
 * After Save Squad: classify added players and cluster complete reusable plans
 * from saved squad minus addedPlayerIds. Does not write targets or membership.
 */
export async function analyzePlannerWeekPlanInheritance(
  input: AnalyzePlannerWeekPlanInheritanceInput
): Promise<PlannerResult<PlannerWeekPlanInheritanceAnalysis>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  if (!isPlannerUuid(input.weekId)) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "weekId must be a valid UUID."),
    };
  }

  const added = normalizePlannerPlayerIds(input.addedPlayerIds, "addedPlayerIds");
  if (!added.ok) return added;

  const context = await loadWeekPlanContext(input.weekId);
  if (!context.ok) return context;

  const classified = classifyAddedPlayersForInheritance(
    added.data,
    new Set(context.data.weeklyByPlayerId.keys())
  );

  return {
    ok: true,
    data: {
      eligibleNewPlayerIds: classified.eligibleNewPlayerIds,
      returningPlayerIds: classified.returningPlayerIds,
      reusablePlans: plansFromContext(context.data, added.data),
    },
  };
}

async function applyPlanToTargetlessPlayer(input: {
  weekId: string;
  playerId: string;
  plan: PlannerReusablePlan;
}): Promise<ApplyExistingPlanPlayerOutcome> {
  const weekly = await createPlannerWeeklyTarget({
    weekId: input.weekId,
    playerId: input.playerId,
    tdPct: input.plan.weeklyPct.tdPct,
    hsrPct: input.plan.weeklyPct.hsrPct,
    sprintPct: input.plan.weeklyPct.sprintPct,
    accPct: input.plan.weeklyPct.accPct,
    decPct: input.plan.weeklyPct.decPct,
  });

  if (!weekly.ok) {
    if (weekly.error.code === "weekly_target_already_exists") {
      return {
        playerId: input.playerId,
        status: "already_has_targets",
        message: weekly.error.message,
        weeklyCreated: false,
        daily: [],
      };
    }
    return {
      playerId: input.playerId,
      status: "failed",
      message: weekly.error.message,
      weeklyCreated: false,
      daily: [],
    };
  }

  const daily: ApplyExistingPlanDailyOutcome[] = [];
  let dailyFailed = 0;
  for (const day of input.plan.daily) {
    const created = await createPlannerDailyTarget({
      weekDayId: day.weekDayId,
      playerId: input.playerId,
      tdPct: day.pct.tdPct,
      hsrPct: day.pct.hsrPct,
      sprintPct: day.pct.sprintPct,
      accPct: day.pct.accPct,
      decPct: day.pct.decPct,
    });
    if (created.ok) {
      daily.push({ weekDayId: day.weekDayId, status: "created" });
    } else {
      dailyFailed += 1;
      daily.push({
        weekDayId: day.weekDayId,
        status: "failed",
        message: created.error.message,
      });
    }
  }

  if (dailyFailed > 0) {
    return {
      playerId: input.playerId,
      status: "failed",
      message:
        "Weekly Target was created but one or more Daily Targets failed.",
      weeklyCreated: true,
      daily,
    };
  }

  return {
    playerId: input.playerId,
    status: "applied",
    weeklyCreated: true,
    daily,
  };
}

/**
 * Explicit Admin Apply Existing Plan. Revalidates planKey from persisted data.
 * Never updates existing Weekly Targets. Never writes membership or Groups.
 */
export async function applyPlannerExistingPlan(
  input: ApplyPlannerExistingPlanInput
): Promise<PlannerResult<ApplyPlannerExistingPlanResult>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  if (!isPlannerUuid(input.weekId)) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "weekId must be a valid UUID."),
    };
  }
  if (typeof input.planKey !== "string" || input.planKey.trim() === "") {
    return {
      ok: false,
      error: plannerErr("invalid_input", "planKey is required."),
    };
  }

  const targets = normalizePlannerPlayerIds(
    input.targetPlayerIds,
    "targetPlayerIds"
  );
  if (!targets.ok) return targets;

  const context = await loadWeekPlanContext(input.weekId);
  if (!context.ok) return context;

  const reusablePlans = plansFromContext(context.data, targets.data);
  const selected = reusablePlans.find((plan) => plan.planKey === input.planKey);
  if (!selected) {
    return {
      ok: false,
      error: plannerErr(
        "stale_plan",
        "The selected plan is no longer available or has changed."
      ),
    };
  }

  const outcomes: ApplyExistingPlanPlayerOutcome[] = [];
  for (const playerId of targets.data) {
    if (context.data.weeklyByPlayerId.has(playerId)) {
      outcomes.push({
        playerId,
        status: "already_has_targets",
        message: "Player already has a Weekly Target for this week.",
        weeklyCreated: false,
        daily: [],
      });
      continue;
    }
    outcomes.push(
      await applyPlanToTargetlessPlayer({
        weekId: input.weekId,
        playerId,
        plan: selected,
      })
    );
  }

  return {
    ok: true,
    data: {
      planKey: selected.planKey,
      outcomes,
    },
  };
}
