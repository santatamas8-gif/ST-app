export type RedFlagType =
  | "wellness_low"
  | "sleep_low"
  | "monotony_high"
  | "load_spike"
  | "fatigue_high";

export interface RedFlag {
  type: RedFlagType;
  label: string;
  value?: string | number;
}

const WELLNESS_THRESHOLD = 5;
const SLEEP_HOURS_THRESHOLD = 6;
const MONOTONY_THRESHOLD = 2;
const LOAD_SPIKE_PCT = 0.3;
const FATIGUE_THRESHOLD = 8;

/**
 * Detect red flags from current metrics and optional previous week load for spike.
 */
export function detectRedFlags(params: {
  wellnessAverage: number | null;
  avgSleepHours: number | null;
  monotonyValue: number;
  weeklyLoad: number;
  previousWeekLoad: number | null;
  fatigue: number | null;
}): RedFlag[] {
  const flags: RedFlag[] = [];

  if (params.wellnessAverage != null && params.wellnessAverage < WELLNESS_THRESHOLD) {
    flags.push({
      type: "wellness_low",
      label: "Wellness average below 5",
      value: params.wellnessAverage.toFixed(1),
    });
  }

  if (params.avgSleepHours != null && params.avgSleepHours < SLEEP_HOURS_THRESHOLD) {
    flags.push({
      type: "sleep_low",
      label: "Sleep under 6 hours",
      value: `${params.avgSleepHours.toFixed(1)}h`,
    });
  }

  if (params.monotonyValue > MONOTONY_THRESHOLD) {
    flags.push({
      type: "monotony_high",
      label: "Monotony above 2",
      value: params.monotonyValue.toFixed(2),
    });
  }

  if (
    params.previousWeekLoad != null &&
    params.previousWeekLoad > 0 &&
    params.weeklyLoad > params.previousWeekLoad * (1 + LOAD_SPIKE_PCT)
  ) {
    const pct = (
      ((params.weeklyLoad - params.previousWeekLoad) / params.previousWeekLoad) *
      100
    ).toFixed(0);
    flags.push({
      type: "load_spike",
      label: "Load spike >30% vs last week",
      value: `+${pct}%`,
    });
  }

  if (params.fatigue != null && params.fatigue > FATIGUE_THRESHOLD) {
    flags.push({
      type: "fatigue_high",
      label: "Fatigue above 8",
      value: params.fatigue,
    });
  }

  return flags;
}
