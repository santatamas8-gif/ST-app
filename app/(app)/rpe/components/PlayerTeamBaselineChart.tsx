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
  chartMetricTitle,
  chartPlayerMetricValue,
  chartTeamMetricValue,
  type PlayerTeamBaselineResult,
  type PlayerTeamChartMetric,
} from "@/lib/kioskRpe/playerTeamBaselineAnalytics";
import {
  formatAverageDuration,
  formatAverageLoad,
  formatAverageRpe,
} from "@/lib/kioskRpe/matchdayAnalytics";

const PLAYER_COLOR = "#14b8a6";
const TEAM_COLOR = "#3b82f6";

interface PlayerTeamBaselineChartProps {
  result: PlayerTeamBaselineResult;
  metric: PlayerTeamChartMetric;
  playerLabel: string;
  isHighContrast: boolean;
}

function formatMetricValue(value: number, metric: PlayerTeamChartMetric): string {
  switch (metric) {
    case "averageLoad":
      return `${formatAverageLoad(value)} AU`;
    case "averageRpe":
      return formatAverageRpe(value);
    case "averageDuration":
      return `${formatAverageDuration(value)} min`;
  }
}

export function PlayerTeamBaselineChart({
  result,
  metric,
  playerLabel,
  isHighContrast,
}: PlayerTeamBaselineChartProps) {
  const playerValue = chartPlayerMetricValue(result, metric);
  const teamValue = chartTeamMetricValue(result, metric);

  const data = [
    {
      group: playerLabel.length > 18 ? `${playerLabel.slice(0, 17)}…` : playerLabel,
      fullLabel: playerLabel,
      value: playerValue ?? 0,
      hasValue: playerValue != null,
      sessionCount: result.player.sessionCount,
      playerCount: result.player.uniquePlayerCount,
      fill: PLAYER_COLOR,
    },
    {
      group: "Team Baseline",
      fullLabel: "Team Baseline",
      value: teamValue ?? 0,
      hasValue: teamValue != null,
      sessionCount: result.team.sessionCount,
      playerCount: result.team.uniquePlayerCount,
      fill: TEAM_COLOR,
    },
  ];

  return (
    <div className="h-56 min-w-0 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isHighContrast ? "#ffffff22" : "#27272a"} />
          <XAxis
            dataKey="group"
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
              if (!payload?.hasValue) return ["—", chartMetricTitle(metric)];
              return [formatMetricValue(value, metric), chartMetricTitle(metric)];
            }}
            labelFormatter={(_label, payload) => {
              const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!row) return "";
              return `${row.fullLabel} · ${row.sessionCount} session${row.sessionCount === 1 ? "" : "s"} · ${row.playerCount} player${row.playerCount === 1 ? "" : "s"}`;
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="value" name={chartMetricTitle(metric)} radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.fullLabel} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
