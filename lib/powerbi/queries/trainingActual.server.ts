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
  allowsIndividualTrainingDate,
  classifyOnePlayerTrainingActualRows,
  classifyTrainingActualRowsByPlayer,
  FULL_TRAINING_DRILL,
  INDIVIDUAL_TRAINING_DRILL,
  INDIVIDUAL_TRAINING_START_DATE,
  type TrainingActualGpsMetrics,
  type TrainingActualPlayerDayStatus,
} from "@/lib/powerbi/queries/trainingActualClassify";

export {
  FULL_TRAINING_DRILL,
  INDIVIDUAL_TRAINING_DRILL,
  INDIVIDUAL_TRAINING_START_DATE,
  allowsIndividualTrainingDate,
};

export type TrainingActualGps = TrainingActualGpsMetrics;

export type GetTrainingActualGpsInput = {
  weekId: string;
  mdTag: string;
  playerName: string;
  /** Optional ISO date `YYYY-MM-DD` to disambiguate and apply the Individual cutoff. */
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

function isoDateFromParts(parts: {
  year: number;
  month: number;
  day: number;
}): string {
  const y = String(parts.year).padStart(4, "0");
  const m = String(parts.month).padStart(2, "0");
  const d = String(parts.day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Dated training Drill predicate.
 * date < 2026-09-01 or missing/invalid → exact Full Training.
 * date >= 2026-09-01 → exact Full Training or Individual.
 */
export function buildTrainingDrillDaxPredicate(
  isoDate?: string | null
): string {
  const fullTraining = escapeDaxString(FULL_TRAINING_DRILL);
  if (allowsIndividualTrainingDate(isoDate ?? undefined)) {
    const individual = escapeDaxString(INDIVIDUAL_TRAINING_DRILL);
    return `GPS_Log[Drill] IN {"${fullTraining}", "${individual}"}`;
  }
  return `GPS_Log[Drill] = "${fullTraining}"`;
}

export function buildTrainingActualDax(input: {
  weekId: string;
  mdTag: string;
  playerName: string;
  dateParts?: { year: number; month: number; day: number };
  isoDate?: string | null;
}): string {
  const player = escapeDaxString(input.playerName);
  const weekId = escapeDaxString(input.weekId);
  const mdTag = escapeDaxString(input.mdTag);
  const drillPredicate = buildTrainingDrillDaxPredicate(input.isoDate);

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
      && ${drillPredicate}${dateFilter}
  ),
  "Drill", GPS_Log[Drill],
  "TD", GPS_Log[TD],
  "Z5", GPS_Log[Z5],
  "Z6", GPS_Log[Z6],
  "Acc", GPS_Log[Acc],
  "Dec", GPS_Log[Dec]
)`;
}

/**
 * Build a non-aggregating training day batch DAX for many players.
 * Returns raw rows including Player and Drill — caller classifies per name and drill.
 */
export function buildTrainingActualBatchDax(input: {
  weekId: string;
  mdTag: string;
  playerNames: string[];
  dateParts: { year: number; month: number; day: number };
}): string {
  const weekId = escapeDaxString(input.weekId);
  const mdTag = escapeDaxString(input.mdTag);
  const isoDate = isoDateFromParts(input.dateParts);
  const drillPredicate = buildTrainingDrillDaxPredicate(isoDate);
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
      && ${drillPredicate}
      && GPS_Log[Date] = DATE(${input.dateParts.year},${input.dateParts.month},${input.dateParts.day})
  ),
  "Player", GPS_Log[Player],
  "Drill", GPS_Log[Drill],
  "TD", GPS_Log[TD],
  "Z5", GPS_Log[Z5],
  "Z6", GPS_Log[Z6],
  "Acc", GPS_Log[Acc],
  "Dec", GPS_Log[Dec]
)`;
}

/**
 * Training actual GPS values for one player / week / MD (optional date).
 * Does not aggregate when multiple allowed-drill rows match — returns `ambiguous`.
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
  let isoDate: string | undefined;
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
    isoDate = String(input.date).trim().slice(0, 10);
  }

  const result = await executePowerBiDaxQuery(
    buildTrainingActualDax({ playerName, weekId, mdTag, dateParts, isoDate })
  );
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const rows = firstResultRows(result.results);
  const classified = classifyOnePlayerTrainingActualRows(rows);
  if (classified.status === "not_found") {
    const error: TrainingActualGpsSafeError = {
      code: "not_found",
      message:
        "No training GPS row matched the given player, week, and MD tag.",
    };
    logPowerBiError("trainingActual", error);
    return { ok: false, error };
  }

  if (classified.status === "ambiguous") {
    const error: TrainingActualGpsSafeError = {
      code: "ambiguous",
      message:
        "Multiple training GPS rows matched; resolve duplicates in the semantic model.",
    };
    logPowerBiError("trainingActual", error, { rowCount: rows.length });
    return { ok: false, error };
  }

  return { ok: true, data: classified.metrics };
}

/**
 * Training Actual for many frozen player names on ONE week day.
 * One Execute Queries call. Raw rows only — no SUM/MAX aggregation.
 * Per-player 0/1/>1 classification is independent (per exact drill).
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
