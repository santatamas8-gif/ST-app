import { formatDrillMetric, formatDurationMinutes, formatMetricDifference } from "@/lib/drillAnalysis/format";
import { DRILL_METRICS, type DrillMetricKey, type PlayerOccurrenceValues } from "@/lib/drillAnalysis/types";

export type CompareMetricRow = {
  key: DrillMetricKey;
  label: string;
  playerA: string;
  playerB: string;
  difference: string;
};

/** One source occurrence, compared for the two named players. */
export function compareOccurrence(
  values: Record<string, PlayerOccurrenceValues> | undefined,
  playerA: string,
  playerB: string
): { durationA: string; durationB: string; rows: CompareMetricRow[] } {
  const a = values?.[playerA];
  const b = values?.[playerB];
  return {
    durationA: formatDurationMinutes(a?.durationMinutes ?? null),
    durationB: formatDurationMinutes(b?.durationMinutes ?? null),
    rows: DRILL_METRICS.map((metric) => {
      const left = a?.metrics[metric.key] ?? null;
      const right = b?.metrics[metric.key] ?? null;
      return {
        key: metric.key,
        label: metric.label,
        playerA: formatDrillMetric(left, metric.unit),
        playerB: formatDrillMetric(right, metric.unit),
        difference: formatMetricDifference(left, right, metric.unit),
      };
    }),
  };
}
