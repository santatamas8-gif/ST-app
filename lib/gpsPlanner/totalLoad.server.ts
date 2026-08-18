import "server-only";

/**
 * ADMIN-ONLY Total Load Phase 3 composer.
 * Read-only: reuses Weekly Review Training + Phase 2 Match Actual.
 * Does not persist Total Week / % / Top Values. No UI.
 */

import { requirePlannerAdmin } from "@/lib/gpsPlanner/auth.server";
import {
  isPlannerUuid,
  plannerErr,
  type PlannerResult,
} from "@/lib/gpsPlanner/common";
import { getPlannerWeeklyReviewProgress } from "@/lib/gpsPlanner/progress.server";
import {
  composeTotalLoadResult,
  type TotalLoadResult,
} from "@/lib/gpsPlanner/totalLoadAggregation";
import { getPlannerWeekOfficialMatch } from "@/lib/gpsPlanner/weekMatches.server";
import { getPlannerWeek } from "@/lib/gpsPlanner/weeks.server";
import { getMatchActualGpsBatch } from "@/lib/powerbi/queries/matchActual.server";

export type { TotalLoadResult };

export async function getPlannerTotalLoad(
  weekId: string
): Promise<PlannerResult<TotalLoadResult>> {
  const authError = await requirePlannerAdmin();
  if (authError) return { ok: false, error: authError };

  if (!isPlannerUuid(weekId)) {
    return {
      ok: false,
      error: plannerErr("invalid_input", "weekId must be a valid UUID."),
    };
  }

  const weekResult = await getPlannerWeek(weekId);
  if (!weekResult.ok) return weekResult;
  if (!weekResult.data) {
    return {
      ok: false,
      error: plannerErr("week_not_found", "Planner week was not found."),
    };
  }

  const week = weekResult.data;
  const trainingResult = await getPlannerWeeklyReviewProgress({
    weekId: week.id,
    throughDate: week.endDate,
  });
  if (!trainingResult.ok) return trainingResult;

  const officialMatchResult = await getPlannerWeekOfficialMatch(week.id);
  if (!officialMatchResult.ok) return officialMatchResult;
  const officialMatch = officialMatchResult.data;

  const weekView = {
    id: week.id,
    powerbiWeekId: week.powerbiWeekId,
    startDate: week.startDate,
    endDate: week.endDate,
  };

  if (trainingResult.data.length === 0 || !officialMatch) {
    return {
      ok: true,
      data: composeTotalLoadResult({
        week: weekView,
        officialMatch,
        trainingRows: trainingResult.data,
        matchBatch: null,
      }),
    };
  }

  const frozenNames = [
    ...new Set(
      trainingResult.data
        .map((row) => row.frozen.powerBiPlayerName)
        .filter((name) => name.length > 0)
    ),
  ];

  const matchResult = await getMatchActualGpsBatch({
    weekId: week.powerbiWeekId,
    gpsDate: officialMatch.gpsDate,
    playerNames: frozenNames,
  });

  return {
    ok: true,
    data: composeTotalLoadResult({
      week: weekView,
      officialMatch,
      trainingRows: trainingResult.data,
      matchBatch: matchResult.ok
        ? { ok: true, byPlayerName: matchResult.byPlayerName }
        : { ok: false },
    }),
  };
}
