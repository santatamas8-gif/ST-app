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
} from "recharts";

const BG_CARD = "#11161c";

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
}

/** Team load: last 7 days, one bar per day */
interface TeamLoadBarChartProps {
  data: { date: string; load: number }[];
  trend?: "up" | "down" | "stable";
  className?: string;
}

export function TeamLoadBarChart({
  data,
  trend = "stable",
  className = "",
}: TeamLoadBarChartProps) {
  const chartData = data.map((d) => ({
    date: formatShortDate(d.date),
    load: d.load,
  }));
  const trendLabel = trend === "up" ? "↑ Növekvő" : trend === "down" ? "↓ Csökkenő" : "→ Stabile";

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-400">Utolsó 7 nap – Csapat terhelés</h3>
        <span
          className={`text-xs font-medium ${
            trend === "up" ? "text-amber-400" : trend === "down" ? "text-emerald-400" : "text-zinc-400"
          }`}
        >
          {trendLabel}
        </span>
      </div>
      <div className="h-48">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 10 }} />
              <YAxis stroke="#71717a" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: BG_CARD,
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
            Nincs adat
          </div>
        )}
      </div>
    </div>
  );
}

/** Player load bars: one bar per player (or per day for one player). spikePercent optional for color */
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
      <h3 className="mb-2 text-sm font-medium text-zinc-400">Játékos terhelés (napi load)</h3>
      <div className="h-64">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis type="number" stroke="#71717a" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="label" stroke="#71717a" tick={{ fontSize: 10 }} width={55} />
              <Tooltip
                contentStyle={{
                  backgroundColor: BG_CARD,
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                }}
                formatter={(v: number, _: unknown, props: { payload?: { spikePercent?: number } }) =>
                  [v, props.payload?.spikePercent != null ? `Spike: ${(props.payload.spikePercent * 100).toFixed(0)}%` : "Load"]
                }
              />
              <Bar dataKey="load" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            Nincs adat
          </div>
        )}
      </div>
    </div>
  );
}
