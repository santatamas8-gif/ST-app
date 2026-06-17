"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  chartMetricBaselineValue,
  chartMetricRecentValue,
  chartMetricTitle,
  type PlayerSelfBaselineResult,
  type SelfBaselineChartMetric,
} from "@/lib/kioskRpe/playerSelfBaselineAnalytics";
import {
  formatAverageDuration,
  formatAverageLoad,
  formatAverageRpe,
} from "@/lib/kioskRpe/matchdayAnalytics";

const RECENT_COLOR = "#10b981";
const BASELINE_COLOR = "#3b82f6";

interface PlayerSelfBaselineChartProps {
  result: PlayerSelfBaselineResult;
  metric: SelfBaselineChartMetric;
  isHighContrast: boolean;
}

function formatMetricValue(value: number, metric: SelfBaselineChartMetric): string {
  switch (metric) {
    case "averageLoad":
      return `${formatAverageLoad(value)} AU`;
    case "averageRpe":
      return formatAverageRpe(value);
    case "averageDuration":
      return `${formatAverageDuration(value)} min`;
  }
}

export function PlayerSelfBaselineChart({
  result,
  metric,
  isHighContrast,
}: PlayerSelfBaselineChartProps) {
  const recentValue = chartMetricRecentValue(result, metric);
  const baselineValue = chartMetricBaselineValue(result, metric);

  const data = [
    {
      period: "Recent",
      value: recentValue ?? 0,
      hasValue: recentValue != null,
      sessionCount: result.recent.sessionCount,
      fill: RECENT_COLOR,
    },
    {
      period: "Baseline",
      value: baselineValue ?? 0,
      hasValue: baselineValue != null,
      sessionCount: result.baseline.sessionCount,
      fill: BASELINE_COLOR,
    },
  ];

  return (
    <div className="h-56 min-w-0 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isHighContrast ? "#ffffff22" : "#27272a"} />
          <XAxis
            dataKey="period"
            stroke={isHighContrast ? "#ffffff99" : "#71717a"}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            stroke={isHighContrast ? "#ffffff99" : "#71717a"}
            tick={{ fontSize: 10 }}
            allowDecimals={metric === "averageRpe"}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card-bg)",
              border: isHighContrast ? "1px solid #ffffff33" : "1px solid #27272a",
              borderRadius: "8px",
              color: isHighContrast ? "#fff" : "#e4e4e7",
            }}
            formatter={(value: number, _name, item) => {
              const payload = item?.payload as (typeof data)[number] | undefined;
              if (!payload?.hasValue) return ["—", chartMetricTitle(metric)];
              return [formatMetricValue(value, metric), chartMetricTitle(metric)];
            }}
            labelFormatter={(_label, payload) => {
              const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!row) return "";
              return `${row.period} · ${row.sessionCount} session${row.sessionCount === 1 ? "" : "s"}`;
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="value" name={chartMetricTitle(metric)} radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.period} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
