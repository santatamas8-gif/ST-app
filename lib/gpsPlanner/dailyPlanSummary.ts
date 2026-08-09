/**
 * Pure Daily Plan print summary helpers (read-only projection).
 * Do not persist. Do not invent averages of percentages.
 * Missing targets are excluded — never treated as zero.
 *
 * Shared types live in `lib/gpsPlanner/types.ts` (single source of truth).
 */

import type {
  DailyPlanPctSummary,
  DailyPlanSharedPct,
  DailyPlanTeamAverage,
} from "@/lib/gpsPlanner/types";

/**
 * If no values → null (—).
 * If all equal → that percentage.
 * If any differ → "Mixed".
 * Does NOT average percentages.
 */
export function summarizeSharedPercentage(
  values: readonly number[]
): DailyPlanSharedPct {
  if (values.length === 0) return null;
  const first = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== first) return "Mixed";
  }
  return first;
}

/**
 * Average of valid absolute values only.
 * Empty list → null (not zero).
 * Uses raw values; caller applies display rounding later.
 */
export function averageValidAbsolutes(
  values: readonly number[]
): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

export function buildPctSummary(input: {
  td: readonly number[];
  hsr: readonly number[];
  sprint: readonly number[];
  acc: readonly number[];
  dec: readonly number[];
}): DailyPlanPctSummary {
  return {
    td: summarizeSharedPercentage(input.td),
    hsr: summarizeSharedPercentage(input.hsr),
    sprint: summarizeSharedPercentage(input.sprint),
    acc: summarizeSharedPercentage(input.acc),
    dec: summarizeSharedPercentage(input.dec),
  };
}

export function buildTeamAverage(input: {
  totalDistance: readonly number[];
  hsr: readonly number[];
  sprint: readonly number[];
  accelerations: readonly number[];
  decelerations: readonly number[];
}): DailyPlanTeamAverage {
  return {
    totalDistance: averageValidAbsolutes(input.totalDistance),
    hsr: averageValidAbsolutes(input.hsr),
    sprint: averageValidAbsolutes(input.sprint),
    accelerations: averageValidAbsolutes(input.accelerations),
    decelerations: averageValidAbsolutes(input.decelerations),
  };
}
