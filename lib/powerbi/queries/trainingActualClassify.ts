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

function sumNullableMetric(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  const sum = a + b;
  return Number.isFinite(sum) ? sum : null;
}

/**
 * Metric-wise sum of two distinct training loads.
 * A null/invalid addend stays null — never a fake valid total.
 */
export function sumTrainingActualMetrics(
  a: TrainingActualGpsMetrics,
  b: TrainingActualGpsMetrics
): TrainingActualGpsMetrics {
  return {
    totalDistance: sumNullableMetric(a.totalDistance, b.totalDistance),
    hsr: sumNullableMetric(a.hsr, b.hsr),
    sprint: sumNullableMetric(a.sprint, b.sprint),
    accelerations: sumNullableMetric(a.accelerations, b.accelerations),
    decelerations: sumNullableMetric(a.decelerations, b.decelerations),
  };
}

/**
 * Classify raw (non-aggregated) training rows for ONE player.
 * Exact drills only. Never DISTINCT-all-rows. Never precedence.
 * Duplicate rows of the same drill stay ambiguous (never summed).
 *
 * From 2026-09-01, one Full Training and one Individual are two distinct
 * loads and are summed metric-wise. Before that date Individual is ignored.
 *
 * | Full Training | Individual | Result |
 * | 0 | 0 | not_found |
 * | 1 | 0 | found (Full Training) |
 * | 0 | 1 | found (Individual) — only when date >= 2026-09-01 |
 * | 1 | 1 | found (sum) — only when date >= 2026-09-01 |
 * | >1 | any | ambiguous |
 * | any | >1 | ambiguous |
 */
export function classifyOnePlayerTrainingActualRows(
  rows: Record<string, unknown>[],
  isoDate?: string | null
): TrainingActualPlayerDayStatus {
  const allowIndividual = allowsIndividualTrainingDate(isoDate);
  const fullTraining: Record<string, unknown>[] = [];
  const individual: Record<string, unknown>[] = [];
  for (const row of rows) {
    const drill = drillOf(row);
    if (drill === FULL_TRAINING_DRILL) fullTraining.push(row);
    else if (allowIndividual && drill === INDIVIDUAL_TRAINING_DRILL) {
      individual.push(row);
    }
  }

  if (fullTraining.length > 1 || individual.length > 1) {
    return { status: "ambiguous" };
  }
  if (fullTraining.length === 1 && individual.length === 1) {
    return {
      status: "found",
      metrics: sumTrainingActualMetrics(
        mapTrainingActualRow(fullTraining[0]),
        mapTrainingActualRow(individual[0])
      ),
    };
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
  rows: Record<string, unknown>[],
  isoDate?: string | null
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
    out.set(
      name,
      classifyOnePlayerTrainingActualRows(grouped.get(name) ?? [], isoDate)
    );
  }
  return out;
}
