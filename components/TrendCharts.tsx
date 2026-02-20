"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from "recharts";
import type { ChartPoint } from "@/lib/dashboard";

interface TrendChartsProps {
  chart7: ChartPoint[];
  chart28: ChartPoint[];
}

function formatDate(label: string) {
  const d = new Date(label);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TrendCharts({ chart7, chart28 }: TrendChartsProps) {
  const data7 = chart7.map((p) => ({
    ...p,
    dateLabel: formatDate(p.date),
  }));
  const data28 = chart28.map((p) => ({
    ...p,
    dateLabel: formatDate(p.date),
  }));

  const chartClass = "rounded-xl border border-zinc-800 bg-zinc-900/50 p-4";

  return (
    <div className="space-y-6">
      <div className={chartClass}>
        <h3 className="mb-4 text-sm font-medium text-zinc-400">
          7-day trend
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data7} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
              <XAxis
                dataKey="dateLabel"
                stroke="#71717a"
                tick={{ fontSize: 11 }}
              />
              <YAxis
                yAxisId="load"
                stroke="#71717a"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => (v ? String(v) : "0")}
              />
              <YAxis
                yAxisId="wellness"
                orientation="right"
                stroke="#71717a"
                tick={{ fontSize: 11 }}
                domain={[0, 10]}
                tickFormatter={(v) => (v ? String(v) : "—")}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "#a1a1aa" }}
                formatter={(value: number, name: string) => [
                  name === "Load" ? value : value?.toFixed(1) ?? "—",
                  name,
                ]}
                labelFormatter={(label) => label}
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value) => (
                  <span className="text-zinc-400">{value}</span>
                )}
              />
              <Area
                yAxisId="load"
                type="monotone"
                dataKey="load"
                name="Load"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.2}
                strokeWidth={2}
              />
              <Line
                yAxisId="wellness"
                type="monotone"
                dataKey="wellness"
                name="Wellness"
                stroke="#a78bfa"
                strokeWidth={2}
                dot={{ r: 2 }}
                connectNulls
              />
              <Line
                yAxisId="wellness"
                type="monotone"
                dataKey="sleepHours"
                name="Sleep (h)"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={{ r: 2 }}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={chartClass}>
        <h3 className="mb-4 text-sm font-medium text-zinc-400">
          28-day trend
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data28}
              margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
              <XAxis
                dataKey="dateLabel"
                stroke="#71717a"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="load"
                stroke="#71717a"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => (v ? String(v) : "0")}
              />
              <YAxis
                yAxisId="wellness"
                orientation="right"
                stroke="#71717a"
                tick={{ fontSize: 11 }}
                domain={[0, 12]}
                tickFormatter={(v) => (v ? String(v) : "—")}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "#a1a1aa" }}
                formatter={(value: number, name: string) => [
                  name === "Load" ? value : value?.toFixed(1) ?? "—",
                  name,
                ]}
                labelFormatter={(label) => label}
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value) => (
                  <span className="text-zinc-400">{value}</span>
                )}
              />
              <Line
                yAxisId="load"
                type="monotone"
                dataKey="load"
                name="Load"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="wellness"
                type="monotone"
                dataKey="wellness"
                name="Wellness"
                stroke="#a78bfa"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                yAxisId="wellness"
                type="monotone"
                dataKey="sleepHours"
                name="Sleep (h)"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
