import "server-only";

import { executePowerBiDaxQuery } from "@/lib/powerbi/client.server";
import { logPowerBiError } from "@/lib/powerbi/errors";
import type { PowerBiErrorCode } from "@/lib/powerbi/types";
import {
  escapeDaxString,
  firstResultRows,
  pickRowValue,
  toNullableNumber,
} from "@/lib/powerbi/queries/rowUtils";

export const MATCH_BEST_METHOD = "single-match best";

export type MatchBestGps = {
  tdBest: number | null;
  hsrBest: number | null;
  sprintBest: number | null;
  accBest: number | null;
  decBest: number | null;
};

export type GetMatchBestGpsInput = {
  playerName: string;
};

export type MatchBestGpsErrorCode =
  | PowerBiErrorCode
  | "not_found"
  | "ambiguous"
  | "invalid_input";

export type MatchBestGpsSafeError = {
  code: MatchBestGpsErrorCode;
  message: string;
};

export type GetMatchBestGpsResult =
  | { ok: true; data: MatchBestGps }
  | { ok: false; error: MatchBestGpsSafeError };

function requireNonEmpty(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapMatchBestRow(row: Record<string, unknown>): MatchBestGps {
  return {
    tdBest: toNullableNumber(pickRowValue(row, "Max TD")),
    hsrBest: toNullableNumber(pickRowValue(row, "Max Z5")),
    sprintBest: toNullableNumber(pickRowValue(row, "Max Z6")),
    accBest: toNullableNumber(pickRowValue(row, "Max Acc")),
    decBest: toNullableNumber(pickRowValue(row, "Max Dec")),
  };
}

function buildMatchBestDax(playerName: string): string {
  const player = escapeDaxString(playerName);
  const method = escapeDaxString(MATCH_BEST_METHOD);

  return `EVALUATE
SELECTCOLUMNS(
  FILTER(
    Match_Benchmark,
    Match_Benchmark[Player] = "${player}"
      && Match_Benchmark[Method] = "${method}"
  ),
  "Max TD", Match_Benchmark[Max TD],
  "Max Z5", Match_Benchmark[Max Z5],
  "Max Z6", Match_Benchmark[Max Z6],
  "Max Acc", Match_Benchmark[Max Acc],
  "Max Dec", Match_Benchmark[Max Dec]
)`;
}

/**
 * Individual 1-Match-Best GPS references from Match_Benchmark.
 * Does not recalculate bests in ST-AMS. Ambiguous when multiple rows match.
 */
export async function getMatchBestGps(
  input: GetMatchBestGpsInput
): Promise<GetMatchBestGpsResult> {
  const playerName = requireNonEmpty(input.playerName ?? "");
  if (!playerName) {
    const error: MatchBestGpsSafeError = {
      code: "invalid_input",
      message: "playerName is required.",
    };
    logPowerBiError("matchBest", error);
    return { ok: false, error };
  }

  const result = await executePowerBiDaxQuery(buildMatchBestDax(playerName));
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const rows = firstResultRows(result.results);
  if (rows.length === 0) {
    const error: MatchBestGpsSafeError = {
      code: "not_found",
      message:
        "No single-match best row matched the given player in Match_Benchmark.",
    };
    logPowerBiError("matchBest", error);
    return { ok: false, error };
  }

  if (rows.length > 1) {
    const error: MatchBestGpsSafeError = {
      code: "ambiguous",
      message:
        "Multiple single-match best rows matched the same player; resolve duplicates in the semantic model.",
    };
    logPowerBiError("matchBest", error, { rowCount: rows.length });
    return { ok: false, error };
  }

  return { ok: true, data: mapMatchBestRow(rows[0]) };
}
