import {
  formatAggregatedMatchdayTag,
  formatAggregatedSessionType,
} from "@/lib/sessionDisplay";
import type { SessionRow } from "@/lib/types";

export type DailyOverviewPlayer = {
  id: string;
  name: string;
};

export type DailyOverviewMetrics = {
  totalPlayers: number;
  submittedPlayers: number;
  missingPlayers: number;
  sessionCount: number;
  averageRpe: number | null;
  averageDuration: number | null;
  totalLoad: number;
};

export type DailyPlayerRow = {
  userId: string;
  playerName: string;
  sessions: SessionRow[];
  sessionCount: number;
  averageRpe: number | null;
  totalDuration: number;
  totalLoad: number;
  sessionTypeLabel: string;
  matchdayTagLabel: string;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function playerNameById(players: DailyOverviewPlayer[]): Record<string, string> {
  const names: Record<string, string> = {};
  for (const player of players) {
    names[player.id] = player.name;
  }
  return names;
}

export function filterDailyPlayerSessions(
  sessions: SessionRow[],
  date: string,
  players: DailyOverviewPlayer[]
): SessionRow[] {
  const playerIds = new Set(players.map((player) => player.id));
  return sessions.filter((session) => session.date === date && playerIds.has(session.user_id));
}

export function calculateDailyOverviewMetrics(
  sessions: SessionRow[],
  date: string,
  players: DailyOverviewPlayer[]
): DailyOverviewMetrics {
  const dailySessions = filterDailyPlayerSessions(sessions, date, players);
  const submittedPlayers = new Set(dailySessions.map((session) => session.user_id)).size;
  const rpeValues = dailySessions.map((session) => session.rpe).filter(isFiniteNumber);
  const durationValues = dailySessions.map((session) => session.duration).filter(isFiniteNumber);
  const totalLoad = dailySessions.reduce(
    (sum, session) => sum + (isFiniteNumber(session.load) ? session.load : 0),
    0
  );

  return {
    totalPlayers: players.length,
    submittedPlayers,
    missingPlayers: Math.max(players.length - submittedPlayers, 0),
    sessionCount: dailySessions.length,
    averageRpe: mean(rpeValues),
    averageDuration: mean(durationValues),
    totalLoad,
  };
}

export function buildDailyPlayerRows(
  sessions: SessionRow[],
  date: string,
  players: DailyOverviewPlayer[]
): DailyPlayerRow[] {
  const names = playerNameById(players);
  const grouped = new Map<string, SessionRow[]>();

  for (const session of filterDailyPlayerSessions(sessions, date, players)) {
    const group = grouped.get(session.user_id) ?? [];
    group.push(session);
    grouped.set(session.user_id, group);
  }

  return [...grouped.entries()]
    .map(([userId, playerSessions]) => {
      const rpeValues = playerSessions.map((session) => session.rpe).filter(isFiniteNumber);
      const totalDuration = playerSessions.reduce(
        (sum, session) => sum + (isFiniteNumber(session.duration) ? session.duration : 0),
        0
      );
      const totalLoad = playerSessions.reduce(
        (sum, session) => sum + (isFiniteNumber(session.load) ? session.load : 0),
        0
      );

      return {
        userId,
        playerName: names[userId] ?? "Unknown player",
        sessions: playerSessions,
        sessionCount: playerSessions.length,
        averageRpe: mean(rpeValues),
        totalDuration,
        totalLoad,
        sessionTypeLabel: formatAggregatedSessionType(playerSessions),
        matchdayTagLabel: formatAggregatedMatchdayTag(playerSessions),
      };
    })
    .sort((a, b) => b.totalLoad - a.totalLoad || a.playerName.localeCompare(b.playerName));
}
