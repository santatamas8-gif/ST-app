/**
 * Compute sleep duration in hours from bed time and wake time (HH:mm or HH:mm:ss).
 * Handles overnight (wake next day).
 * Returns precise decimal hours, rounded to 2 decimals (e.g. 5.92, 7.93).
 */
export function sleepDurationHours(bedTime: string, wakeTime: string): number | null {
  if (!bedTime || !wakeTime) return null;
  const [bH, bM] = bedTime.split(":").map(Number);
  const [wH, wM] = wakeTime.split(":").map(Number);
  let bedMins = bH * 60 + (bM ?? 0);
  let wakeMins = wH * 60 + (wM ?? 0);
  if (wakeMins <= bedMins) wakeMins += 24 * 60; // next day
  const durationMins = wakeMins - bedMins;
  return Math.round((durationMins / 60) * 100) / 100;
}
