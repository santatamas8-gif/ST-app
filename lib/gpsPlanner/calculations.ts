/**
 * Pure GPS Planner calculation helpers (Phase B + C).
 * No I/O. No rounding. Absolutes/differences are derived only — never persisted.
 */

export type MatchBestMetrics = {
  tdBest: number;
  hsrBest: number;
  sprintBest: number;
  accBest: number;
  decBest: number;
};

export type PercentageMetrics = {
  tdPct: number;
  hsrPct: number;
  sprintPct: number;
  accPct: number;
  decPct: number;
};

/** @deprecated Prefer PercentageMetrics — same shape for weekly and daily %. */
export type WeeklyPercentageMetrics = PercentageMetrics;

export type AbsoluteMetrics = {
  totalDistance: number;
  hsr: number;
  sprint: number;
  accelerations: number;
  decelerations: number;
};

export type WeeklyPlannedAbsolutes = AbsoluteMetrics;
export type DailyPlannedAbsolutes = AbsoluteMetrics;

/** planned = best * pct / 100 — no rounding. */
export function plannedAbsolute(best: number, pct: number): number {
  return (best * pct) / 100;
}

/**
 * Derive absolute planned load from frozen Match Best × human-scale %.
 * Used for Weekly Planned and Daily Planned (same formula; Daily % is NOT % of Weekly).
 */
export function calculatePlannedAbsolutes(
  best: MatchBestMetrics,
  pct: PercentageMetrics
): AbsoluteMetrics {
  return {
    totalDistance: plannedAbsolute(best.tdBest, pct.tdPct),
    hsr: plannedAbsolute(best.hsrBest, pct.hsrPct),
    sprint: plannedAbsolute(best.sprintBest, pct.sprintPct),
    accelerations: plannedAbsolute(best.accBest, pct.accPct),
    decelerations: plannedAbsolute(best.decBest, pct.decPct),
  };
}

export function calculateWeeklyPlannedAbsolutes(
  best: MatchBestMetrics,
  pct: PercentageMetrics
): AbsoluteMetrics {
  return calculatePlannedAbsolutes(best, pct);
}

export function calculateDailyPlannedAbsolutes(
  best: MatchBestMetrics,
  pct: PercentageMetrics
): AbsoluteMetrics {
  return calculatePlannedAbsolutes(best, pct);
}

/** Difference = Planned − Actual (positive = still missing). */
export function differenceAbsolute(
  planned: AbsoluteMetrics,
  actual: AbsoluteMetrics
): AbsoluteMetrics {
  return {
    totalDistance: planned.totalDistance - actual.totalDistance,
    hsr: planned.hsr - actual.hsr,
    sprint: planned.sprint - actual.sprint,
    accelerations: planned.accelerations - actual.accelerations,
    decelerations: planned.decelerations - actual.decelerations,
  };
}

export function sumPercentageMetrics(
  items: PercentageMetrics[]
): PercentageMetrics {
  return items.reduce(
    (acc, item) => ({
      tdPct: acc.tdPct + item.tdPct,
      hsrPct: acc.hsrPct + item.hsrPct,
      sprintPct: acc.sprintPct + item.sprintPct,
      accPct: acc.accPct + item.accPct,
      decPct: acc.decPct + item.decPct,
    }),
    { tdPct: 0, hsrPct: 0, sprintPct: 0, accPct: 0, decPct: 0 }
  );
}

/** Remaining to Allocate % = Weekly Target % − SUM(Daily Target %). */
export function remainingToAllocate(
  weekly: PercentageMetrics,
  dailySum: PercentageMetrics
): PercentageMetrics {
  return {
    tdPct: weekly.tdPct - dailySum.tdPct,
    hsrPct: weekly.hsrPct - dailySum.hsrPct,
    sprintPct: weekly.sprintPct - dailySum.sprintPct,
    accPct: weekly.accPct - dailySum.accPct,
    decPct: weekly.decPct - dailySum.decPct,
  };
}

export function sumAbsoluteMetrics(items: AbsoluteMetrics[]): AbsoluteMetrics {
  return items.reduce(
    (acc, item) => ({
      totalDistance: acc.totalDistance + item.totalDistance,
      hsr: acc.hsr + item.hsr,
      sprint: acc.sprint + item.sprint,
      accelerations: acc.accelerations + item.accelerations,
      decelerations: acc.decelerations + item.decelerations,
    }),
    {
      totalDistance: 0,
      hsr: 0,
      sprint: 0,
      accelerations: 0,
      decelerations: 0,
    }
  );
}

/** Human-scale %: finite number, >= 0, no upper bound. */
export function isValidPlannerPercentage(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Match Best metric: finite number, >= 0 (zero allowed). */
export function isValidMatchBestValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Actual metric for summing: finite number including zero; null/undefined excluded. */
export function isPresentActualValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
