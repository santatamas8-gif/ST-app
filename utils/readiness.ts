/**
 * Readiness score 0–100 from wellness components.
 * Uses: sleep quality, soreness, fatigue, stress, mood (all 1–10, higher = better).
 * Optional: sleep hours → score by 8h = 10.
 * Each component is 1–10; we average and scale to 0–100.
 */
export function readinessScore(params: {
  sleepQuality: number | null;
  soreness: number | null;
  fatigue: number | null;
  stress: number | null;
  mood: number | null;
  sleepHours: number | null;
}): number | null {
  const { sleepQuality, soreness, fatigue, stress, mood, sleepHours } = params;
  const values: number[] = [];
  if (sleepQuality != null) values.push(sleepQuality);
  if (soreness != null) values.push(soreness);
  if (fatigue != null) values.push(fatigue);
  if (stress != null) values.push(stress);
  if (mood != null) values.push(mood);
  // Optional: factor in sleep hours (e.g. 7h = 10, <6 = penalize)
  if (sleepHours != null && sleepHours > 0) {
    const sleepScore = Math.min(10, Math.max(0, (sleepHours / 8) * 10));
    values.push(sleepScore);
  }
  if (values.length === 0) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round((avg / 10) * 100);
}
