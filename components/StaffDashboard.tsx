"use client";

import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const BG_PAGE = "#0b0f14";
const BG_CARD = "#11161c";
const CARD_RADIUS = "12px";

type AtRiskPlayer = {
  user_id: string;
  email: string;
  reason?: string;
  wellness?: number | null;
  fatigue?: number | null;
  load?: number;
};

type StaffDashboardProps = {
  metrics: {
    todayWellnessCount?: number;
    totalPlayers?: number;
    todayWellness?: number | null;
    totalTeamLoadToday?: number;
  };
  attentionToday: {
    missingWellness: { user_id: string; email: string }[];
    atRisk: AtRiskPlayer[];
  } | null;
  chart7: { date: string; load: number; wellness: number | null }[];
};

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
}

export function StaffDashboard({
  metrics,
  attentionToday,
  chart7,
}: StaffDashboardProps) {
  const totalPlayers = metrics.totalPlayers ?? 0;
  const submitted = metrics.todayWellnessCount ?? 0;
  const avgWellness = metrics.todayWellness ?? null;
  const totalLoad = metrics.totalTeamLoadToday ?? 0;
  const atRisk = attentionToday?.atRisk ?? [];
  const highRiskCount = atRisk.length;

  const submissionPct = totalPlayers > 0 ? Math.round((submitted / totalPlayers) * 100) : 0;

  const wellnessColor =
    avgWellness == null
      ? "text-zinc-400"
      : avgWellness > 7
        ? "text-emerald-400"
        : avgWellness >= 5
          ? "text-amber-400"
          : "text-red-400";

  const chartDataWellness =
    chart7.length > 0
      ? chart7.map((p) => ({
          date: formatShortDate(p.date),
          wellness: p.wellness ?? 0,
        }))
      : [];
  const chartDataLoad =
    chart7.length > 0
      ? chart7.map((p) => ({
          date: formatShortDate(p.date),
          load: p.load,
        }))
      : [];
  const donutData = [
    { name: "Submitted", value: submitted, color: "#10b981" },
    { name: "Missing", value: Math.max(0, totalPlayers - submitted), color: "#3f3f46" },
  ].filter((d) => d.value > 0);

  return (
    <div
      className="min-h-screen px-4 py-8 sm:px-6 lg:px-8"
      style={{ backgroundColor: BG_PAGE }}
    >
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Performance Dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Elite football – today&apos;s overview
          </p>
        </div>

        {/* SECTION 1 – TOP KPI ROW */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            <p className="text-sm font-medium text-zinc-400">
              Players Submitted Today
            </p>
            <p className="mt-2 text-2xl font-bold text-white">
              {submitted} <span className="text-zinc-500">/ {totalPlayers}</span>
            </p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{
                  width: totalPlayers ? `${(submitted / totalPlayers) * 100}%` : "0%",
                }}
              />
            </div>
          </div>

          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            <p className="text-sm font-medium text-zinc-400">
              Average Wellness Score Today
            </p>
            <p className={`mt-2 text-3xl font-bold ${wellnessColor}`}>
              {avgWellness != null ? avgWellness.toFixed(1) : "—"}
            </p>
          </div>

          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            <p className="text-sm font-medium text-zinc-400">
              Total Team Load Today
            </p>
            <p className="mt-2 text-3xl font-bold text-white">{totalLoad}</p>
          </div>

          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            <p className="text-sm font-medium text-zinc-400">
              High Risk Players
            </p>
            <p className="mt-2 text-3xl font-bold text-white">
              {highRiskCount}
              {highRiskCount > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-red-500/20 px-2 py-0.5 text-sm font-medium text-red-400">
                  Alert
                </span>
              )}
            </p>
          </div>
        </div>

        {/* SECTION 2 – AT RISK PLAYERS PANEL */}
        <div
          className="rounded-xl p-5"
          style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
        >
          <h2 className="text-lg font-semibold text-white">
            ⚠ At Risk Players
          </h2>
          {atRisk.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {atRisk.map((p) => {
                const w = p.wellness ?? 0;
                const f = p.fatigue ?? 0;
                const critical = w < 5 || f > 7;
                const badge = critical ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400";
                return (
                  <li
                    key={p.user_id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-900/60 px-4 py-3"
                  >
                    <Link
                      href={`/players/${p.user_id}`}
                      className="font-medium text-white hover:text-emerald-400 hover:underline"
                    >
                      {p.email}
                    </Link>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-zinc-400">
                        Wellness: {p.wellness != null ? p.wellness.toFixed(1) : "—"}
                      </span>
                      <span className="text-zinc-400">
                        Fatigue: {p.fatigue ?? "—"}
                      </span>
                      <span className="text-zinc-400">Load: {p.load ?? 0}</span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${badge}`}
                      >
                        {critical ? "Critical" : "Warning"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 rounded-lg bg-emerald-500/10 px-4 py-3 text-emerald-400">
              All players within safe range
            </p>
          )}
        </div>

        {/* SECTION 3 – MINI CHARTS ROW */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            <h3 className="text-sm font-medium text-zinc-400">
              Last 7 days – Average wellness
            </h3>
            <div className="mt-3 h-40">
              {chartDataWellness.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartDataWellness} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#71717a" tick={{ fontSize: 10 }} domain={[0, 10]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: BG_CARD,
                        border: "1px solid #27272a",
                        borderRadius: "8px",
                      }}
                      formatter={(v: number) => [v.toFixed(1), "Wellness"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="wellness"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ fill: "#10b981" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                  No data
                </div>
              )}
            </div>
          </div>

          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            <h3 className="text-sm font-medium text-zinc-400">
              Last 7 days – Team load
            </h3>
            <div className="mt-3 h-40">
              {chartDataLoad.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDataLoad} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
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
                    <Bar dataKey="load" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                  No data
                </div>
              )}
            </div>
          </div>

          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            <h3 className="text-sm font-medium text-zinc-400">
              Submission compliance %
            </h3>
            <div className="mt-3 h-40">
              {donutData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                    >
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: BG_CARD,
                        border: "1px solid #27272a",
                        borderRadius: "8px",
                      }}
                      formatter={(v: number, name: string) => [
                        totalPlayers ? `${Math.round((v / totalPlayers) * 100)}%` : "0%",
                        name,
                      ]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                  No players
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/wellness"
            className="block rounded-xl p-4 transition opacity-90 hover:opacity-100"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            <span className="font-medium text-white">Wellness summary</span>
            <p className="mt-1 text-sm text-zinc-400">View all entries</p>
          </Link>
          <Link
            href="/rpe"
            className="block rounded-xl p-4 transition opacity-90 hover:opacity-100"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            <span className="font-medium text-white">RPE / sessions</span>
            <p className="mt-1 text-sm text-zinc-400">View all entries</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
