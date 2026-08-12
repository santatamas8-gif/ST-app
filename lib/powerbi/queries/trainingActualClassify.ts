/** Pure Full Training Actual row classification (safe for unit tests). */

import {
  pickRowValue,
  toNullableNumber,
} from "@/lib/powerbi/queries/rowUtils";

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

/**
 * Classify raw (non-aggregated) Full Training rows per requested player.
 * 0 rows → not_found; 1 → found; >1 → ambiguous.
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
    const matches = grouped.get(name) ?? [];
    if (matches.length === 0) {
      out.set(name, { status: "not_found" });
    } else if (matches.length > 1) {
      out.set(name, { status: "ambiguous" });
    } else {
      out.set(name, {
        status: "found",
        metrics: mapTrainingActualRow(matches[0]),
      });
    }
  }
  return out;
}
