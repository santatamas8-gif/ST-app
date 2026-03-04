"use client";

import { useMemo, useState } from "react";
import { Activity, Clock3 } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { NEON_CARD_STYLE, MATT_CARD_STYLE } from "@/lib/themes";
import type { SessionRow } from "@/lib/types";
import { LoadKpiCard } from "./LoadKpiCard";
import { TeamLoadBarChart } from "./LoadBarChart";
import { RpeForm } from "@/components/RpeForm";

const CARD_RADIUS = "12px";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getLastNDates(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function getPrevNDates(n: number): string[] {
  const out: string[] = [];
  for (let i = n * 2 - 1; i >= n; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function rpeBadgeClass(rpe: number | null | undefined): string {
  if (rpe == null) return "bg-zinc-700/60 text-zinc-300";
  if (rpe <= 3) return "bg-emerald-500/15 text-emerald-300";
  if (rpe <= 6) return "bg-amber-500/15 text-amber-300";
  return "bg-red-500/20 text-red-300";
}

interface PlayerLoadViewProps {
  list: SessionRow[];
  hasSubmittedToday: boolean;
}

export type PlayerPeriodDays = 7 | 14 | 28;

export function PlayerLoadView({ list, hasSubmittedToday }: PlayerLoadViewProps) {
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [periodDays, setPeriodDays] = useState<PlayerPeriodDays>(7);

  const lastN = useMemo(() => getLastNDates(periodDays), [periodDays]);
  const prevN = useMemo(() => getPrevNDates(periodDays), [periodDays]);

  const { todayLoad, myLoadChartData, periodSum, trend } = useMemo(() => {
    const todayLoad = list
      .filter((s) => s.date === selectedDate)
      .reduce((a, s) => a + (s.load ?? 0), 0);
    const myLoadChartData = lastN.map((date) => ({
      date,
      load: list.filter((s) => s.date === date).reduce((a, s) => a + (s.load ?? 0), 0),
    }));
    const periodSum = myLoadChartData.reduce((a, d) => a + d.load, 0);
    const prevSum = list
      .filter((s) => prevN.includes(s.date))
      .reduce((a, s) => a + (s.load ?? 0), 0);
    const trend: "up" | "down" | "stable" =
      prevSum === 0 ? "stable" : periodSum > prevSum ? "up" : periodSum < prevSum ? "down" : "stable";
    return { todayLoad, myLoadChartData, periodSum, trend };
  }, [list, selectedDate, lastN, prevN]);

  return (
    <div
      className="min-h-screen px-4 py-8 sm:px-6 lg:px-8"
      style={{ backgroundColor: "var(--page-bg)" }}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight text-white sm:text-xl lg:text-2xl">
            <Activity className="h-6 w-6 text-emerald-400" aria-hidden />
            <span>RPE / Load</span>
          </h1>
          <p className={`mt-1 ${isHighContrast ? "text-white/90" : "text-zinc-400"}`}>
            Your sessions and load. Log duration and RPE; load is calculated automatically.
          </p>
        </div>

        <RpeForm hasSubmittedToday={hasSubmittedToday} />

        {/* Date */}
        <div
          className={`flex flex-wrap items-center gap-4 rounded-xl p-4 ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
          style={{ borderRadius: CARD_RADIUS, ...(themeId === "neon" ? NEON_CARD_STYLE : themeId === "matt" ? MATT_CARD_STYLE : { backgroundColor: "var(--card-bg)" }) }}
        >
          <label className={`flex items-center gap-2 text-sm ${isHighContrast ? "text-white/90" : "text-zinc-400"}`}>
            Date
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-9 rounded border border-zinc-700 bg-zinc-800/80 px-2 py-1 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </label>
          <button
            type="button"
            onClick={() => setSelectedDate(todayISO())}
            className="h-9 rounded border border-zinc-600 bg-zinc-800/80 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700/80"
          >
            Today
          </button>
        </div>

        {/* Overview – your load */}
        <section className="space-y-3">
          <h2 className={`border-b pb-2 text-sm font-bold uppercase tracking-wider ${isHighContrast ? "border-white/20 text-white/90" : "border-zinc-700 text-zinc-200"}`}>
            Overview
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
            <LoadKpiCard label="Today's load" value={todayLoad} status="normal" />
            <LoadKpiCard
              label={`Last ${periodDays} days total`}
              value={periodSum}
              status="normal"
            />
          </div>
        </section>

        {/* Charts – your load 7/14/28 days */}
        <section className="space-y-3">
          <h2 className={`border-b pb-2 text-sm font-bold uppercase tracking-wider ${isHighContrast ? "border-white/20 text-white/90" : "border-zinc-700 text-zinc-200"}`}>
            Charts
          </h2>
          <div className="flex flex-col gap-4">
            <div
              className={`rounded-xl p-4 ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
              style={{ borderRadius: CARD_RADIUS, ...(themeId === "neon" ? NEON_CARD_STYLE : themeId === "matt" ? MATT_CARD_STYLE : { backgroundColor: "var(--card-bg)" }) }}
            >
              <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div />
                <span className={`text-center text-base font-bold uppercase tracking-wide ${isHighContrast ? "text-white/90" : "text-zinc-200"}`}>
                  My load (7 / 14 / 28 days)
                </span>
                <div className="flex w-fit justify-end flex-nowrap items-center gap-0.5 rounded-lg border border-zinc-700 bg-zinc-800/50 p-1">
                  {([7, 14, 28] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPeriodDays(n)}
                      className={`h-8 w-9 rounded-md text-sm font-semibold transition shrink-0 ${
                        periodDays === n
                          ? "bg-emerald-600/30 text-emerald-400"
                          : "text-zinc-400 hover:bg-zinc-700/80 hover:text-white"
                      }`}
                    >
                      {n}d
                    </button>
                  ))}
                </div>
              </div>
              <TeamLoadBarChart
                data={myLoadChartData}
                trend={trend}
                periodDays={periodDays}
                titleOverride={`Last ${periodDays} days – My load`}
              />
            </div>
          </div>
        </section>

        {/* Recent sessions table */}
        <section className="space-y-2">
          <h2 className={`flex items-center gap-2 border-b pb-2 text-sm font-bold uppercase tracking-wider ${isHighContrast ? "border-white/20 text-white/90" : "border-zinc-700 text-zinc-200"}`}>
            <Clock3 className="h-4 w-4 text-emerald-400" aria-hidden />
            <span>Recent sessions</span>
          </h2>
          <div
            className={`overflow-hidden rounded-xl ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
            style={{ borderRadius: CARD_RADIUS, ...(themeId === "neon" ? NEON_CARD_STYLE : themeId === "matt" ? MATT_CARD_STYLE : { backgroundColor: "var(--card-bg)" }) }}
          >
            {list.length === 0 ? (
              <p className={`py-8 text-center ${isHighContrast ? "text-white/80" : "text-zinc-400"}`}>No sessions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className={isHighContrast ? "bg-white/5" : "bg-zinc-900/95"}>
                    <tr className={`border-b ${isHighContrast ? "border-white/20 text-white/80" : "border-zinc-700 text-zinc-400"}`}>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Duration (min)</th>
                      <th className="px-4 py-3 font-medium">RPE</th>
                      <th className="px-4 py-3 font-medium">Load</th>
                    </tr>
                  </thead>
                  <tbody className={isHighContrast ? "text-white/90" : "text-zinc-300"}>
                    {list.slice(0, 28).map((r, index) => {
                      const isFirst = index === 0;
                      return (
                        <tr
                          key={r.id}
                          className={`border-b ${isHighContrast ? "border-white/10" : "border-zinc-800"} ${
                            isFirst ? (isHighContrast ? "bg-white/5" : "bg-zinc-900/40") : isHighContrast ? "hover:bg-white/5" : "hover:bg-zinc-900/30"
                          }`}
                        >
                          <td className="px-4 py-3 text-sm">{r.date}</td>
                          <td className="px-4 py-3 tabular-nums text-sm">{r.duration}</td>
                          <td className="px-4 py-3">
                            {r.rpe == null ? (
                              <span className={isHighContrast ? "text-white/60" : "text-zinc-400"}>—</span>
                            ) : (
                              <span
                                className={`inline-flex min-w-[2rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${rpeBadgeClass(
                                  r.rpe
                                )}`}
                              >
                                {r.rpe}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm tabular-nums">{r.load ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
