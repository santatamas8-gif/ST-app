/** Pure training Actual row classification (safe for unit tests). */

import {
  parseIsoDateParts,
  pickRowValue,
  toNullableNumber,
} from "@/lib/powerbi/queries/rowUtils";

export const FULL_TRAINING_DRILL = "Full Training";
export const INDIVIDUAL_TRAINING_DRILL = "Individual";
/** Planner-day ISO date on/after which Individual is an allowed training drill. */
export const INDIVIDUAL_TRAINING_START_DATE = "2026-09-01";

export type TrainingActualGpsMetrics = {
  totalDistance: number | null;
  hsr: number | null;
  sprint: number | null;
  accelerations: number | null;
  decelerations: number | null;
};

export type TrainingActualPlayerDayStatus =
  | { status: "found"; metrics: TrainingActualGpsMetrics }
  | { status: "not_found" }
  | { status: "ambiguous" };

/**
 * Cutoff uses the planner day's explicit YYYY-MM-DD (lexical).
 * Missing/invalid date → Individual is not allowed (historical Full Training-only).
 */
export function allowsIndividualTrainingDate(
  isoDate: string | null | undefined
): boolean {
  if (typeof isoDate !== "string") return false;
  const trimmed = isoDate.trim();
  if (!parseIsoDateParts(trimmed)) return false;
  return trimmed.slice(0, 10) >= INDIVIDUAL_TRAINING_START_DATE;
}

export function mapTrainingActualRow(
  row: Record<string, unknown>
): TrainingActualGpsMetrics {
  return {
    totalDistance: toNullableNumber(pickRowValue(row, "TD")),
    hsr: toNullableNumber(pickRowValue(row, "Z5")),
    sprint: toNullableNumber(pickRowValue(row, "Z6")),
    accelerations: toNullableNumber(pickRowValue(row, "Acc")),
    decelerations: toNullableNumber(pickRowValue(row, "Dec")),
  };
}

function drillOf(row: Record<string, unknown>): string | null {
  const raw = pickRowValue(row, "Drill");
  return typeof raw === "string" ? raw : null;
}

/**
 * Classify raw (non-aggregated) training rows for ONE player.
 * Exact drills only. Never sum. Never precedence.
 *
 * | Full Training | Individual | Result |
 * | 0 | 0 | not_found |
 * | 1 | 0 | found (Full Training) |
 * | 0 | 1 | found (Individual) |
 * | 1 | 1 | ambiguous |
 * | >1 | any | ambiguous |
 * | any | >1 | ambiguous |
 */
export function classifyOnePlayerTrainingActualRows(
  rows: Record<string, unknown>[]
): TrainingActualPlayerDayStatus {
  const fullTraining: Record<string, unknown>[] = [];
  const individual: Record<string, unknown>[] = [];
  for (const row of rows) {
    const drill = drillOf(row);
    if (drill === FULL_TRAINING_DRILL) fullTraining.push(row);
    else if (drill === INDIVIDUAL_TRAINING_DRILL) individual.push(row);
  }

  if (fullTraining.length > 1 || individual.length > 1) {
    return { status: "ambiguous" };
  }
  if (fullTraining.length === 1 && individual.length === 1) {
    return { status: "ambiguous" };
  }
  if (fullTraining.length === 1) {
    return { status: "found", metrics: mapTrainingActualRow(fullTraining[0]) };
  }
  if (individual.length === 1) {
    return { status: "found", metrics: mapTrainingActualRow(individual[0]) };
  }
  return { status: "not_found" };
}

/**
 * Classify raw (non-aggregated) training rows per requested player.
 * Players are independent — one player's missing row does not affect another.
 */
export function classifyTrainingActualRowsByPlayer(
  requestedPlayerNames: string[],
  rows: Record<string, unknown>[]
): Map<string, TrainingActualPlayerDayStatus> {
  const grouped = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const raw = pickRowValue(row, "Player");
    if (typeof raw !== "string") continue;
    const list = grouped.get(raw) ?? [];
    list.push(row);
    grouped.set(raw, list);
  }

  const out = new Map<string, TrainingActualPlayerDayStatus>();
  for (const name of requestedPlayerNames) {
    out.set(name, classifyOnePlayerTrainingActualRows(grouped.get(name) ?? []));
  }
  return out;
}
