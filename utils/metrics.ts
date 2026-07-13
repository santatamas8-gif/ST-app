/**
 * Monotony = mean weekly load / SD(weekly load).
 * If SD is 0, return 1 to avoid division by zero.
 */
export function monotony(dailyLoads: number[]): number {
  if (dailyLoads.length === 0) return 0;
  const mean = dailyLoads.reduce((a, b) => a + b, 0) / dailyLoads.length;
  const variance =
    dailyLoads.reduce((acc, x) => acc + (x - mean) ** 2, 0) / dailyLoads.length;
  const sd = Math.sqrt(variance);
  if (sd === 0) return 1;
  return Math.round((mean / sd) * 100) / 100;
}

/**
 * Strain = weekly load × monotony.
 */
export function strain(weeklyLoad: number, monotonyValue: number): number {
  return Math.round(weeklyLoad * monotonyValue * 100) / 100;
}
