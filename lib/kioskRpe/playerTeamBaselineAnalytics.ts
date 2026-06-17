import type { MatchdayFilterOption } from "@/lib/kioskRpe/playerComparisonAnalytics";
import type { SessionTypeFilterOption } from "@/lib/kioskRpe/matchdayAnalytics";
import type { SessionRow } from "@/lib/types";

export const MIN_PLAYER_SESSIONS_FOR_RELIABLE = 3;
export const MIN_TEAM_SESSIONS_FOR_RELIABLE = 3;
export const MIN_TEAM_PLAYERS_FOR_RELIABLE = 2;
export const TEAM_SIMILARITY_THRESHOLD_PERCENT = 5;

export type TeamBaselineMetrics = {
  sessionCount: number;
  uniquePlayerCount: number;
  averageRpe: number | null;
  averageDuration: number | null;
  averageLoad: number | null;
  totalLoad: number;
};

export type PlayerTeamDeviation = {
  absoluteDifference: number | null;
  percentageDifference: number | null;
  interpretation: "higher" | "lower" | "similar" | "insufficient";
};

export type PlayerTeamBaselineResult = {
  player: TeamBaselineMetrics;
  team: TeamBaselineMetrics;
  deviations: {
    averageRpe: PlayerTeamDeviation;
    averageDuration: PlayerTeamDeviation;
    averageLoad: PlayerTeamDeviation;
  };
  limitedData: boolean;
  hasAnySessions: boolean;
};

export type PlayerTeamChartMetric = "averageLoad" | "averageRpe" | "averageDuration";

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

export function filterPlayerTeamBaselineSessions(
  sessions: SessionRow[],
  options: {
    from: string;
    to: string;
    matchdayTag: MatchdayFilterOption;
    sessionType: SessionTypeFilterOption;
    validPlayerIds: Set<string>;
  }
): SessionRow[] {
  return sessions.filter((session) => {
    if (session.date < options.from || session.date > options.to) return false;
    if (!options.validPlayerIds.has(session.user_id)) return false;
    if (!sessionMatchesMatchdayFilter(session, options.matchdayTag)) return false;
    if (!sessionMatchesSessionTypeFilter(session, options.sessionType)) return false;
    return true;
  });
}

export function splitSelectedPlayerAndTeamSessions(
  sessions: SessionRow[],
  selectedPlayerId: string
): { playerSessions: SessionRow[]; teamSessions: SessionRow[] } {
  const playerSessions: SessionRow[] = [];
  const teamSessions: SessionRow[] = [];

  for (const session of sessions) {
    if (session.user_id === selectedPlayerId) {
      playerSessions.push(session);
    } else {
      teamSessions.push(session);
    }
  }

  return { playerSessions, teamSessions };
}

export function calculateTeamBaselineMetrics(sessions: SessionRow[]): TeamBaselineMetrics {
  const rpeValues = sessions.map((s) => s.rpe).filter(isFiniteNumber);
  const durationValues = sessions.map((s) => s.duration).filter(isFiniteNumber);
  const loadValues = sessions.map((s) => s.load).filter(isFiniteNumber);
  const uniquePlayers = new Set(sessions.map((s) => s.user_id));

  return {
    sessionCount: sessions.length,
    uniquePlayerCount: uniquePlayers.size,
    averageRpe: mean(rpeValues),
    averageDuration: mean(durationValues),
    averageLoad: mean(loadValues),
    totalLoad: sessions.reduce(
      (sum, s) => sum + (isFiniteNumber(s.load) ? s.load : 0),
      0
    ),
  };
}

export function calculatePlayerTeamDeviation(
  playerAverage: number | null,
  teamAverage: number | null,
  limitedData: boolean
): PlayerTeamDeviation {
  if (limitedData || playerAverage == null || teamAverage == null) {
    return {
      absoluteDifference: null,
      percentageDifference: null,
      interpretation: "insufficient",
    };
  }

  const absoluteDifference = playerAverage - teamAverage;

  if (teamAverage === 0) {
    return {
      absoluteDifference,
      percentageDifference: null,
      interpretation: "insufficient",
    };
  }

  const percentageDifference = (absoluteDifference / teamAverage) * 100;
  let interpretation: PlayerTeamDeviation["interpretation"] = "similar";
  if (percentageDifference > TEAM_SIMILARITY_THRESHOLD_PERCENT) {
    interpretation = "higher";
  } else if (percentageDifference < -TEAM_SIMILARITY_THRESHOLD_PERCENT) {
    interpretation = "lower";
  }

  return {
    absoluteDifference,
    percentageDifference,
    interpretation,
  };
}

function isLimitedData(
  player: TeamBaselineMetrics,
  team: TeamBaselineMetrics
): boolean {
  return (
    player.sessionCount < MIN_PLAYER_SESSIONS_FOR_RELIABLE ||
    team.sessionCount < MIN_TEAM_SESSIONS_FOR_RELIABLE ||
    team.uniquePlayerCount < MIN_TEAM_PLAYERS_FOR_RELIABLE
  );
}

export function buildPlayerTeamBaselineResult(
  sessions: SessionRow[],
  options: {
    selectedPlayerId: string;
    from: string;
    to: string;
    matchdayTag: MatchdayFilterOption;
    sessionType: SessionTypeFilterOption;
    validPlayerIds: string[];
  }
): PlayerTeamBaselineResult {
  const playerIdSet = new Set(options.validPlayerIds);
  const filtered = filterPlayerTeamBaselineSessions(sessions, {
    from: options.from,
    to: options.to,
    matchdayTag: options.matchdayTag,
    sessionType: options.sessionType,
    validPlayerIds: playerIdSet,
  });

  const { playerSessions, teamSessions } = splitSelectedPlayerAndTeamSessions(
    filtered,
    options.selectedPlayerId
  );

  const player = calculateTeamBaselineMetrics(playerSessions);
  const team = calculateTeamBaselineMetrics(teamSessions);
  const limitedData = isLimitedData(player, team);

  return {
    player,
    team,
    deviations: {
      averageRpe: calculatePlayerTeamDeviation(
        player.averageRpe,
        team.averageRpe,
        limitedData
      ),
      averageDuration: calculatePlayerTeamDeviation(
        player.averageDuration,
        team.averageDuration,
        limitedData
      ),
      averageLoad: calculatePlayerTeamDeviation(
        player.averageLoad,
        team.averageLoad,
        limitedData
      ),
    },
    limitedData,
    hasAnySessions: player.sessionCount > 0 || team.sessionCount > 0,
  };
}

export function teamInterpretationLabel(
  interpretation: PlayerTeamDeviation["interpretation"]
): string {
  switch (interpretation) {
    case "higher":
      return "Higher than team average";
    case "lower":
      return "Lower than team average";
    case "similar":
      return "Similar to team average";
    case "insufficient":
      return "Insufficient data";
  }
}

export function chartPlayerMetricValue(
  result: PlayerTeamBaselineResult,
  metric: PlayerTeamChartMetric
): number | null {
  switch (metric) {
    case "averageLoad":
      return result.player.averageLoad;
    case "averageRpe":
      return result.player.averageRpe;
    case "averageDuration":
      return result.player.averageDuration;
  }
}

export function chartTeamMetricValue(
  result: PlayerTeamBaselineResult,
  metric: PlayerTeamChartMetric
): number | null {
  switch (metric) {
    case "averageLoad":
      return result.team.averageLoad;
    case "averageRpe":
      return result.team.averageRpe;
    case "averageDuration":
      return result.team.averageDuration;
  }
}

export function chartMetricTitle(metric: PlayerTeamChartMetric): string {
  switch (metric) {
    case "averageLoad":
      return "Avg Load (AU)";
    case "averageRpe":
      return "Avg RPE";
    case "averageDuration":
      return "Avg Duration (min)";
  }
}
