/**
 * Pure Weekly Actual aggregation from per-day statuses.
 * Shared by single-player Progress and day-batched Weekly Review.
 * Missing Actual ≠ zero. Ambiguous/error withhold To Target.
 */

import {
  differenceAbsolute,
  sumAbsoluteMetrics,
  type AbsoluteMetrics,
} from "@/lib/gpsPlanner/calculations";
import type { DayActualStatus } from "@/lib/gpsPlanner/types";

export type WeeklyDayActualInput = {
  status: DayActualStatus;
  actual: AbsoluteMetrics | null;
};

export type WeeklyActualAggregation = {
  foundDays: number;
  notFoundDays: number;
  problematicDays: number;
  weeklyActual: AbsoluteMetrics | null;
  weeklyToTarget: AbsoluteMetrics | null;
  actualCompleteness: "complete" | "partial_not_found" | "incomplete";
};

/**
 * Aggregate included-day Actual statuses into Weekly Actual / To Target /
 * completeness using the locked V1 contract.
 */
export function aggregateWeeklyActualFromDays(
  days: WeeklyDayActualInput[],
  weeklyPlanned: AbsoluteMetrics
): WeeklyActualAggregation {
  const foundActuals: AbsoluteMetrics[] = [];
  let foundDays = 0;
  let notFoundDays = 0;
  let problematicDays = 0;

  for (const day of days) {
    if (day.status === "actual_found" && day.actual) {
      foundDays += 1;
      foundActuals.push(day.actual);
      continue;
    }
    if (day.status === "actual_not_found") {
      notFoundDays += 1;
      continue;
    }
    // ambiguous | error | incomplete → problematic
    problematicDays += 1;
  }

  if (days.length === 0) {
    return {
      foundDays: 0,
      notFoundDays: 0,
      problematicDays: 0,
      weeklyActual: null,
      weeklyToTarget: null,
      actualCompleteness: "partial_not_found",
    };
  }

  if (problematicDays > 0) {
    return {
      foundDays,
      notFoundDays,
      problematicDays,
      weeklyActual:
        foundActuals.length > 0 ? sumAbsoluteMetrics(foundActuals) : null,
      weeklyToTarget: null,
      actualCompleteness: "incomplete",
    };
  }

  if (notFoundDays > 0) {
    if (foundActuals.length > 0) {
      const weeklyActual = sumAbsoluteMetrics(foundActuals);
      return {
        foundDays,
        notFoundDays,
        problematicDays,
        weeklyActual,
        weeklyToTarget: differenceAbsolute(weeklyPlanned, weeklyActual),
        actualCompleteness: "partial_not_found",
      };
    }
    return {
      foundDays,
      notFoundDays,
      problematicDays,
      weeklyActual: null,
      weeklyToTarget: null,
      actualCompleteness: "partial_not_found",
    };
  }

  const weeklyActual = sumAbsoluteMetrics(foundActuals);
  return {
    foundDays,
    notFoundDays,
    problematicDays,
    weeklyActual,
    weeklyToTarget: differenceAbsolute(weeklyPlanned, weeklyActual),
    actualCompleteness: "complete",
  };
}
