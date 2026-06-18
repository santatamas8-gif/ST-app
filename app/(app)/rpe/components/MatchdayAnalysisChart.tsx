"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MatchdayAnalyticsRow, MatchdayChartMetric } from "@/lib/kioskRpe/matchdayAnalytics";
import {
  chartMetricLabel,
  chartMetricValue,
  formatAverageDuration,
  formatAverageLoad,
  formatAverageRpe,
} from "@/lib/kioskRpe/matchdayAnalytics";

interface MatchdayAnalysisChartProps {
  rows: MatchdayAnalyticsRow[];
  metric: MatchdayChartMetric;
  isHighContrast: boolean;
}

function formatTooltipValue(value: number, metric: MatchdayChartMetric): string {
  switch (metric) {
    case "averageLoad":
      return `${formatAverageLoad(value)} AU`;
    case "averageRpe":
      return formatAverageRpe(value);
    case "averageDuration":
      return `${formatAverageDuration(value)} min`;
  }
}

export function MatchdayAnalysisChart({
  rows,
  metric,
  isHighContrast,
}: MatchdayAnalysisChartProps) {
  const data = rows
    .map((row) => {
      const value = chartMetricValue(row, metric);
      if (value == null) return null;
      return {
        tag: row.tag,
        value,
        sessionCount: row.sessionCount,
        totalLoad: row.totalLoad,
      };
    })
    .filter((point): point is NonNullable<typeof point> => point != null);

  if (data.length === 0) {
    return (
      <div
        className={`flex h-56 items-center justify-center rounded-lg border text-sm ${
          isHighContrast ? "border-white/20 text-white/60" : "border-zinc-700 text-zinc-500"
        }`}
      >
        No chart data for the selected metric.
      </div>
    );
  }

  return (
    <div className="h-56 min-w-0 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isHighContrast ? "#ffffff22" : "#27272a"} />
          <XAxis
            dataKey="tag"
            stroke={isHighContrast ? "#ffffff99" : "#71717a"}
            tick={{ fontSize: 10 }}
            interval={0}
          />
          <YAxis
            stroke={isHighContrast ? "#ffffff99" : "#71717a"}
            tick={{ fontSize: 10 }}
            allowDecimals={metric !== "averageLoad" && metric !== "averageDuration"}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card-bg)",
              border: isHighContrast ? "1px solid #ffffff33" : "1px solid #27272a",
              borderRadius: "8px",
              color: isHighContrast ? "#fff" : "#e4e4e7",
            }}
            formatter={(value: number) => [formatTooltipValue(value, metric), chartMetricLabel(metric)]}
            labelFormatter={(label) => `Matchday: ${label}`}
          />
          <Bar dataKey="value" fill="#14b8a6" radius={[4, 4, 0, 0]} name={chartMetricLabel(metric)} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
