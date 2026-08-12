import "server-only";

import { executePowerBiDaxQuery } from "@/lib/powerbi/client.server";
import { logPowerBiError } from "@/lib/powerbi/errors";
import type { PowerBiErrorCode } from "@/lib/powerbi/types";
import {
  escapeDaxString,
  firstResultRows,
  parseIsoDateParts,
} from "@/lib/powerbi/queries/rowUtils";
import {
  classifyTrainingActualRowsByPlayer,
  mapTrainingActualRow,
  type TrainingActualGpsMetrics,
  type TrainingActualPlayerDayStatus,
} from "@/lib/powerbi/queries/trainingActualClassify";

export const FULL_TRAINING_DRILL = "Full Training";

export type TrainingActualGps = TrainingActualGpsMetrics;

export type GetTrainingActualGpsInput = {
  weekId: string;
  mdTag: string;
  playerName: string;
  /** Optional ISO date `YYYY-MM-DD` to disambiguate. */
  date?: string;
};

export type TrainingActualGpsErrorCode =
  | PowerBiErrorCode
  | "not_found"
  | "ambiguous"
  | "invalid_input";

export type TrainingActualGpsSafeError = {
  code: TrainingActualGpsErrorCode;
  message: string;
};

export type GetTrainingActualGpsResult =
  | { ok: true; data: TrainingActualGps }
  | { ok: false; error: TrainingActualGpsSafeError };

export type GetTrainingActualGpsBatchForDayInput = {
  weekId: string;
  mdTag: string;
  /** ISO date `YYYY-MM-DD` — required for Review day batch uniqueness. */
  date: string;
  /** Frozen Power BI player names (exact). */
  playerNames: string[];
};

export type GetTrainingActualGpsBatchForDayResult =
  | {
      ok: true;
      byPlayerName: Map<string, TrainingActualPlayerDayStatus>;
    }
  | { ok: false; error: TrainingActualGpsSafeError };

export type { TrainingActualPlayerDayStatus };

function requireNonEmpty(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildTrainingActualDax(input: {
  weekId: string;
  mdTag: string;
  playerName: string;
  dateParts?: { year: number; month: number; day: number };
}): string {
  const player = escapeDaxString(input.playerName);
  const weekId = escapeDaxString(input.weekId);
  const mdTag = escapeDaxString(input.mdTag);
  const drill = escapeDaxString(FULL_TRAINING_DRILL);

  const dateFilter = input.dateParts
    ? ` && GPS_Log[Date] = DATE(${input.dateParts.year},${input.dateParts.month},${input.dateParts.day})`
    : "";

  return `EVALUATE
SELECTCOLUMNS(
  FILTER(
    GPS_Log,
    GPS_Log[Player] = "${player}"
      && GPS_Log[Week ID] = "${weekId}"
      && GPS_Log[MD_Tag] = "${mdTag}"
      && GPS_Log[Drill] = "${drill}"${dateFilter}
  ),
  "TD", GPS_Log[TD],
  "Z5", GPS_Log[Z5],
  "Z6", GPS_Log[Z6],
  "Acc", GPS_Log[Acc],
  "Dec", GPS_Log[Dec]
)`;
}

/**
 * Build a non-aggregating Full Training day batch DAX for many players.
 * Returns raw rows including Player — caller classifies 0/1/>1 per name.
 */
export function buildTrainingActualBatchDax(input: {
  weekId: string;
  mdTag: string;
  playerNames: string[];
  dateParts: { year: number; month: number; day: number };
}): string {
  const weekId = escapeDaxString(input.weekId);
  const mdTag = escapeDaxString(input.mdTag);
  const drill = escapeDaxString(FULL_TRAINING_DRILL);
  const playerList = input.playerNames
    .map((name) => `"${escapeDaxString(name)}"`)
    .join(", ");

  return `EVALUATE
SELECTCOLUMNS(
  FILTER(
    GPS_Log,
    GPS_Log[Player] IN {${playerList}}
      && GPS_Log[Week ID] = "${weekId}"
      && GPS_Log[MD_Tag] = "${mdTag}"
      && GPS_Log[Drill] = "${drill}"
      && GPS_Log[Date] = DATE(${input.dateParts.year},${input.dateParts.month},${input.dateParts.day})
  ),
  "Player", GPS_Log[Player],
  "TD", GPS_Log[TD],
  "Z5", GPS_Log[Z5],
  "Z6", GPS_Log[Z6],
  "Acc", GPS_Log[Acc],
  "Dec", GPS_Log[Dec]
)`;
}

/**
 * Full Training actual GPS values for one player / week / MD (optional date).
 * Does not aggregate when multiple rows match — returns `ambiguous`.
 */
export async function getTrainingActualGps(
  input: GetTrainingActualGpsInput
): Promise<GetTrainingActualGpsResult> {
  const playerName = requireNonEmpty(input.playerName ?? "");
  const weekId = requireNonEmpty(input.weekId ?? "");
  const mdTag = requireNonEmpty(input.mdTag ?? "");

  if (!playerName || !weekId || !mdTag) {
    const error: TrainingActualGpsSafeError = {
      code: "invalid_input",
      message: "playerName, weekId, and mdTag are required.",
    };
    logPowerBiError("trainingActual", error);
    return { ok: false, error };
  }

  let dateParts: { year: number; month: number; day: number } | undefined;
  if (input.date !== undefined && input.date !== null && String(input.date).trim() !== "") {
    const parsed = parseIsoDateParts(String(input.date));
    if (!parsed) {
      const error: TrainingActualGpsSafeError = {
        code: "invalid_input",
        message: "date must be an ISO date string (YYYY-MM-DD).",
      };
      logPowerBiError("trainingActual", error);
      return { ok: false, error };
    }
    dateParts = parsed;
  }

  const result = await executePowerBiDaxQuery(
    buildTrainingActualDax({ playerName, weekId, mdTag, dateParts })
  );
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const rows = firstResultRows(result.results);
  if (rows.length === 0) {
    const error: TrainingActualGpsSafeError = {
      code: "not_found",
      message:
        "No Full Training GPS row matched the given player, week, and MD tag.",
    };
    logPowerBiError("trainingActual", error);
    return { ok: false, error };
  }

  if (rows.length > 1) {
    const error: TrainingActualGpsSafeError = {
      code: "ambiguous",
      message:
        "Multiple Full Training GPS rows matched; provide date or resolve duplicates in the semantic model.",
    };
    logPowerBiError("trainingActual", error, { rowCount: rows.length });
    return { ok: false, error };
  }

  return { ok: true, data: mapTrainingActualRow(rows[0]) };
}

/**
 * Full Training Actual for many frozen player names on ONE week day.
 * One Execute Queries call. Raw rows only — no SUM/MAX aggregation.
 * Per-player 0/1/>1 classification is independent.
 */
export async function getTrainingActualGpsBatchForDay(
  input: GetTrainingActualGpsBatchForDayInput
): Promise<GetTrainingActualGpsBatchForDayResult> {
  const weekId = requireNonEmpty(input.weekId ?? "");
  const mdTag = requireNonEmpty(input.mdTag ?? "");
  const dateParts = parseIsoDateParts(String(input.date ?? ""));

  if (!weekId || !mdTag || !dateParts) {
    const error: TrainingActualGpsSafeError = {
      code: "invalid_input",
      message: "weekId, mdTag, and date (YYYY-MM-DD) are required.",
    };
    logPowerBiError("trainingActualBatch", error);
    return { ok: false, error };
  }

  const playerNames = [
    ...new Set(
      (input.playerNames ?? [])
        .map((n) => (typeof n === "string" ? n : ""))
        .filter((n) => n.length > 0)
    ),
  ];

  if (playerNames.length === 0) {
    return { ok: true, byPlayerName: new Map() };
  }

  const result = await executePowerBiDaxQuery(
    buildTrainingActualBatchDax({
      weekId,
      mdTag,
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
    byPlayerName: classifyTrainingActualRowsByPlayer(playerNames, rows),
  };
}
