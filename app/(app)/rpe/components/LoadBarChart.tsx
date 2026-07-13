"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LabelList,
  Cell,
} from "recharts";
import { formatDayShort } from "@/lib/formatDate";

/** Two weeks comparison: 7 days, two bars per day (Week 1 vs Week 2) */
export interface TwoWeekDataPoint {
  day: string;
  label: string;
  loadW1: number;
  loadW2: number;
}

interface TwoWeekComparisonChartProps {
  data: TwoWeekDataPoint[];
  week1Label: string;
  week2Label: string;
  title: string;
  className?: string;
}

export function TwoWeekComparisonChart({
  data,
  week1Label,
  week2Label,
  title,
  className = "",
}: TwoWeekComparisonChartProps) {
  return (
    <div className={className}>
      <h3 className="mb-2 text-sm font-medium text-zinc-400">{title}</h3>
      <div className="h-56">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="label" stroke="#71717a" tick={{ fontSize: 10 }} />
              <YAxis stroke="#71717a" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card-bg)",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                }}
                formatter={(value: number, name: string) => [
                  `${Math.round(value).toLocaleString("en-GB")} AU`,
                  name === "loadW1" ? week1Label : week2Label,
                ]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.day ?? ""}
              />
              <Legend
                formatter={(value) => (value === "loadW1" ? week1Label : week2Label)}
                wrapperStyle={{ fontSize: 11 }}
              />
              <Bar dataKey="loadW1" name="loadW1" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="loadW2" name="loadW2" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            No data
          </div>
        )}
      </div>
    </div>
  );
}

/** Team load: one bar per day over the selected period */
interface TeamLoadBarChartProps {
  data: { date: string; load: number }[];
  trend?: "up" | "down" | "stable";
  /** e.g. 7, 14, 28 for title "Last N days – Team load" */
  periodDays?: number;
  /** If set, use instead of "Last N days – Team load" (e.g. "Last N days – My load") */
  titleOverride?: string;
  className?: string;
}

export function TeamLoadBarChart({
  data,
  trend = "stable",
  periodDays = 7,
  titleOverride,
  className = "",
}: TeamLoadBarChartProps) {
  const chartData = data.map((d) => ({
    date: formatDayShort(d.date),
    load: d.load,
  }));
  const trendLabel = trend === "up" ? "↑ Rising" : trend === "down" ? "↓ Falling" : "→ Stable";
  const title = titleOverride ?? `Last ${periodDays} days – Team load`;

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-400">{title}</h3>
        <span
          className={`text-xs font-medium ${
            trend === "up" ? "text-amber-400" : trend === "down" ? "text-emerald-400" : "text-zinc-400"
          }`}
        >
          {trendLabel}
        </span>
      </div>
      <div className={periodDays <= 7 ? "h-48" : periodDays === 14 ? "h-56" : "h-64"}>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 10 }} />
              <YAxis stroke="#71717a" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card-bg)",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                }}
                formatter={(v: number) => [`${Math.round(v).toLocaleString("en-GB")} AU`, "Load"]}
              />
              <Bar dataKey="load" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            No data
          </div>
        )}
      </div>
    </div>
  );
}

/** Player load: vertical bars, names on X (bottom), load on Y, value beside bar */
interface PlayerLoadBarChartProps {
  data: { label: string; playerName?: string; load: number; sessionCount?: number }[];
  className?: string;
}

function playerLoadBarColor(load: number): string {
  if (load >= 600) return "#f59e0b";
  if (load >= 400) return "#22c55e";
  if (load >= 250) return "#14b8a6";
  return "#38bdf8";
}

export function PlayerLoadBarChart({ data, className = "" }: PlayerLoadBarChartProps) {
  const chartData = data;

  return (
    <div className={className}>
      <div className="h-64">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 24, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#71717a"
                tick={{ fontSize: 10 }}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={56}
              />
              <YAxis stroke="#71717a" tick={{ fontSize: 10 }} width={36} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card-bg)",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                }}
                formatter={(v: number) => [`${Math.round(v).toLocaleString("en-GB")} AU`, "Total load"]}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as (typeof chartData)[number] | undefined;
                  if (!row) return "";
                  const sessions =
                    row.sessionCount == null
                      ? ""
                      : ` · ${row.sessionCount} session${row.sessionCount === 1 ? "" : "s"}`;
                  return `${row.playerName ?? row.label}${sessions}`;
                }}
              />
              <Bar dataKey="load" radius={[4, 4, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell key={entry.label} fill={playerLoadBarColor(entry.load)} />
                ))}
                <LabelList
                  dataKey="load"
                  position="right"
                  fill="#a1a1aa"
                  fontSize={11}
                  formatter={(value: number) => Math.round(value).toLocaleString("en-GB")}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            No RPE sessions were submitted for this date.
          </div>
        )}
      </div>
    </div>
  );
}
