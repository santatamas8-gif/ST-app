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
import { formatMonthDay } from "@/lib/formatDate";
import type { PlayerSessionHistoryDay } from "@/lib/rpe/playerSessionHistory";

type PlayerSessionHistoryChartProps = {
  days: PlayerSessionHistoryDay[];
  isHighContrast: boolean;
};

function formatRpe(value: number | null): string {
  return value == null ? "—" : value.toFixed(1);
}

export function PlayerSessionHistoryChart({
  days,
  isHighContrast,
}: PlayerSessionHistoryChartProps) {
  const data = days.map((day) => ({
    date: day.date,
    label: formatMonthDay(day.date),
    load: Math.round(day.totalLoad),
    sessionCount: day.sessionCount,
    averageRpe: day.averageRpe,
    totalDuration: day.totalDuration,
    sessionTypeLabel: day.sessionTypeLabel,
    matchdayTagLabel: day.matchdayTagLabel,
  }));

  return (
    <div className="h-60 min-w-0 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 8, left: -8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isHighContrast ? "#ffffff22" : "#27272a"} />
          <XAxis
            dataKey="label"
            stroke={isHighContrast ? "#ffffff99" : "#71717a"}
            tick={{ fontSize: 10 }}
            interval={0}
          />
          <YAxis
            stroke={isHighContrast ? "#ffffff99" : "#71717a"}
            tick={{ fontSize: 10 }}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(20,184,166,0.08)" }}
            contentStyle={{
              backgroundColor: "var(--card-bg)",
              border: isHighContrast ? "1px solid #ffffff33" : "1px solid #27272a",
              borderRadius: "8px",
              color: isHighContrast ? "#fff" : "#e4e4e7",
            }}
            formatter={(value: number) => [`${Math.round(value).toLocaleString("en-GB")} AU`, "Total load"]}
            labelFormatter={(_label, payload) => {
              const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!row) return "";
              return [
                formatMonthDay(row.date),
                `Sessions: ${row.sessionCount}`,
                `Average RPE: ${formatRpe(row.averageRpe)}`,
                `Duration: ${row.totalDuration} min`,
                `Session Type: ${row.sessionTypeLabel}`,
                `Matchday: ${row.matchdayTagLabel}`,
              ].join(" · ");
            }}
          />
          <Bar dataKey="load" name="Total load" fill="#14b8a6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
