import type { WellnessRow } from "@/lib/types";

/**
 * Wellness average from one row: average of sleep_quality, (11-soreness), (11-fatigue), (11-stress), mood, motivation.
 * Each is 1–10; we invert soreness/fatigue/stress so higher = worse.
 */
export function wellnessAverageFromRow(row: WellnessRow): number | null {
  const values: number[] = [];
  if (row.sleep_quality != null) values.push(row.sleep_quality);
  if (row.soreness != null) values.push(11 - row.soreness);
  if (row.fatigue != null) values.push(11 - row.fatigue);
  if (row.stress != null) values.push(11 - row.stress);
  if (row.mood != null) values.push(row.mood);
  if (row.motivation != null) values.push(row.motivation);
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
