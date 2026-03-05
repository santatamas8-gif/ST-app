import type { WellnessRow } from "@/lib/types";

/**
 * Wellness average (Readiness) from one row: average of sleep_quality, fatigue, soreness, stress, mood.
 * All 1–10, higher = better (no inversion).
 */
export function wellnessAverageFromRow(row: WellnessRow): number | null {
  const values: number[] = [];
  // Scale is 1–10; treat 0 as missing (invalid)
  if (row.sleep_quality != null && row.sleep_quality >= 1) values.push(row.sleep_quality);
  if (row.soreness != null && row.soreness >= 1) values.push(row.soreness);
  if (row.fatigue != null && row.fatigue >= 1) values.push(row.fatigue);
  if (row.stress != null && row.stress >= 1) values.push(row.stress);
  if (row.mood != null && row.mood >= 1) values.push(row.mood);
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

/**
 * Average wellness score across multiple rows (e.g. for "today" or "last 7 days").
 */
export function averageWellness(rows: WellnessRow[]): number | null {
  const scores = rows.map(wellnessAverageFromRow).filter((s): s is number => s != null);
  if (scores.length === 0) return null;
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round((sum / scores.length) * 10) / 10;
}

/**
 * Average sleep duration in hours across rows.
 */
export function averageSleepHours(rows: WellnessRow[]): number | null {
  const hours = rows
    .map((r) => r.sleep_duration)
    .filter((h): h is number => h != null && h > 0);
  if (hours.length === 0) return null;
  const sum = hours.reduce((a, b) => a + b, 0);
  return Math.round((sum / hours.length) * 100) / 100;
}
