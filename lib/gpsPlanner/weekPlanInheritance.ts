/**
 * Persistent Week Squad plan inheritance — pure domain helpers (§J2.11–J2.17).
 * Detection/clustering only. No I/O. No Groups. No Power BI. No membership writes.
 */

import { createHash } from "node:crypto";
import type { PercentageMetrics } from "@/lib/gpsPlanner/calculations";
import {
  isPlannerUuid,
  plannerErr,
  type PlannerResult,
} from "@/lib/gpsPlanner/common";
import type {
  PlannerReusablePlan,
  PlannerReusablePlanDaily,
} from "@/lib/gpsPlanner/types";

export type InheritanceTrainingDay = {
  weekDayId: string;
  mdTag: string;
  date: string;
  displayOrder: number;
};

export function normalizePlannerPlayerIds(
  raw: unknown,
  fieldName: string
): PlannerResult<string[]> {
  if (!Array.isArray(raw)) {
    return {
      ok: false,
      error: plannerErr(
        "invalid_input",
        `${fieldName} must be an array of player UUIDs.`
      ),
    };
  }

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || item.trim() === "" || !isPlannerUuid(item)) {
      return {
        ok: false,
        error: plannerErr(
          "invalid_input",
          `Each ${fieldName} value must be a valid UUID.`
        ),
      };
    }
    if (seen.has(item)) continue;
    seen.add(item);
    normalized.push(item);
  }
  return { ok: true, data: normalized };
}

/** Current saved squad minus this Save's added players. Newly added cannot be templates. */
export function sourceSquadPlayerIds(
  savedSquadPlayerIds: readonly string[],
  addedPlayerIds: readonly string[]
): string[] {
  const added = new Set(addedPlayerIds);
  return savedSquadPlayerIds.filter((id) => !added.has(id));
}

export function classifyAddedPlayersForInheritance(
  addedPlayerIds: readonly string[],
  playersWithWeeklyTarget: ReadonlySet<string>
): {
  eligibleNewPlayerIds: string[];
  returningPlayerIds: string[];
} {
  const eligibleNewPlayerIds: string[] = [];
  const returningPlayerIds: string[] = [];
  for (const playerId of addedPlayerIds) {
    if (playersWithWeeklyTarget.has(playerId)) {
      returningPlayerIds.push(playerId);
    } else {
      eligibleNewPlayerIds.push(playerId);
    }
  }
  return { eligibleNewPlayerIds, returningPlayerIds };
}

function pctTuple(pct: PercentageMetrics): string {
  return [pct.tdPct, pct.hsrPct, pct.sprintPct, pct.accPct, pct.decPct].join(
    ","
  );
}

/** Deterministic identity of an exact Weekly + per-Training-day percentage signature. */
export function buildReusablePlanKey(
  weeklyPct: PercentageMetrics,
  daily: ReadonlyArray<{ weekDayId: string; pct: PercentageMetrics }>
): string {
  const days = daily
    .slice()
    .sort((a, b) => a.weekDayId.localeCompare(b.weekDayId));
  const payload = [
    "weekly",
    pctTuple(weeklyPct),
    "daily",
    ...days.map((day) => `${day.weekDayId}:${pctTuple(day.pct)}`),
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

function sortTrainingDays(
  trainingDays: readonly InheritanceTrainingDay[]
): InheritanceTrainingDay[] {
  return trainingDays.slice().sort((a, b) => {
    if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
    return a.date.localeCompare(b.date) || a.weekDayId.localeCompare(b.weekDayId);
  });
}

/**
 * A source player contributes a reusable plan only with Weekly + Daily
 * for every current Training day. Zero Training days → no complete plan.
 * Match rows are never passed in.
 */
export function buildReusablePlans(input: {
  sourcePlayerIds: readonly string[];
  trainingDays: readonly InheritanceTrainingDay[];
  weeklyByPlayerId: ReadonlyMap<string, PercentageMetrics>;
  dailyByPlayerAndDay: ReadonlyMap<string, ReadonlyMap<string, PercentageMetrics>>;
}): PlannerReusablePlan[] {
  const trainingDays = sortTrainingDays(input.trainingDays);
  if (trainingDays.length === 0) return [];

  const clusters = new Map<
    string,
    { plan: PlannerReusablePlan; count: number }
  >();

  for (const playerId of input.sourcePlayerIds) {
    const weeklyPct = input.weeklyByPlayerId.get(playerId);
    if (!weeklyPct) continue;

    const dailyByDay = input.dailyByPlayerAndDay.get(playerId);
    if (!dailyByDay) continue;

    const daily: PlannerReusablePlanDaily[] = [];
    let complete = true;
    for (const day of trainingDays) {
      const pct = dailyByDay.get(day.weekDayId);
      if (!pct) {
        complete = false;
        break;
      }
      daily.push({
        weekDayId: day.weekDayId,
        mdTag: day.mdTag,
        date: day.date,
        pct,
      });
    }
    if (!complete) continue;

    const planKey = buildReusablePlanKey(weeklyPct, daily);
    const existing = clusters.get(planKey);
    if (existing) {
      existing.count += 1;
      existing.plan.playerCount = existing.count;
      continue;
    }
    clusters.set(planKey, {
      count: 1,
      plan: {
        planKey,
        playerCount: 1,
        weeklyPct,
        daily,
      },
    });
  }

  return Array.from(clusters.values())
    .map((entry) => entry.plan)
    .sort((a, b) => {
      if (b.playerCount !== a.playerCount) return b.playerCount - a.playerCount;
      return a.planKey.localeCompare(b.planKey);
    });
}
