import { formatSleepDuration } from "@/utils/sleep";

export type RedFlagType =
  | "wellness_low"
  | "sleep_low"
  | "monotony_high"
  | "load_spike"
  | "fatigue_low"
  | "soreness_low"
  | "stress_low"
  | "mood_low";

export interface RedFlag {
  type: RedFlagType;
  label: string;
  value?: string | number;
}

const WELLNESS_THRESHOLD = 5;
const SLEEP_HOURS_THRESHOLD = 6;
const MONOTONY_THRESHOLD = 2;
const LOAD_SPIKE_PCT = 0.3;
/** Wellness scale: 1 = worst, 10 = best. Risk when value is below 5. */
const WELLNESS_RISK_BELOW = 5;

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
  soreness?: number | null;
  stress?: number | null;
  mood?: number | null;
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
      value: `${formatSleepDuration(params.avgSleepHours)}h`,
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

  if (params.fatigue != null && params.fatigue < WELLNESS_RISK_BELOW) {
    flags.push({
      type: "fatigue_low",
      label: "Fatigue below 5",
      value: params.fatigue,
    });
  }
  if (params.soreness != null && params.soreness < WELLNESS_RISK_BELOW) {
    flags.push({
      type: "soreness_low",
      label: "Soreness below 5",
      value: params.soreness,
    });
  }
  if (params.stress != null && params.stress < WELLNESS_RISK_BELOW) {
    flags.push({
      type: "stress_low",
      label: "Stress below 5",
      value: params.stress,
    });
  }
  if (params.mood != null && params.mood < WELLNESS_RISK_BELOW) {
    flags.push({
      type: "mood_low",
      label: "Mood below 5",
      value: params.mood,
    });
  }

  return flags;
}
