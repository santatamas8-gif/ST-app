import "server-only";

/**
 * ADMIN-ONLY official-match GPS date candidates for one Planner week.
 * Read-only. Does not persist. Does not auto-select a candidate.
 */

import { requirePlannerAdmin } from "@/lib/gpsPlanner/auth.server";
import {
  isPlannerUuid,
  plannerErr,
  type PlannerResult,
} from "@/lib/gpsPlanner/common";
import type { PlannerMatchCandidate } from "@/lib/gpsPlanner/types";
import { getPlannerWeek } from "@/lib/gpsPlanner/weeks.server";
import { getMatchCandidateDates } from "@/lib/powerbi/queries/matchCandidates.server";

export type { PlannerMatchCandidate as MatchCandidate };

export async function listPlannerMatchCandidates(
  weekId: string
): Promise<PlannerResult<PlannerMatchCandidate[]>> {
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

  const result = await getMatchCandidateDates({
    weekId: weekResult.data.powerbiWeekId,
  });
  if (!result.ok) {
    return {
      ok: false,
      error: plannerErr(
        "powerbi_error",
        "Match GPS candidates are unavailable."
      ),
    };
  }

  return { ok: true, data: result.candidates };
}
