"use client";

import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { Activity, BarChart2, Clock3, LayoutDashboard } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { NEON_CARD_STYLE, MATT_CARD_STYLE } from "@/lib/themes";
import type { SessionRow } from "@/lib/types";
import { formatMonthDay } from "@/lib/formatDate";
import { LoadKpiCard } from "./LoadKpiCard";
import { TeamLoadBarChart } from "./LoadBarChart";
import { RpeForm } from "@/components/RpeForm";
import { useIsMobile } from "@/components/ScheduleBottomSheet";

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

/** RPE 1–4 green, 5–7 yellow, 8+ red */
function rpeBadgeClass(rpe: number | null | undefined): string {
  if (rpe == null) return "bg-zinc-700/60 text-zinc-300";
  if (rpe <= 4) return "bg-emerald-500/15 text-emerald-300";
  if (rpe <= 7) return "bg-amber-500/15 text-amber-300";
  return "bg-red-500/20 text-red-300";
}

interface PlayerLoadViewProps {
  list: SessionRow[];
  hasSubmittedToday: boolean;
}

export type PlayerPeriodDays = 7 | 14 | 28;

export function PlayerLoadView({ list, hasSubmittedToday }: PlayerLoadViewProps) {
  const { themeId } = useTheme();
  const isMobile = useIsMobile();
  const isHighContrast = themeId === "neon" || themeId === "matt";
  const [periodDays, setPeriodDays] = useState<PlayerPeriodDays>(7);
  const [recentScrollAtEnd, setRecentScrollAtEnd] = useState(true);
  const recentScrollRef = useRef<HTMLDivElement>(null);

  const recentSessionsLast12 = useMemo(() => list.slice(0, 12), [list]);

  useEffect(() => {
    setRecentScrollAtEnd(recentSessionsLast12.length <= 5);
  }, [recentSessionsLast12.length]);

  const onRecentScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
    setRecentScrollAtEnd(atEnd);
  }, []);

  const lastN = useMemo(() => getLastNDates(periodDays), [periodDays]);
  const prevN = useMemo(() => getPrevNDates(periodDays), [periodDays]);

  const todayStr = todayISO();
  const todaySessions = useMemo(() => list.filter((s) => s.date === todayStr), [list, todayStr]);

  const { todayLoad, myLoadChartData, periodSum, trend } = useMemo(() => {
    const todayLoad = list
      .filter((s) => s.date === todayStr)
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
  }, [list, todayStr, lastN, prevN]);

  return (
    <div
      className="min-h-screen min-w-0 -mx-4 overflow-x-hidden px-3 py-8 sm:mx-0 sm:px-6 lg:px-8"
      style={{ backgroundColor: "var(--page-bg)" }}
    >
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight text-white sm:text-xl lg:text-2xl">
            <Activity className="h-6 w-6 text-emerald-400" aria-hidden />
            <span>RPE / Load</span>
          </h1>
          <p className={`mt-1 text-xs ${isHighContrast ? "text-white/80" : "text-zinc-500"}`}>
            Log duration and RPE — load is calculated automatically.
          </p>
        </div>

        {hasSubmittedToday ? (
          <>
            <div
              className={`flex items-center gap-2 rounded-xl border px-4 py-3 ${themeId === "neon" ? "neon-card-text border-emerald-500/40" : themeId === "matt" ? "matt-card-text border-white/20" : "border-emerald-800/50 bg-emerald-950/30"}`}
              style={{ borderRadius: CARD_RADIUS, ...(themeId === "neon" ? NEON_CARD_STYLE : themeId === "matt" ? MATT_CARD_STYLE : {}) }}
            >
              <span className="text-emerald-400">✔</span>
              <span className="font-medium text-emerald-400">Submitted today</span>
            </div>
            {todaySessions.length > 0 && (
              <>
                <h2 className={`mb-1.5 text-sm font-semibold uppercase tracking-wide ${isHighContrast ? "text-white/90" : "text-zinc-300"}`}>
                  Today&apos;s load
                </h2>
                <div
                  className={`overflow-hidden rounded-xl ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
                  style={{ borderRadius: CARD_RADIUS, ...(themeId === "neon" ? NEON_CARD_STYLE : themeId === "matt" ? MATT_CARD_STYLE : { backgroundColor: "var(--card-bg)" }) }}
                >
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
                      {todaySessions.map((r) => (
                        <tr key={r.id} className={isHighContrast ? "border-b border-white/10" : "border-b border-zinc-800"}>
                          <td className="px-4 py-3 text-sm">{formatMonthDay(r.date)}</td>
                          <td className="px-4 py-3 tabular-nums text-sm">{r.duration}</td>
                          <td className="px-4 py-3">
                            {r.rpe == null ? (
                              <span className={isHighContrast ? "text-white/60" : "text-zinc-400"}>—</span>
                            ) : (
                              <span className={`inline-flex min-w-[2rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${rpeBadgeClass(r.rpe)}`}>
                                {r.rpe}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm tabular-nums">{r.load ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              </>
            )}
          </>
        ) : (
          <RpeForm hasSubmittedToday={false} />
        )}

            {/* Overview – your load */}
            <section className="space-y-4">
              <h2 className={`flex items-center gap-2 border-b pb-3 text-sm font-bold uppercase tracking-wider ${isHighContrast ? "border-white/20 text-white/90" : "border-zinc-700 text-zinc-200"}`}>
                <LayoutDashboard className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
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
            <section className="space-y-4">
              <h2 className={`flex items-center gap-2 border-b pb-3 text-sm font-bold uppercase tracking-wider ${isHighContrast ? "border-white/20 text-white/90" : "border-zinc-700 text-zinc-200"}`}>
                <BarChart2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                Charts
              </h2>
              <div className="flex flex-col gap-4">
                <div
                  className={`rounded-xl p-4 ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
                  style={{ borderRadius: CARD_RADIUS, ...(themeId === "neon" ? NEON_CARD_STYLE : themeId === "matt" ? MATT_CARD_STYLE : { backgroundColor: "var(--card-bg)" }) }}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className={`text-base font-bold uppercase tracking-wide ${isHighContrast ? "text-white/90" : "text-zinc-200"}`}>
                      My load
                    </span>
                    <div
                      className={`inline-flex shrink-0 border p-0.5 ${isMobile ? "h-9 rounded-[11px]" : "h-10 rounded-[14px]"}`}
                      style={{
                        backgroundColor: isHighContrast ? "rgba(255,255,255,0.06)" : "rgba(15,23,32,0.9)",
                        borderColor: isHighContrast ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.08)",
                      }}
                    >
                      {([7, 14, 28] as const).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setPeriodDays(n)}
                          className={`flex-1 font-medium transition-all duration-200 ${isMobile ? "min-w-[60px] rounded-[9px] text-xs" : "min-w-[76px] rounded-[10px] text-sm"} ${
                            periodDays === n
                              ? "bg-emerald-700/90 text-white"
                              : "bg-transparent text-gray-400 hover:text-gray-300 hover:bg-white/5 active:bg-white/10"
                          }`}
                        >
                          {n} days
                        </button>
                      ))}
                    </div>
                  </div>
                  <TeamLoadBarChart
                    data={myLoadChartData}
                    trend={trend}
                    periodDays={periodDays}
                    titleOverride={isMobile ? `Last ${periodDays} days` : `Last ${periodDays} days – My load`}
                  />
                </div>
              </div>
            </section>

            {/* Recent sessions table – last 12 sessions, max 5 visible, scroll + fade */}
            <section className="space-y-4">
              <h2 className={`flex items-center gap-2 border-b pb-3 text-sm font-bold uppercase tracking-wider ${isHighContrast ? "border-white/20 text-white/90" : "border-zinc-700 text-zinc-200"}`}>
                <Clock3 className="h-4 w-4 text-emerald-400" aria-hidden />
                <span>Recent sessions</span>
              </h2>
              <p className={`text-xs ${isHighContrast ? "text-white/60" : "text-zinc-500"}`}>Last 12 sessions · scroll for more</p>
              <div
                className={`relative overflow-hidden rounded-xl ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
                style={{ borderRadius: CARD_RADIUS, ...(themeId === "neon" ? NEON_CARD_STYLE : themeId === "matt" ? MATT_CARD_STYLE : { backgroundColor: "var(--card-bg)" }) }}
              >
                {recentSessionsLast12.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <Activity className={`h-8 w-8 ${isHighContrast ? "text-white/50" : "text-zinc-500"}`} aria-hidden />
                    <p className={isHighContrast ? "text-white/80" : "text-zinc-400"}>No sessions yet.</p>
                    <p className={`text-xs ${isHighContrast ? "text-white/60" : "text-zinc-500"}`}>Log your first session above.</p>
                  </div>
                ) : (
                  <>
                    <div
                      ref={recentScrollRef}
                      onScroll={onRecentScroll}
                      className="overflow-x-auto overflow-y-auto"
                      style={{ maxHeight: 280 }}
                    >
                      <table className="w-full text-left text-sm">
                        <thead
                          className={`sticky top-0 z-20 border-b ${isHighContrast ? "border-white/20 text-white/80" : "border-zinc-700 text-zinc-400"}`}
                          style={{ backgroundColor: "var(--card-bg)" }}
                        >
                          <tr>
                            <th className="px-4 py-3 font-medium">Date</th>
                            <th className="px-4 py-3 font-medium">Duration (min)</th>
                            <th className="px-4 py-3 font-medium">RPE</th>
                            <th className="px-4 py-3 font-medium">Load</th>
                          </tr>
                        </thead>
                        <tbody className={isHighContrast ? "text-white/90" : "text-zinc-300"}>
                          {recentSessionsLast12.map((r, index) => {
                            const isFirst = index === 0;
                            return (
                              <tr
                                key={r.id}
                                className={`border-b ${isHighContrast ? "border-white/10" : "border-zinc-800"} ${
                                  isFirst ? (isHighContrast ? "bg-white/5" : "bg-zinc-900/40") : isHighContrast ? "hover:bg-white/5" : "hover:bg-zinc-900/30"
                                }`}
                              >
                                <td className="px-4 py-3 text-sm">{formatMonthDay(r.date)}</td>
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
                    {recentSessionsLast12.length > 5 && !recentScrollAtEnd && (
                      <div
                        className="pointer-events-none absolute bottom-0 left-0 right-0 h-12"
                        style={{
                          background: "linear-gradient(to top, var(--card-bg) 0%, var(--card-bg) 35%, transparent 100%)",
                        }}
                        aria-hidden
                      />
                    )}
                  </>
                )}
              </div>
            </section>
      </div>
    </div>
  );
}
