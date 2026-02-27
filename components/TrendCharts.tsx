"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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

type Tab28 = "load" | "wellness" | "sleep";

export function TrendCharts({ chart7, chart28 }: TrendChartsProps) {
  const [tab28, setTab28] = useState<Tab28>("load");

  const data7 = chart7.map((p) => ({
    ...p,
    dateLabel: formatDate(p.date),
  }));
  const data28 = chart28.map((p) => ({
    ...p,
    dateLabel: formatDate(p.date),
  }));

  const chartClass = "rounded-xl border border-zinc-800/90 bg-zinc-900/50 p-4 transition-all duration-200 hover:shadow-[var(--card-shadow-hover)]";
  const chartStyle = { boxShadow: "var(--card-shadow)" };

  return (
    <div className="space-y-6">
      {/* 7-day: Load only */}
      <div className={chartClass} style={chartStyle}>
        <h3 className="text-sm font-medium text-zinc-400">Load (last 7 days)</h3>
        <p className="mt-0.5 text-xs text-zinc-500">Training load over the past week.</p>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data7} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="areaLoadGradient" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.45} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
              <XAxis dataKey="dateLabel" stroke="#71717a" tick={{ fontSize: 11 }} />
              <YAxis stroke="#71717a" tick={{ fontSize: 11 }} tickFormatter={(v) => (v ? String(v) : "0")} />
              <Tooltip
                contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "8px" }}
                labelStyle={{ color: "#a1a1aa" }}
                formatter={(value: number) => [value, "Load"]}
                labelFormatter={(label) => label}
              />
              <Area
                type="monotone"
                dataKey="load"
                name="Load"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#areaLoadGradient)"
                isAnimationActive
                animationDuration={600}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 28-day: one metric at a time (tabs) */}
      <div className={chartClass} style={chartStyle}>
        <h3 className="text-sm font-medium text-zinc-400">28-day trend</h3>
        <div className="mt-2 flex gap-2">
          {(["load", "wellness", "sleep"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab28(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors duration-200 ${
                tab28 === t ? "bg-emerald-600 text-white" : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
              }`}
            >
              {t === "load" ? "Load" : t === "wellness" ? "Wellness" : "Sleep (h/night)"}
            </button>
          ))}
        </div>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data28} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
              <XAxis dataKey="dateLabel" stroke="#71717a" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis
                stroke="#71717a"
                tick={{ fontSize: 11 }}
                domain={tab28 === "load" ? undefined : tab28 === "wellness" ? [0, 10] : [0, 12]}
                tickFormatter={(v) => (v != null ? String(v) : "—")}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: "8px" }}
                labelStyle={{ color: "#a1a1aa" }}
                formatter={(value: number) => [value?.toFixed?.(1) ?? value ?? "—", tab28 === "load" ? "Load" : tab28 === "wellness" ? "Wellness" : "Sleep (h/night)"]}
                labelFormatter={(label) => label}
              />
              {tab28 === "load" && (
                <Line
                  type="monotone"
                  dataKey="load"
                  name="Load"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive
                  animationDuration={500}
                  animationEasing="ease-out"
                />
              )}
              {tab28 === "wellness" && (
                <Line
                  type="monotone"
                  dataKey="wellness"
                  name="Wellness"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive
                  animationDuration={500}
                  animationEasing="ease-out"
                />
              )}
              {tab28 === "sleep" && (
                <Line
                  type="monotone"
                  dataKey="sleepHours"
                  name="Sleep (h/night)"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive
                  animationDuration={500}
                  animationEasing="ease-out"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
