/**
 * Pure Total Load composition (Training Actual + safe Match Actual).
 * No I/O. No rounding. No persistence. No UI strings.
 *
 * Phase E: 0–2 configured official Matches. Configured rows are the source of
 * truth. Pending source ≠ match_zero. Final Total is all-or-nothing.
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
  | "match_not_selected"
  | "match_data_pending";

export type TotalLoadMatchQuality =
  | MatchActualQuality
  | "match_query_error"
  | "match_not_selected"
  | "match_data_pending";

export type TotalLoadPercentages = {
  totalDistance: number | null;
  hsr: number | null;
  sprint: number | null;
  accelerations: number | null;
  decelerations: number | null;
};

export type TotalLoadPlayerMatch = {
  matchId: string;
  matchOrder: 1 | 2;
  gpsDate: string;
  state: TotalLoadMatchQuality;
  metrics: AbsoluteMetrics | null;
  durationSeconds: number | null;
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
  matches: TotalLoadPlayerMatch[];
  /**
   * Phase E compatibility for the current 1-match Total Load UI.
   * One match: same as that Match component.
   * Two matches: combined only when every configured Match is safe;
   * otherwise quality/metrics/duration reflect that Final Total is unavailable.
   */
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

export type TotalLoadMatchSourceStatus = "available" | "pending" | "query_error";

export type TotalLoadOfficialMatchItem = {
  matchId: string;
  matchOrder: 1 | 2;
  gpsDate: string;
  mdTag: string;
  opponent: string | null;
  matchday: string | null;
  competition: string | null;
  /** Null when Total Load did not run a source gate (no Weekly Target players). */
  sourceStatus: TotalLoadMatchSourceStatus | null;
};

export type TotalLoadResult = {
  week: {
    id: string;
    powerbiWeekId: string;
    startDate: string;
    endDate: string;
  };
  /** Compatibility: first configured Match, or unselected when none. */
  officialMatch: TotalLoadOfficialMatchView;
  officialMatches: TotalLoadOfficialMatchItem[];
  weeklyPlanSummary: DailyPlanPctSummary;
  rows: TotalLoadPlayerRow[];
  topValues: TotalLoadTopValues;
};

export type TotalLoadMatchBatchInput =
  | { ok: true; byPlayerName: Map<string, MatchActualPlayerResult> }
  | { ok: false }
  | null;

export type TotalLoadMatchSource = {
  officialMatch: PlannerWeekOfficialMatch;
  availability: "available" | "pending" | "query_error";
  matchBatch: TotalLoadMatchBatchInput;
};

const EMPTY_TOP_VALUES: TotalLoadTopValues = {
  totalDistance: null,
  hsr: null,
  sprint: null,
  accelerations: null,
  decelerations: null,
};

const ZERO_METRICS: AbsoluteMetrics = {
  totalDistance: 0,
  hsr: 0,
  sprint: 0,
  accelerations: 0,
  decelerations: 0,
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

function isPlayerMatchSafe(state: TotalLoadMatchQuality): boolean {
  return state === "match_ok" || state === "match_zero";
}

function pickTopValue(
  rows: TotalLoadPlayerRow[],
  metric: keyof AbsoluteMetrics
): TotalLoadTopValue {
  const eligible = rows.filter(
    (row) =>
      (row.quality === "complete" || row.quality === "partial") &&
      row.total.metrics != null
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

export function officialMatchItems(
  matches: PlannerWeekOfficialMatch[],
  matchSources: TotalLoadMatchSource[] = []
): TotalLoadOfficialMatchItem[] {
  return matches.map((match) => {
    const source = matchSources.find(
      (item) => item.officialMatch.id === match.id
    );
    return {
      matchId: match.id,
      matchOrder: match.matchOrder,
      gpsDate: match.gpsDate,
      mdTag: match.mdTag,
      opponent: match.opponent,
      matchday: match.matchday,
      competition: match.competition,
      sourceStatus: source ? source.availability : null,
    };
  });
}

function sourceForConfiguredMatch(
  match: PlannerWeekOfficialMatch,
  sources: TotalLoadMatchSource[]
): TotalLoadMatchSource {
  const found = sources.find((source) => source.officialMatch.id === match.id);
  if (found) return found;
  return {
    officialMatch: match,
    availability: "query_error",
    matchBatch: { ok: false },
  };
}

function composePlayerMatch(
  training: PlannerWeeklyProgressResult,
  source: TotalLoadMatchSource
): TotalLoadPlayerMatch {
  const base = {
    matchId: source.officialMatch.id,
    matchOrder: source.officialMatch.matchOrder,
    gpsDate: source.officialMatch.gpsDate,
  };

  if (source.availability === "pending") {
    return {
      ...base,
      state: "match_data_pending",
      metrics: null,
      durationSeconds: null,
    };
  }

  if (
    source.availability === "query_error" ||
    source.matchBatch == null ||
    source.matchBatch.ok === false
  ) {
    return {
      ...base,
      state: "match_query_error",
      metrics: null,
      durationSeconds: null,
    };
  }

  const classified = source.matchBatch.byPlayerName.get(
    training.frozen.powerBiPlayerName
  );
  if (!classified) {
    return {
      ...base,
      state: "data_issue",
      metrics: null,
      durationSeconds: null,
    };
  }

  if (!isMatchSafe(classified.quality) || classified.metrics == null) {
    return {
      ...base,
      state: classified.quality,
      metrics: null,
      durationSeconds: null,
    };
  }

  return {
    ...base,
    state: classified.quality,
    metrics: matchAbsolutes(classified.metrics),
    durationSeconds: classified.metrics.durationSeconds,
  };
}

function aggregateCompatibilityMatch(
  matches: TotalLoadPlayerMatch[]
): TotalLoadPlayerRow["match"] {
  if (matches.length === 0) {
    return {
      quality: "match_not_selected",
      metrics: null,
      durationSeconds: null,
    };
  }

  if (matches.some((match) => match.state === "match_query_error")) {
    return {
      quality: "match_query_error",
      metrics: null,
      durationSeconds: null,
    };
  }
  if (matches.some((match) => match.state === "match_data_pending")) {
    return {
      quality: "match_data_pending",
      metrics: null,
      durationSeconds: null,
    };
  }
  if (matches.some((match) => match.state === "match_ambiguous")) {
    return {
      quality: "match_ambiguous",
      metrics: null,
      durationSeconds: null,
    };
  }
  if (matches.some((match) => match.state === "data_issue")) {
    return {
      quality: "data_issue",
      metrics: null,
      durationSeconds: null,
    };
  }
  if (!matches.every((match) => isPlayerMatchSafe(match.state))) {
    return {
      quality: "data_issue",
      metrics: null,
      durationSeconds: null,
    };
  }

  const metrics = matches.reduce(
    (sum, match) => addAbsoluteMetrics(sum, match.metrics ?? ZERO_METRICS),
    ZERO_METRICS
  );
  const durationSeconds = matches.every((match) => match.durationSeconds != null)
    ? matches.reduce((sum, match) => sum + (match.durationSeconds ?? 0), 0)
    : null;
  const quality: TotalLoadMatchQuality = matches.every(
    (match) => match.state === "match_zero"
  )
    ? "match_zero"
    : "match_ok";

  return { quality, metrics, durationSeconds };
}

function composePlayerRow(
  training: PlannerWeeklyProgressResult,
  officialMatches: PlannerWeekOfficialMatch[],
  matchSources: TotalLoadMatchSource[]
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

  if (officialMatches.length === 0) {
    return {
      ...base,
      quality: "match_not_selected",
      matches: [],
      match: {
        quality: "match_not_selected",
        metrics: null,
        durationSeconds: null,
      },
      total: { metrics: null, percentages: null },
    };
  }

  const matches = officialMatches.map((match) =>
    composePlayerMatch(training, sourceForConfiguredMatch(match, matchSources))
  );
  const match = aggregateCompatibilityMatch(matches);
  const hasPending = matches.some(
    (item) => item.state === "match_data_pending"
  );
  const hasUnsafeMatch = matches.some(
    (item) =>
      item.state !== "match_data_pending" && !isPlayerMatchSafe(item.state)
  );

  if (hasUnsafeMatch) {
    return {
      ...base,
      quality: "unsafe",
      matches,
      match,
      total: { metrics: null, percentages: null },
    };
  }

  if (hasPending) {
    return {
      ...base,
      quality: "match_data_pending",
      matches,
      match,
      total: { metrics: null, percentages: null },
    };
  }

  const matchMetrics = matches.reduce(
    (sum, item) => addAbsoluteMetrics(sum, item.metrics ?? ZERO_METRICS),
    ZERO_METRICS
  );

  if (trainingMetrics == null) {
    return {
      ...base,
      quality: "unsafe",
      matches,
      match,
      total: { metrics: null, percentages: null },
    };
  }

  const totalMetrics = addAbsoluteMetrics(trainingMetrics, matchMetrics);
  const quality: TotalLoadQuality =
    training.actualCompleteness === "complete" ? "complete" : "partial";

  return {
    ...base,
    quality,
    matches,
    match,
    total: {
      metrics: totalMetrics,
      percentages: percentagesFromTotal(totalMetrics, training.frozen),
    },
  };
}

export function composeTotalLoadResult(input: {
  week: TotalLoadResult["week"];
  officialMatches: PlannerWeekOfficialMatch[];
  trainingRows: PlannerWeeklyProgressResult[];
  matchSources: TotalLoadMatchSource[];
}): TotalLoadResult {
  const rows = input.trainingRows.map((row) =>
    composePlayerRow(row, input.officialMatches, input.matchSources)
  );
  return {
    week: input.week,
    officialMatch: officialMatchView(input.officialMatches[0] ?? null),
    officialMatches: officialMatchItems(
      input.officialMatches,
      input.matchSources
    ),
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
