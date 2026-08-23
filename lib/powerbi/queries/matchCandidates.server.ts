import "server-only";

/**
 * Read-only Team match GPS date candidates for official-match selection.
 * Does not return Match Actual metrics. Does not persist. Does not auto-select.
 */

import { executePowerBiDaxQuery } from "@/lib/powerbi/client.server";
import { logPowerBiError } from "@/lib/powerbi/errors";
import type { PowerBiErrorCode } from "@/lib/powerbi/types";
import {
  MATCH_ACTUAL_DRILL_ALLOWLIST,
  MATCH_ACTUAL_MD_TAG,
  MATCH_ACTUAL_SESSION_TYPE,
} from "@/lib/powerbi/queries/matchActualClassify";
import {
  escapeDaxString,
  firstResultRows,
  parseIsoDateParts,
  pickRowValue,
} from "@/lib/powerbi/queries/rowUtils";

export type MatchCandidate = {
  gpsDate: string;
  rawRowCount: number;
  distinctPlayerCount: number;
};

export type MatchCandidatesErrorCode = PowerBiErrorCode | "invalid_input";

export type MatchCandidatesSafeError = {
  code: MatchCandidatesErrorCode;
  message: string;
};

export type GetMatchCandidateDatesResult =
  | { ok: true; candidates: MatchCandidate[] }
  | { ok: false; error: MatchCandidatesSafeError };

function requireNonEmpty(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Parse a GPS_Log[Date] Execute Queries cell to YYYY-MM-DD. Invalid → null. */
export function parseCandidateGpsDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getUTCFullYear();
    const month = value.getUTCMonth() + 1;
    const day = value.getUTCDate();
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  if (typeof value === "string") {
    const parts = parseIsoDateParts(value);
    if (!parts) return null;
    return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  }
  return null;
}

/**
 * Distinct Team MD allowlisted-segment dates for one Power BI Week ID.
 * Raw Player + Date rows only — counts are aggregated in JS, not DAX.
 */
export function buildMatchCandidateDatesDax(weekId: string): string {
  const escapedWeekId = escapeDaxString(weekId);
  const mdTag = escapeDaxString(MATCH_ACTUAL_MD_TAG);
  const sessionType = escapeDaxString(MATCH_ACTUAL_SESSION_TYPE);
  const drillList = MATCH_ACTUAL_DRILL_ALLOWLIST.map(
    (drill) => `"${escapeDaxString(drill)}"`
  ).join(", ");

  return `EVALUATE
SELECTCOLUMNS(
  FILTER(
    GPS_Log,
    GPS_Log[Week ID] = "${escapedWeekId}"
      && GPS_Log[MD_Tag] = "${mdTag}"
      && GPS_Log[SessionType] = "${sessionType}"
      && GPS_Log[Drill] IN {${drillList}}
  ),
  "Player", GPS_Log[Player],
  "Date", GPS_Log[Date]
)`;
}

export function aggregateMatchCandidates(
  rows: Record<string, unknown>[]
): MatchCandidate[] {
  const byDate = new Map<
    string,
    { rawRowCount: number; players: Set<string> }
  >();

  for (const row of rows) {
    const gpsDate = parseCandidateGpsDate(pickRowValue(row, "Date"));
    if (!gpsDate) continue;
    let bucket = byDate.get(gpsDate);
    if (!bucket) {
      bucket = { rawRowCount: 0, players: new Set() };
      byDate.set(gpsDate, bucket);
    }
    bucket.rawRowCount += 1;
    const player = pickRowValue(row, "Player");
    if (typeof player === "string" && player.length > 0) {
      bucket.players.add(player);
    }
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([gpsDate, bucket]) => ({
      gpsDate,
      rawRowCount: bucket.rawRowCount,
      distinctPlayerCount: bucket.players.size,
    }));
}

/**
 * Distinct GPS Team match dates for one Power BI Week ID.
 * One Execute Queries call. No metrics. No SourceFile identity. No write.
 */
export async function getMatchCandidateDates(input: {
  weekId: string;
}): Promise<GetMatchCandidateDatesResult> {
  const weekId = requireNonEmpty(input.weekId ?? "");
  if (!weekId) {
    const error: MatchCandidatesSafeError = {
      code: "invalid_input",
      message: "weekId is required.",
    };
    logPowerBiError("matchCandidates", error);
    return { ok: false, error };
  }

  const result = await executePowerBiDaxQuery(buildMatchCandidateDatesDax(weekId));
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    candidates: aggregateMatchCandidates(firstResultRows(result.results)),
  };
}
