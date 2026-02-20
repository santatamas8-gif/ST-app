/**
 * Session load = duration (minutes) × RPE (1–10).
 */
export function sessionLoad(durationMinutes: number, rpe: number): number {
  return Math.round(durationMinutes * rpe * 100) / 100;
}
