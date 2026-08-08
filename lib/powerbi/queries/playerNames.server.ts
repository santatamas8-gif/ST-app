import "server-only";

import { executePowerBiDaxQuery } from "@/lib/powerbi/client.server";
import { logPowerBiError } from "@/lib/powerbi/errors";
import type { PowerBiErrorCode } from "@/lib/powerbi/types";
import { firstResultRows, pickRowValue } from "@/lib/powerbi/queries/rowUtils";
import {
  extractPlayerNamesFromRows,
  mergePowerBiPlayerCandidates,
  type PowerBiPlayerCandidate,
} from "@/lib/powerbi/queries/playerNames";
import { MATCH_BEST_METHOD } from "@/lib/powerbi/queries/matchBest.server";
import { escapeDaxString } from "@/lib/powerbi/queries/rowUtils";

export type { PowerBiPlayerCandidate };

export type GetPowerBiPlayerCandidatesResult =
  | { ok: true; data: PowerBiPlayerCandidate[] }
  | { ok: false; error: { code: PowerBiErrorCode; message: string } };

const GPS_LOG_PLAYERS_DAX = `EVALUATE
DISTINCT(
  SELECTCOLUMNS(
    GPS_Log,
    "Player", GPS_Log[Player]
  )
)`;

function buildMatchBestPlayersDax(): string {
  const method = escapeDaxString(MATCH_BEST_METHOD);
  return `EVALUATE
DISTINCT(
  SELECTCOLUMNS(
    FILTER(
      Match_Benchmark,
      Match_Benchmark[Method] = "${method}"
    ),
    "Player", Match_Benchmark[Player]
  )
)`;
}

/**
 * Distinct Power BI player identities for Admin mapping.
 * Strategy: union of GPS_Log[Player] and Match_Benchmark[Player]
 * (Method = single-match best), with availability flags.
 * Preserves exact Player strings (including internal double spaces).
 */
export async function getPowerBiPlayerCandidates(): Promise<GetPowerBiPlayerCandidatesResult> {
  const [gpsResult, matchResult] = await Promise.all([
    executePowerBiDaxQuery(GPS_LOG_PLAYERS_DAX),
    executePowerBiDaxQuery(buildMatchBestPlayersDax()),
  ]);

  if (!gpsResult.ok) {
    return { ok: false, error: gpsResult.error };
  }
  if (!matchResult.ok) {
    return { ok: false, error: matchResult.error };
  }

  try {
    const gpsNames = extractPlayerNamesFromRows(
      firstResultRows(gpsResult.results),
      pickRowValue
    );
    const matchNames = extractPlayerNamesFromRows(
      firstResultRows(matchResult.results),
      pickRowValue
    );
    const data = mergePowerBiPlayerCandidates(gpsNames, matchNames);
    return { ok: true, data };
  } catch (err) {
    const error = {
      code: "invalid_response" as const,
      message: "Failed to parse Power BI player name candidates.",
    };
    logPowerBiError("playerNames", error, {
      name: err instanceof Error ? err.name : "unknown",
    });
    return { ok: false, error };
  }
}
