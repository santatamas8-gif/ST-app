import type { SessionRow } from "@/lib/types";

export type AnalyticsPlayer = {
  id: string;
  name: string;
};

export type AnalyticsRangeRequest = {
  from: string;
  to: string;
};

export type AnalyticsRangeResult = {
  sessions: SessionRow[];
  players: AnalyticsPlayer[];
  displayNameByUserId: Record<string, string>;
};

/** Stable fallbacks so optional analytics data does not create new [] each render. */
export const EMPTY_ANALYTICS_SESSIONS: SessionRow[] = [];
export const EMPTY_ANALYTICS_PLAYERS: AnalyticsPlayer[] = [];
export const EMPTY_ANALYTICS_DISPLAY_NAMES: Record<string, string> = {};

export function analyticsRangeCacheKey(from: string, to: string): string {
  return `${from}|${to}`;
}

/** Shallow copy so cached session rows are not mutated by consumers. */
export function freezeAnalyticsRangeResult(data: AnalyticsRangeResult): AnalyticsRangeResult {
  return {
    sessions: data.sessions.map((session) => ({ ...session })),
    players: data.players.map((player) => ({ ...player })),
    displayNameByUserId: { ...data.displayNameByUserId },
  };
}

export async function fetchAnalyticsRange(
  from: string,
  to: string
): Promise<AnalyticsRangeResult> {
  const res = await fetch(
    `/api/rpe/matchday-analysis?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { cache: "no-store" }
  );
  const json = (await res.json()) as Partial<AnalyticsRangeResult> & { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `Request failed (${res.status})`);
  }
  return {
    sessions: json.sessions ?? [],
    players: json.players ?? [],
    displayNameByUserId: json.displayNameByUserId ?? {},
  };
}
