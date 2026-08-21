import "server-only";

/**
 * ADMIN-ONLY Total Load composer.
 * Read-only: reuses Weekly Review Training + Phase 2 Match Actual.
 * Does not persist Total Week / % / Top Values.
 *
 * Phase E: plural official Match rows (0–2). One candidate/source-availability
 * query per Power BI week, then 0–2 Match Actual batches for dates proven
 * present in the Team MD GPS candidate set.
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
  type TotalLoadMatchSource,
  type TotalLoadResult,
} from "@/lib/gpsPlanner/totalLoadAggregation";
import type { PlannerWeekOfficialMatch } from "@/lib/gpsPlanner/types";
import { getPlannerWeekOfficialMatches } from "@/lib/gpsPlanner/weekMatches.server";
import { getPlannerWeek } from "@/lib/gpsPlanner/weeks.server";
import { getMatchActualGpsBatch } from "@/lib/powerbi/queries/matchActual.server";
import { getMatchCandidateDates } from "@/lib/powerbi/queries/matchCandidates.server";

export type { TotalLoadResult };

function queryErrorSources(
  officialMatches: PlannerWeekOfficialMatch[]
): TotalLoadMatchSource[] {
  return officialMatches.map((officialMatch) => ({
    officialMatch,
    availability: "query_error" as const,
    matchBatch: { ok: false as const },
  }));
}

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

  const officialMatchesResult = await getPlannerWeekOfficialMatches(week.id);
  if (!officialMatchesResult.ok) return officialMatchesResult;
  const officialMatches = officialMatchesResult.data;

  const weekView = {
    id: week.id,
    powerbiWeekId: week.powerbiWeekId,
    startDate: week.startDate,
    endDate: week.endDate,
  };

  if (trainingResult.data.length === 0 || officialMatches.length === 0) {
    return {
      ok: true,
      data: composeTotalLoadResult({
        week: weekView,
        officialMatches,
        trainingRows: trainingResult.data,
        matchSources: [],
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

  const candidateResult = await getMatchCandidateDates({
    weekId: week.powerbiWeekId,
  });
  if (!candidateResult.ok) {
    return {
      ok: true,
      data: composeTotalLoadResult({
        week: weekView,
        officialMatches,
        trainingRows: trainingResult.data,
        matchSources: queryErrorSources(officialMatches),
      }),
    };
  }

  const availableDates = new Set(
    candidateResult.candidates.map((candidate) => candidate.gpsDate)
  );

  const matchSources: TotalLoadMatchSource[] = [];
  for (const officialMatch of officialMatches) {
    if (!availableDates.has(officialMatch.gpsDate)) {
      matchSources.push({
        officialMatch,
        availability: "pending",
        matchBatch: null,
      });
      continue;
    }

    const matchResult = await getMatchActualGpsBatch({
      weekId: week.powerbiWeekId,
      gpsDate: officialMatch.gpsDate,
      playerNames: frozenNames,
    });
    matchSources.push({
      officialMatch,
      availability: "available",
      matchBatch: matchResult.ok
        ? { ok: true, byPlayerName: matchResult.byPlayerName }
        : { ok: false },
    });
  }

  return {
    ok: true,
    data: composeTotalLoadResult({
      week: weekView,
      officialMatches,
      trainingRows: trainingResult.data,
      matchSources,
    }),
  };
}
