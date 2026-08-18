import "server-only";

/**
 * ADMIN-bound Total Load Phase 2: Team match GPS Actual batch.
 * Parallel to Full Training Actual. Does not aggregate halves in DAX.
 * Does not combine Match with Training.
 */

import { executePowerBiDaxQuery } from "@/lib/powerbi/client.server";
import { logPowerBiError } from "@/lib/powerbi/errors";
import type { PowerBiErrorCode } from "@/lib/powerbi/types";
import {
  escapeDaxString,
  firstResultRows,
  parseIsoDateParts,
} from "@/lib/powerbi/queries/rowUtils";
import {
  MATCH_ACTUAL_FIRST_HALF,
  MATCH_ACTUAL_MD_TAG,
  MATCH_ACTUAL_SECOND_HALF,
  MATCH_ACTUAL_SESSION_TYPE,
  classifyMatchActualRowsByPlayer,
  type MatchActualPlayerResult,
} from "@/lib/powerbi/queries/matchActualClassify";

export type { MatchActualPlayerResult };

export type GetMatchActualGpsBatchInput = {
  /** Planner Power BI week id, e.g. W5. */
  weekId: string;
  /** Admin-selected official match GPS_Log date, YYYY-MM-DD. */
  gpsDate: string;
  /** Frozen snapshot Power BI player names (exact). */
  playerNames: string[];
};

export type MatchActualGpsErrorCode = PowerBiErrorCode | "invalid_input";

export type MatchActualGpsSafeError = {
  code: MatchActualGpsErrorCode;
  message: string;
};

export type GetMatchActualGpsBatchResult =
  | { ok: true; byPlayerName: Map<string, MatchActualPlayerResult> }
  | { ok: false; error: MatchActualGpsSafeError };

function requireNonEmpty(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Non-aggregating Team match half DAX for many frozen player names.
 * Returns raw GPS_Log rows so the classifier can enforce 0 / 1 / >1 per half.
 */
export function buildMatchActualBatchDax(input: {
  weekId: string;
  playerNames: string[];
  dateParts: { year: number; month: number; day: number };
}): string {
  const weekId = escapeDaxString(input.weekId);
  const mdTag = escapeDaxString(MATCH_ACTUAL_MD_TAG);
  const sessionType = escapeDaxString(MATCH_ACTUAL_SESSION_TYPE);
  const firstHalf = escapeDaxString(MATCH_ACTUAL_FIRST_HALF);
  const secondHalf = escapeDaxString(MATCH_ACTUAL_SECOND_HALF);
  const playerList = input.playerNames
    .map((name) => `"${escapeDaxString(name)}"`)
    .join(", ");

  return `EVALUATE
SELECTCOLUMNS(
  FILTER(
    GPS_Log,
    GPS_Log[Player] IN {${playerList}}
      && GPS_Log[Week ID] = "${weekId}"
      && GPS_Log[Date] = DATE(${input.dateParts.year},${input.dateParts.month},${input.dateParts.day})
      && GPS_Log[MD_Tag] = "${mdTag}"
      && GPS_Log[SessionType] = "${sessionType}"
      && GPS_Log[Drill] IN {"${firstHalf}", "${secondHalf}"}
  ),
  "Player", GPS_Log[Player],
  "Drill", GPS_Log[Drill],
  "TD", GPS_Log[TD],
  "Z5", GPS_Log[Z5],
  "Z6", GPS_Log[Z6],
  "Acc", GPS_Log[Acc],
  "Dec", GPS_Log[Dec],
  "Duration", GPS_Log[Duration]
)`;
}

/**
 * Team match Actual for many frozen player names on ONE official match date.
 * One Execute Queries call. Raw rows only — no SUM/MAX/MIN in DAX.
 */
export async function getMatchActualGpsBatch(
  input: GetMatchActualGpsBatchInput
): Promise<GetMatchActualGpsBatchResult> {
  const weekId = requireNonEmpty(input.weekId ?? "");
  const dateParts = parseIsoDateParts(String(input.gpsDate ?? ""));

  if (!weekId || !dateParts) {
    const error: MatchActualGpsSafeError = {
      code: "invalid_input",
      message: "weekId and gpsDate (YYYY-MM-DD) are required.",
    };
    logPowerBiError("matchActualBatch", error);
    return { ok: false, error };
  }

  const playerNames = [
    ...new Set(
      (input.playerNames ?? []).filter(
        (n): n is string => typeof n === "string" && n.length > 0
      )
    ),
  ];

  if (playerNames.length === 0) {
    return { ok: true, byPlayerName: new Map() };
  }

  const result = await executePowerBiDaxQuery(
    buildMatchActualBatchDax({
      weekId,
      playerNames,
      dateParts,
    })
  );
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const rows = firstResultRows(result.results);
  return {
    ok: true,
    byPlayerName: classifyMatchActualRowsByPlayer(playerNames, rows),
  };
}
