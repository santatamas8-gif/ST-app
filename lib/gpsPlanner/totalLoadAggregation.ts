/**
 * Pure Total Load composition (Training Actual + safe Match Actual).
 * No I/O. No rounding. No persistence. No UI strings.
 */

import type { AbsoluteMetrics } from "@/lib/gpsPlanner/calculations";
import { buildPctSummary } from "@/lib/gpsPlanner/dailyPlanSummary";
import type {
  DailyPlanPctSummary,
  PlannerWeekOfficialMatch,
  PlannerWeeklyProgressResult,
} from "@/lib/gpsPlanner/types";
import type {
  MatchActualPlayerResult,
  MatchActualQuality,
} from "@/lib/powerbi/queries/matchActualClassify";

export type TotalLoadQuality =
  | "complete"
  | "partial"
  | "unsafe"
  | "match_not_selected";

export type TotalLoadMatchQuality =
  | MatchActualQuality
  | "match_query_error"
  | "match_not_selected";

export type TotalLoadPercentages = {
  totalDistance: number | null;
  hsr: number | null;
  sprint: number | null;
  accelerations: number | null;
  decelerations: number | null;
};

export type TotalLoadPlayerRow = {
  playerId: string;
  playerDisplayName: string;
  frozenPowerBiPlayerName: string;
  quality: TotalLoadQuality;
  training: {
    completeness: PlannerWeeklyProgressResult["actualCompleteness"];
    metrics: AbsoluteMetrics | null;
    foundDays: number;
    notFoundDays: number;
    problematicDays: number;
  };
  match: {
    quality: TotalLoadMatchQuality;
    metrics: AbsoluteMetrics | null;
    durationSeconds: number | null;
  };
  total: {
    metrics: AbsoluteMetrics | null;
    percentages: TotalLoadPercentages | null;
  };
};

export type TotalLoadTopValue = {
  playerId: string;
  playerDisplayName: string;
  value: number;
} | null;

export type TotalLoadTopValues = {
  totalDistance: TotalLoadTopValue;
  hsr: TotalLoadTopValue;
  sprint: TotalLoadTopValue;
  accelerations: TotalLoadTopValue;
  decelerations: TotalLoadTopValue;
};

export type TotalLoadOfficialMatchView = {
  selected: boolean;
  gpsDate: string | null;
  opponent: string | null;
  matchday: string | null;
  competition: string | null;
};

export type TotalLoadResult = {
  week: {
    id: string;
    powerbiWeekId: string;
    startDate: string;
    endDate: string;
  };
  officialMatch: TotalLoadOfficialMatchView;
  weeklyPlanSummary: DailyPlanPctSummary;
  rows: TotalLoadPlayerRow[];
  topValues: TotalLoadTopValues;
};

export type TotalLoadMatchBatchInput =
  | { ok: true; byPlayerName: Map<string, MatchActualPlayerResult> }
  | { ok: false }
  | null;

const EMPTY_TOP_VALUES: TotalLoadTopValues = {
  totalDistance: null,
  hsr: null,
  sprint: null,
  accelerations: null,
  decelerations: null,
};

function isUsableDenominator(best: number): boolean {
  return typeof best === "number" && Number.isFinite(best) && best > 0;
}

/** Total Week % for one metric. Frozen Best 0 / invalid → null; does not round. */
export function totalWeekPercentage(
  total: number,
  frozenBest: number
): number | null {
  if (!Number.isFinite(total) || !isUsableDenominator(frozenBest)) return null;
  return (total / frozenBest) * 100;
}

export function addAbsoluteMetrics(
  training: AbsoluteMetrics,
  match: AbsoluteMetrics
): AbsoluteMetrics {
  return {
    totalDistance: training.totalDistance + match.totalDistance,
    hsr: training.hsr + match.hsr,
    sprint: training.sprint + match.sprint,
    accelerations: training.accelerations + match.accelerations,
    decelerations: training.decelerations + match.decelerations,
  };
}

function percentagesFromTotal(
  total: AbsoluteMetrics,
  frozen: PlannerWeeklyProgressResult["frozen"]
): TotalLoadPercentages {
  return {
    totalDistance: totalWeekPercentage(total.totalDistance, frozen.tdBest),
    hsr: totalWeekPercentage(total.hsr, frozen.hsrBest),
    sprint: totalWeekPercentage(total.sprint, frozen.sprintBest),
    accelerations: totalWeekPercentage(total.accelerations, frozen.accBest),
    decelerations: totalWeekPercentage(total.decelerations, frozen.decBest),
  };
}

function matchAbsolutes(
  metrics: MatchActualPlayerResult["metrics"]
): AbsoluteMetrics | null {
  if (!metrics) return null;
  return {
    totalDistance: metrics.totalDistance,
    hsr: metrics.hsr,
    sprint: metrics.sprint,
    accelerations: metrics.accelerations,
    decelerations: metrics.decelerations,
  };
}

/**
 * Recorded Training Actual that Total Load may add.
 * complete or partial_not_found with numeric weeklyActual only.
 * incomplete / missing numeric → not trusted (not zero).
 */
export function recordedTrainingMetrics(
  row: PlannerWeeklyProgressResult
): AbsoluteMetrics | null {
  if (
    row.actualCompleteness !== "complete" &&
    row.actualCompleteness !== "partial_not_found"
  ) {
    return null;
  }
  return row.weeklyActual;
}

function isMatchSafe(quality: MatchActualQuality): boolean {
  return quality === "match_ok" || quality === "match_zero";
}

function pickTopValue(
  rows: TotalLoadPlayerRow[],
  metric: keyof AbsoluteMetrics
): TotalLoadTopValue {
  const eligible = rows.filter(
    (row) => row.quality === "complete" && row.total.metrics != null
  );
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => {
    const av = a.total.metrics![metric];
    const bv = b.total.metrics![metric];
    if (bv !== av) return bv - av;
    return a.playerDisplayName.localeCompare(b.playerDisplayName);
  });
  const winner = eligible[0];
  return {
    playerId: winner.playerId,
    playerDisplayName: winner.playerDisplayName,
    value: winner.total.metrics![metric],
  };
}

export function computeTotalLoadTopValues(
  rows: TotalLoadPlayerRow[]
): TotalLoadTopValues {
  return {
    totalDistance: pickTopValue(rows, "totalDistance"),
    hsr: pickTopValue(rows, "hsr"),
    sprint: pickTopValue(rows, "sprint"),
    accelerations: pickTopValue(rows, "accelerations"),
    decelerations: pickTopValue(rows, "decelerations"),
  };
}

export function officialMatchView(
  match: PlannerWeekOfficialMatch | null
): TotalLoadOfficialMatchView {
  if (!match) {
    return {
      selected: false,
      gpsDate: null,
      opponent: null,
      matchday: null,
      competition: null,
    };
  }
  return {
    selected: true,
    gpsDate: match.gpsDate,
    opponent: match.opponent,
    matchday: match.matchday,
    competition: match.competition,
  };
}

function composePlayerRow(
  training: PlannerWeeklyProgressResult,
  matchBatch: TotalLoadMatchBatchInput
): TotalLoadPlayerRow {
  const trainingMetrics = recordedTrainingMetrics(training);
  const trainingBlock = {
    completeness: training.actualCompleteness,
    metrics: training.weeklyActual,
    foundDays: training.foundDays,
    notFoundDays: training.notFoundDays,
    problematicDays: training.problematicDays,
  };

  const base = {
    playerId: training.playerId,
    playerDisplayName: training.playerDisplayName,
    frozenPowerBiPlayerName: training.frozen.powerBiPlayerName,
    training: trainingBlock,
  };

  if (matchBatch === null) {
    return {
      ...base,
      quality: "match_not_selected",
      match: {
        quality: "match_not_selected",
        metrics: null,
        durationSeconds: null,
      },
      total: { metrics: null, percentages: null },
    };
  }

  if (matchBatch.ok === false) {
    return {
      ...base,
      quality: "unsafe",
      match: {
        quality: "match_query_error",
        metrics: null,
        durationSeconds: null,
      },
      total: { metrics: null, percentages: null },
    };
  }

  const classified = matchBatch.byPlayerName.get(
    training.frozen.powerBiPlayerName
  );
  if (!classified) {
    return {
      ...base,
      quality: "unsafe",
      match: {
        quality: "data_issue",
        metrics: null,
        durationSeconds: null,
      },
      total: { metrics: null, percentages: null },
    };
  }

  if (!isMatchSafe(classified.quality) || classified.metrics == null) {
    return {
      ...base,
      quality: "unsafe",
      match: {
        quality: classified.quality,
        metrics: null,
        durationSeconds: null,
      },
      total: { metrics: null, percentages: null },
    };
  }

  const matchMetrics = matchAbsolutes(classified.metrics);
  const durationSeconds = classified.metrics.durationSeconds;
  const matchBlock = {
    quality: classified.quality,
    metrics: matchMetrics,
    durationSeconds,
  };

  if (trainingMetrics == null || matchMetrics == null) {
    return {
      ...base,
      quality: "unsafe",
      match: matchBlock,
      total: { metrics: null, percentages: null },
    };
  }

  const totalMetrics = addAbsoluteMetrics(trainingMetrics, matchMetrics);
  const quality: TotalLoadQuality =
    training.actualCompleteness === "complete" ? "complete" : "partial";

  return {
    ...base,
    quality,
    match: matchBlock,
    total: {
      metrics: totalMetrics,
      percentages: percentagesFromTotal(totalMetrics, training.frozen),
    },
  };
}

export function composeTotalLoadResult(input: {
  week: TotalLoadResult["week"];
  officialMatch: PlannerWeekOfficialMatch | null;
  trainingRows: PlannerWeeklyProgressResult[];
  matchBatch: TotalLoadMatchBatchInput;
}): TotalLoadResult {
  const rows = input.trainingRows.map((row) =>
    composePlayerRow(row, input.matchBatch)
  );
  return {
    week: input.week,
    officialMatch: officialMatchView(input.officialMatch),
    weeklyPlanSummary: buildPctSummary({
      td: input.trainingRows.map((r) => r.weeklyPct.tdPct),
      hsr: input.trainingRows.map((r) => r.weeklyPct.hsrPct),
      sprint: input.trainingRows.map((r) => r.weeklyPct.sprintPct),
      acc: input.trainingRows.map((r) => r.weeklyPct.accPct),
      dec: input.trainingRows.map((r) => r.weeklyPct.decPct),
    }),
    rows,
    topValues:
      rows.length === 0 ? EMPTY_TOP_VALUES : computeTotalLoadTopValues(rows),
  };
}

