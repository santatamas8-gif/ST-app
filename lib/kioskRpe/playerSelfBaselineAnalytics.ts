import { getLocalDateString } from "@/lib/kioskRpe/localDate";
import type { MatchdayFilterOption } from "@/lib/kioskRpe/playerComparisonAnalytics";
import type { SessionTypeFilterOption } from "@/lib/kioskRpe/matchdayAnalytics";
import type { SessionRow } from "@/lib/types";

export const RECENT_PERIOD_OPTIONS = [7, 14, 28] as const;
export const BASELINE_PERIOD_OPTIONS = [28, 56, 84] as const;

export type RecentPeriodDays = (typeof RECENT_PERIOD_OPTIONS)[number];
export type BaselinePeriodDays = (typeof BASELINE_PERIOD_OPTIONS)[number];

export const MIN_SESSIONS_FOR_RELIABLE = 3;
export const SIMILARITY_THRESHOLD_PERCENT = 5;

export type BaselinePeriodKey = "recent" | "baseline";

export type PeriodMetrics = {
  sessionCount: number;
  averageRpe: number | null;
  averageDuration: number | null;
  averageLoad: number | null;
  totalLoad: number;
};

export type MetricDeviation = {
  absoluteDifference: number | null;
  percentageDifference: number | null;
  interpretation: "higher" | "lower" | "similar" | "insufficient";
};

export type SelfBaselineDateRanges = {
  recentStart: string;
  recentEnd: string;
  baselineStart: string;
  baselineEnd: string;
  combinedFrom: string;
  combinedTo: string;
  recentDayCount: number;
  baselineDayCount: number;
};

export type PlayerSelfBaselineResult = {
  ranges: SelfBaselineDateRanges;
  recent: PeriodMetrics;
  baseline: PeriodMetrics;
  deviations: {
    averageRpe: MetricDeviation;
    averageDuration: MetricDeviation;
    averageLoad: MetricDeviation;
  };
  limitedData: boolean;
  hasAnySessions: boolean;
};

function parseLocalDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addLocalDays(iso: string, days: number): string {
  const date = parseLocalDate(iso);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

export function calculateSelfBaselineDateRanges(
  todayLocal: string,
  recentDays: RecentPeriodDays,
  baselineDays: BaselinePeriodDays
): SelfBaselineDateRanges {
  const recentEnd = todayLocal;
  const recentStart = addLocalDays(recentEnd, -(recentDays - 1));
  const baselineEnd = addLocalDays(recentStart, -1);
  const baselineStart = addLocalDays(baselineEnd, -(baselineDays - 1));

  return {
    recentStart,
    recentEnd,
    baselineStart,
    baselineEnd,
    combinedFrom: baselineStart,
    combinedTo: recentEnd,
    recentDayCount: recentDays,
    baselineDayCount: baselineDays,
  };
}

export function getDefaultSelfBaselineRanges(
  today: Date = new Date()
): SelfBaselineDateRanges {
  return calculateSelfBaselineDateRanges(getLocalDateString(today), 7, 28);
}

export function classifySessionPeriod(
  sessionDate: string,
  ranges: SelfBaselineDateRanges
): BaselinePeriodKey | "outside" {
  if (sessionDate >= ranges.recentStart && sessionDate <= ranges.recentEnd) {
    return "recent";
  }
  if (sessionDate >= ranges.baselineStart && sessionDate <= ranges.baselineEnd) {
    return "baseline";
  }
  return "outside";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sessionMatchesMatchdayFilter(
  session: SessionRow,
  matchdayTag: MatchdayFilterOption
): boolean {
  if (matchdayTag === "All matchday tags") return true;
  if (matchdayTag === "No tag") {
    return (session.matchday_tag ?? "").trim() === "";
  }
  return (session.matchday_tag ?? "").trim() === matchdayTag;
}

function sessionMatchesSessionTypeFilter(
  session: SessionRow,
  sessionType: SessionTypeFilterOption
): boolean {
  if (sessionType === "All session types") return true;
  return (session.session_type ?? "").trim() === sessionType;
}

export function filterPlayerBaselineSessions(
  sessions: SessionRow[],
  options: {
    playerId: string;
    ranges: SelfBaselineDateRanges;
    matchdayTag: MatchdayFilterOption;
    sessionType: SessionTypeFilterOption;
  }
): { recent: SessionRow[]; baseline: SessionRow[] } {
  const recent: SessionRow[] = [];
  const baseline: SessionRow[] = [];

  for (const session of sessions) {
    if (session.user_id !== options.playerId) continue;
    if (!sessionMatchesMatchdayFilter(session, options.matchdayTag)) continue;
    if (!sessionMatchesSessionTypeFilter(session, options.sessionType)) continue;

    const period = classifySessionPeriod(session.date, options.ranges);
    if (period === "recent") recent.push(session);
    else if (period === "baseline") baseline.push(session);
  }

  return { recent, baseline };
}

export function calculatePeriodMetrics(sessions: SessionRow[]): PeriodMetrics {
  const rpeValues = sessions.map((s) => s.rpe).filter(isFiniteNumber);
  const durationValues = sessions.map((s) => s.duration).filter(isFiniteNumber);
  const loadValues = sessions.map((s) => s.load).filter(isFiniteNumber);

  return {
    sessionCount: sessions.length,
    averageRpe: mean(rpeValues),
    averageDuration: mean(durationValues),
    averageLoad: mean(loadValues),
    totalLoad: sessions.reduce(
      (sum, s) => sum + (isFiniteNumber(s.load) ? s.load : 0),
      0
    ),
  };
}

export function calculateMetricDeviation(
  recentAverage: number | null,
  baselineAverage: number | null,
  limitedData: boolean
): MetricDeviation {
  if (limitedData || recentAverage == null || baselineAverage == null) {
    return {
      absoluteDifference: null,
      percentageDifference: null,
      interpretation: "insufficient",
    };
  }

  const absoluteDifference = recentAverage - baselineAverage;

  if (baselineAverage === 0) {
    return {
      absoluteDifference,
      percentageDifference: null,
      interpretation: "insufficient",
    };
  }

  const percentageDifference = (absoluteDifference / baselineAverage) * 100;
  let interpretation: MetricDeviation["interpretation"] = "similar";
  if (percentageDifference > SIMILARITY_THRESHOLD_PERCENT) {
    interpretation = "higher";
  } else if (percentageDifference < -SIMILARITY_THRESHOLD_PERCENT) {
    interpretation = "lower";
  }

  return {
    absoluteDifference,
    percentageDifference,
    interpretation,
  };
}

export function buildPlayerSelfBaselineResult(
  sessions: SessionRow[],
  options: {
    playerId: string;
    ranges: SelfBaselineDateRanges;
    matchdayTag: MatchdayFilterOption;
    sessionType: SessionTypeFilterOption;
  }
): PlayerSelfBaselineResult {
  const { recent: recentSessions, baseline: baselineSessions } =
    filterPlayerBaselineSessions(sessions, options);

  const recent = calculatePeriodMetrics(recentSessions);
  const baseline = calculatePeriodMetrics(baselineSessions);

  const limitedData =
    recent.sessionCount < MIN_SESSIONS_FOR_RELIABLE ||
    baseline.sessionCount < MIN_SESSIONS_FOR_RELIABLE;

  return {
    ranges: options.ranges,
    recent,
    baseline,
    deviations: {
      averageRpe: calculateMetricDeviation(
        recent.averageRpe,
        baseline.averageRpe,
        limitedData
      ),
      averageDuration: calculateMetricDeviation(
        recent.averageDuration,
        baseline.averageDuration,
        limitedData
      ),
      averageLoad: calculateMetricDeviation(
        recent.averageLoad,
        baseline.averageLoad,
        limitedData
      ),
    },
    limitedData,
    hasAnySessions: recent.sessionCount > 0 || baseline.sessionCount > 0,
  };
}

export function interpretationLabel(
  interpretation: MetricDeviation["interpretation"]
): string {
  switch (interpretation) {
    case "higher":
      return "Higher than baseline";
    case "lower":
      return "Lower than baseline";
    case "similar":
      return "Similar to baseline";
    case "insufficient":
      return "Insufficient data";
  }
}

export type SelfBaselineChartMetric = "averageLoad" | "averageRpe" | "averageDuration";

export function chartMetricRecentValue(
  result: PlayerSelfBaselineResult,
  metric: SelfBaselineChartMetric
): number | null {
  switch (metric) {
    case "averageLoad":
      return result.recent.averageLoad;
    case "averageRpe":
      return result.recent.averageRpe;
    case "averageDuration":
      return result.recent.averageDuration;
  }
}

export function chartMetricBaselineValue(
  result: PlayerSelfBaselineResult,
  metric: SelfBaselineChartMetric
): number | null {
  switch (metric) {
    case "averageLoad":
      return result.baseline.averageLoad;
    case "averageRpe":
      return result.baseline.averageRpe;
    case "averageDuration":
      return result.baseline.averageDuration;
  }
}

export function chartMetricTitle(metric: SelfBaselineChartMetric): string {
  switch (metric) {
    case "averageLoad":
      return "Avg Load (AU)";
    case "averageRpe":
      return "Avg RPE";
    case "averageDuration":
      return "Avg Duration (min)";
  }
}
