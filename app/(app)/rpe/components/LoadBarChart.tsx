"use client";

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LabelList,
} from "recharts";


function formatShortDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
}

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
                  value,
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
    date: formatShortDate(d.date),
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
                formatter={(v: number) => [v, "Load"]}
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
  data: { label: string; load: number; spikePercent?: number | null }[];
  className?: string;
}

export function PlayerLoadBarChart({ data, className = "" }: PlayerLoadBarChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    fill: d.spikePercent != null && d.spikePercent >= 0.3 ? "#ef4444" : d.spikePercent != null && d.spikePercent >= 0.2 ? "#f59e0b" : "#10b981",
  }));

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
                formatter={(v: number, _: unknown, props: { payload?: { spikePercent?: number } }) =>
                  [v, props.payload?.spikePercent != null ? `Spike: ${(props.payload.spikePercent * 100).toFixed(0)}%` : "Load"]
                }
              />
              <Bar dataKey="load" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
                <LabelList dataKey="load" position="right" fill="#a1a1aa" fontSize={11} />
              </Bar>
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
