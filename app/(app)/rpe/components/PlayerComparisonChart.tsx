"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  comparisonChartMetricLabel,
  comparisonChartMetricValue,
  getPlayerComparisonColor,
  type PlayerComparisonChartMetric,
  type PlayerComparisonRow,
} from "@/lib/kioskRpe/playerComparisonAnalytics";
import {
  formatAverageDuration,
  formatAverageLoad,
  formatAverageRpe,
  formatTotalLoad,
} from "@/lib/kioskRpe/matchdayAnalytics";

interface PlayerComparisonChartProps {
  rows: PlayerComparisonRow[];
  metric: PlayerComparisonChartMetric;
  isHighContrast: boolean;
}

function formatTooltipMetric(
  value: number,
  metric: PlayerComparisonChartMetric
): string {
  switch (metric) {
    case "averageLoad":
      return `${formatAverageLoad(value)} AU`;
    case "averageRpe":
      return formatAverageRpe(value);
    case "averageDuration":
      return `${formatAverageDuration(value)} min`;
    case "totalLoad":
      return `${formatTotalLoad(value)} AU`;
  }
}

function truncateLabel(name: string, max = 14): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

export function PlayerComparisonChart({
  rows,
  metric,
  isHighContrast,
}: PlayerComparisonChartProps) {
  const data = rows.map((row, index) => {
    const raw = comparisonChartMetricValue(row, metric);
    return {
      name: row.playerName,
      shortName: truncateLabel(row.playerName),
      value: raw ?? 0,
      hasValue: raw != null,
      sessionCount: row.sessionCount,
      color: getPlayerComparisonColor(index),
    };
  });

  return (
    <div className="h-56 min-w-0 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isHighContrast ? "#ffffff22" : "#27272a"} />
          <XAxis
            dataKey="shortName"
            stroke={isHighContrast ? "#ffffff99" : "#71717a"}
            tick={{ fontSize: 10 }}
            interval={0}
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
              if (!payload?.hasValue) return ["—", comparisonChartMetricLabel(metric)];
              return [formatTooltipMetric(value, metric), comparisonChartMetricLabel(metric)];
            }}
            labelFormatter={(_label, payload) => {
              const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!row) return "";
              return `${row.name} · ${row.sessionCount} session${row.sessionCount === 1 ? "" : "s"}`;
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} name={comparisonChartMetricLabel(metric)}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
