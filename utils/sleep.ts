/**
 * Compute sleep duration in hours from bed time and wake time (HH:mm or HH:mm:ss).
 * Handles overnight (wake next day).
 * Returns decimal hours with minutes normalized to 0–59 (so 7.59 then 8.00).
 */
export function sleepDurationHours(bedTime: string, wakeTime: string): number | null {
  if (!bedTime || !wakeTime) return null;
  const [bH, bM] = bedTime.split(":").map(Number);
  const [wH, wM] = wakeTime.split(":").map(Number);
  let bedMins = bH * 60 + (bM ?? 0);
  let wakeMins = wH * 60 + (wM ?? 0);
  if (wakeMins <= bedMins) wakeMins += 24 * 60; // next day
  const durationMins = wakeMins - bedMins;
  const hours = Math.floor(durationMins / 60);
  const minutes = durationMins % 60; // 0–59
  return hours + minutes / 60;
}

/** Normalize decimal hours so fractional part = minutes 0–59 (e.g. 7.60 → 8.00). */
export function normalizeSleepDecimalHours(decimalHours: number): number {
  const h = Math.floor(decimalHours);
  let m = Math.round((decimalHours - h) * 60);
  if (m >= 60) {
    m = 0;
    return h + 1;
  }
  return h + m / 60;
}

/** Format sleep duration for display: "7.59" (7h 59min), "8.00" (8h 0min). Minutes always 00–59. */
export function formatSleepDuration(decimalHours: number | null): string {
  if (decimalHours == null || Number.isNaN(decimalHours)) return "—";
  const h = Math.floor(decimalHours);
  let m = Math.round((decimalHours - h) * 60);
  if (m >= 60) {
    m = 0;
    return `${h + 1}.00`;
  }
  return `${h}.${String(m).padStart(2, "0")}`;
}
