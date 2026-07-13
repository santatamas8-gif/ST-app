import { sessionLoad } from "@/utils/load";
import { formatAggregatedMatchdayTag, formatAggregatedSessionType } from "@/lib/sessionDisplay";
import type { SessionRow } from "@/lib/types";

export const PLAYER_SESSION_HISTORY_LIMITS = [5, 10, 20] as const;
export type PlayerSessionHistoryLimit = (typeof PLAYER_SESSION_HISTORY_LIMITS)[number];

export const PLAYER_SESSION_HISTORY_ALL_MATCHDAYS = "All Matchdays";
export const PLAYER_SESSION_HISTORY_NO_TAG = "No tag";
export const PLAYER_SESSION_HISTORY_ALL_SESSION_TYPES = "All Session Types";

export type PlayerSessionHistoryMatchdayFilter = string;
export type PlayerSessionHistorySessionTypeFilter = string;

export type PlayerSessionHistoryEntry = {
  date: string;
  sessionType: string | null;
  matchdayTag: string | null;
  rpe: number | null;
  duration: number | null;
  load: number;
  createdAt?: string;
};

export type PlayerSessionHistoryDay = {
  date: string;
  sessionCount: number;
  averageRpe: number | null;
  totalDuration: number;
  totalLoad: number;
  sessionTypeLabel: string;
  matchdayTagLabel: string;
  sessions: PlayerSessionHistoryEntry[];
};

export type PlayerSessionHistorySummary = {
  daysShown: number;
  latestLoad: number | null;
  latestDate: string | null;
  averageDailyLoad: number | null;
  highestDailyLoad: number | null;
  lowestDailyLoad: number | null;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function matchesMatchdayFilter(
  session: SessionRow,
  matchdayFilter: PlayerSessionHistoryMatchdayFilter
): boolean {
  const tag = (session.matchday_tag ?? "").trim();
  if (matchdayFilter === PLAYER_SESSION_HISTORY_ALL_MATCHDAYS) return true;
  if (matchdayFilter === PLAYER_SESSION_HISTORY_NO_TAG) return tag === "";
  return tag === matchdayFilter;
}

function matchesSessionTypeFilter(
  session: SessionRow,
  sessionTypeFilter: PlayerSessionHistorySessionTypeFilter
): boolean {
  const type = (session.session_type ?? "").trim();
  if (sessionTypeFilter === PLAYER_SESSION_HISTORY_ALL_SESSION_TYPES) return true;
  return type === sessionTypeFilter;
}

function getSessionLoad(session: SessionRow): number {
  if (isFiniteNumber(session.load)) return session.load;
  if (isFiniteNumber(session.duration) && isFiniteNumber(session.rpe)) {
    return sessionLoad(session.duration, session.rpe);
  }
  return 0;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildPlayerSessionHistory(
  sessions: SessionRow[],
  options: {
    playerId: string;
    limit: PlayerSessionHistoryLimit;
    matchdayFilter: PlayerSessionHistoryMatchdayFilter;
    sessionTypeFilter: PlayerSessionHistorySessionTypeFilter;
    chartOrder?: "chronological" | "newest-first";
  }
): PlayerSessionHistoryDay[] {
  const filtered = sessions.filter((session) => {
    if (session.user_id !== options.playerId) return false;
    if (!matchesMatchdayFilter(session, options.matchdayFilter)) return false;
    if (!matchesSessionTypeFilter(session, options.sessionTypeFilter)) return false;
    return true;
  });

  const byDate = new Map<string, SessionRow[]>();
  for (const session of filtered) {
    const group = byDate.get(session.date) ?? [];
    group.push(session);
    byDate.set(session.date, group);
  }

  const newestDates = [...byDate.keys()].sort((a, b) => b.localeCompare(a)).slice(0, options.limit);

  const days = newestDates.map((date) => {
    const daySessions = byDate.get(date) ?? [];
    const rpeValues = daySessions.map((session) => session.rpe).filter(isFiniteNumber);
    const totalDuration = daySessions.reduce(
      (sum, session) => sum + (isFiniteNumber(session.duration) ? session.duration : 0),
      0
    );
    const totalLoad = daySessions.reduce((sum, session) => sum + getSessionLoad(session), 0);

    return {
      date,
      sessionCount: daySessions.length,
      averageRpe: mean(rpeValues),
      totalDuration,
      totalLoad,
      sessionTypeLabel: formatAggregatedSessionType(daySessions),
      matchdayTagLabel: formatAggregatedMatchdayTag(daySessions),
      sessions: daySessions
        .slice()
        .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
        .map((session) => ({
          date: session.date,
          sessionType: session.session_type ?? null,
          matchdayTag: session.matchday_tag ?? null,
          rpe: session.rpe,
          duration: isFiniteNumber(session.duration) ? session.duration : null,
          load: getSessionLoad(session),
          createdAt: session.created_at,
        })),
    };
  });

  if (options.chartOrder === "chronological") {
    return days.sort((a, b) => a.date.localeCompare(b.date));
  }

  return days;
}

export function calculatePlayerSessionHistorySummary(
  daysNewestFirst: PlayerSessionHistoryDay[]
): PlayerSessionHistorySummary {
  if (daysNewestFirst.length === 0) {
    return {
      daysShown: 0,
      latestLoad: null,
      latestDate: null,
      averageDailyLoad: null,
      highestDailyLoad: null,
      lowestDailyLoad: null,
    };
  }

  const loads = daysNewestFirst.map((day) => day.totalLoad);
  return {
    daysShown: daysNewestFirst.length,
    latestLoad: daysNewestFirst[0].totalLoad,
    latestDate: daysNewestFirst[0].date,
    averageDailyLoad: loads.reduce((sum, value) => sum + value, 0) / loads.length,
    highestDailyLoad: Math.max(...loads),
    lowestDailyLoad: Math.min(...loads),
  };
}

export function isPlayerSessionHistoryLimit(value: number): value is PlayerSessionHistoryLimit {
  return (PLAYER_SESSION_HISTORY_LIMITS as readonly number[]).includes(value);
}
