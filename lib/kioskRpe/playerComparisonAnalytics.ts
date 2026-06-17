import type { SessionTypeFilterOption } from "@/lib/kioskRpe/matchdayAnalytics";
import type { SessionRow } from "@/lib/types";

export const MIN_COMPARISON_PLAYERS = 2;
export const MAX_COMPARISON_PLAYERS = 4;

export const MATCHDAY_FILTER_OPTIONS = [
  "All matchday tags",
  "MD",
  "MD+1",
  "MD-4",
  "MD-3",
  "MD-2",
  "MD-1",
  "No tag",
] as const;

export type MatchdayFilterOption = (typeof MATCHDAY_FILTER_OPTIONS)[number];

export type PlayerComparisonChartMetric =
  | "averageLoad"
  | "averageRpe"
  | "averageDuration"
  | "totalLoad";

export type PlayerComparisonRow = {
  playerId: string;
  playerName: string;
  sessionCount: number;
  averageRpe: number | null;
  averageDuration: number | null;
  averageLoad: number | null;
  totalLoad: number;
};

/** Stable bar colors by selection order (index 0–3). */
export const PLAYER_COMPARISON_COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#a855f7",
] as const;

export function getPlayerComparisonColor(index: number): string {
  return PLAYER_COMPARISON_COLORS[index % PLAYER_COMPARISON_COLORS.length];
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

export function filterSessionsForPlayerComparison(
  sessions: SessionRow[],
  options: {
    from: string;
    to: string;
    playerIds: string[];
    matchdayTag: MatchdayFilterOption;
    sessionType: SessionTypeFilterOption;
  }
): SessionRow[] {
  const playerSet = new Set(options.playerIds);
  return sessions.filter((session) => {
    if (session.date < options.from || session.date > options.to) return false;
    if (!playerSet.has(session.user_id)) return false;
    if (!sessionMatchesMatchdayFilter(session, options.matchdayTag)) return false;
    if (options.sessionType !== "All session types") {
      const type = (session.session_type ?? "").trim();
      if (type !== options.sessionType) return false;
    }
    return true;
  });
}

export function calculatePlayerComparisonMetrics(
  sessions: SessionRow[]
): Omit<PlayerComparisonRow, "playerId" | "playerName"> {
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

export function buildPlayerComparisonRows(
  sessions: SessionRow[],
  selectedPlayerIds: string[],
  nameByPlayerId: Record<string, string>
): PlayerComparisonRow[] {
  return selectedPlayerIds.map((playerId) => {
    const playerSessions = sessions.filter((s) => s.user_id === playerId);
    const metrics = calculatePlayerComparisonMetrics(playerSessions);
    return {
      playerId,
      playerName: nameByPlayerId[playerId]?.trim() || "Unknown player",
      ...metrics,
    };
  });
}

export function sortRowsBySelectedPlayerOrder(
  rows: PlayerComparisonRow[],
  selectedPlayerIds: string[]
): PlayerComparisonRow[] {
  const order = new Map(selectedPlayerIds.map((id, index) => [id, index]));
  return [...rows].sort(
    (a, b) => (order.get(a.playerId) ?? 999) - (order.get(b.playerId) ?? 999)
  );
}

export function comparisonChartMetricValue(
  row: PlayerComparisonRow,
  metric: PlayerComparisonChartMetric
): number | null {
  switch (metric) {
    case "averageLoad":
      return row.averageLoad;
    case "averageRpe":
      return row.averageRpe;
    case "averageDuration":
      return row.averageDuration;
    case "totalLoad":
      return row.sessionCount > 0 ? row.totalLoad : null;
  }
}

export function comparisonChartMetricLabel(metric: PlayerComparisonChartMetric): string {
  switch (metric) {
    case "averageLoad":
      return "Avg Load (AU)";
    case "averageRpe":
      return "Avg RPE";
    case "averageDuration":
      return "Avg Duration (min)";
    case "totalLoad":
      return "Total Load (AU)";
  }
}

export function playerHasComparisonData(rows: PlayerComparisonRow[]): boolean {
  return rows.some((row) => row.sessionCount > 0);
}
