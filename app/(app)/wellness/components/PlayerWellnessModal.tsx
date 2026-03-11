"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { WellnessRow } from "@/lib/types";
import { wellnessAverageFromRow, averageWellness, averageSleepHours } from "@/utils/wellness";
import { formatSleepDuration } from "@/utils/sleep";
import { getBodyPartLabel } from "@/lib/bodyMapParts";
import { Gauge, Moon, BatteryLow, Activity, Brain, Smile, Pill } from "lucide-react";
import { BodyMapViewOnly } from "@/components/BodyMap";
import { BadgeScore } from "./BadgeScore";

const CARD_RADIUS = "12px";

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
}

interface PlayerWellnessModalProps {
  playerName: string;
  userId: string;
  allRows: WellnessRow[];
  onClose: () => void;
}

export function PlayerWellnessModal({
  playerName,
  userId,
  allRows,
  onClose,
}: PlayerWellnessModalProps) {
  const sortedByDate = useMemo(
    () =>
      allRows
        .filter((r) => r.user_id === userId)
        .sort((a, b) => (b.date > a.date ? 1 : -1)),
    [allRows, userId]
  );
  const last7 = useMemo(() => sortedByDate.slice(0, 7), [sortedByDate]);
  const last28 = useMemo(() => sortedByDate.slice(0, 28), [sortedByDate]);
  const latest = sortedByDate[0] ?? null;
  const hasEnoughHistory = last7.length >= 2;

  const avg7Wellness = useMemo(() => averageWellness(last7), [last7]);
  const avg7Sleep = useMemo(() => averageSleepHours(last7), [last7]);
  const avg28Wellness = useMemo(() => averageWellness(last28), [last28]);
  const avg28Sleep = useMemo(() => averageSleepHours(last28), [last28]);

  const chartWellness = useMemo(
    () =>
      last7
        .slice()
        .reverse()
        .map((r) => ({
          date: formatShortDate(r.date),
          wellness: wellnessAverageFromRow(r) ?? 0,
        })),
    [last7]
  );
  const chartSleep = useMemo(
    () =>
      last7
        .slice()
        .reverse()
        .map((r) => ({
          date: formatShortDate(r.date),
          hours: r.sleep_duration ?? 0,
        })),
    [last7]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ backgroundColor: "rgba(0,0,0,0.72)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-zinc-600/70 p-8 shadow-2xl ring-1 ring-white/[0.06]"
        style={{ backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-600/80 pb-4">
          <h2 id="modal-title" className="text-xl font-bold tracking-tight text-white">
            {playerName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors active:scale-95"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-3 flex justify-center">
          <span className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200/95 shadow-sm ring-1 ring-emerald-500/20">
            Today&apos;s wellness
          </span>
        </div>

        {latest && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-zinc-400 pl-1 border-l-2 border-zinc-600">Latest values</h3>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl border border-zinc-600/70 bg-zinc-900/40 px-3 py-2.5 sm:grid-cols-3">
              <div className="flex items-center gap-2 rounded-md py-1 transition-colors hover:bg-zinc-800/40">
                <Gauge className="h-3.5 w-3.5 shrink-0 text-emerald-400/80" aria-hidden />
                <span className="min-w-0 truncate text-xs text-zinc-200">Readiness</span>
                <BadgeScore value={wellnessAverageFromRow(latest)} type="goodHigh" />
              </div>
              <div className="flex items-center gap-2 rounded-md py-1 transition-colors hover:bg-zinc-800/40">
                <Moon className="h-3.5 w-3.5 shrink-0 text-emerald-400/80" aria-hidden />
                <span className="min-w-0 truncate text-xs text-zinc-200">Sleep quality</span>
                <BadgeScore value={latest.sleep_quality} type="goodHigh" />
              </div>
              <div className="flex items-center gap-2 rounded-md py-1 transition-colors hover:bg-zinc-800/40">
                <BatteryLow className="h-3.5 w-3.5 shrink-0 text-emerald-400/80" aria-hidden />
                <span className="min-w-0 truncate text-xs text-zinc-200">Fatigue</span>
                <BadgeScore value={latest.fatigue} type="goodHigh" />
              </div>
              <div className="flex items-center gap-2 rounded-md py-1 transition-colors hover:bg-zinc-800/40">
                <Activity className="h-3.5 w-3.5 shrink-0 text-emerald-400/80" aria-hidden />
                <span className="min-w-0 truncate text-xs text-zinc-200">Soreness</span>
                <BadgeScore value={latest.soreness} type="goodHigh" />
              </div>
              <div className="flex items-center gap-2 rounded-md py-1 transition-colors hover:bg-zinc-800/40">
                <Brain className="h-3.5 w-3.5 shrink-0 text-emerald-400/80" aria-hidden />
                <span className="min-w-0 truncate text-xs text-zinc-200">Stress</span>
                <BadgeScore value={latest.stress} type="goodHigh" />
              </div>
              <div className="flex items-center gap-2 rounded-md py-1 transition-colors hover:bg-zinc-800/40">
                <Smile className="h-3.5 w-3.5 shrink-0 text-emerald-400/80" aria-hidden />
                <span className="min-w-0 truncate text-xs text-zinc-200">Mood</span>
                <BadgeScore value={latest.mood} type="goodHigh" />
              </div>
              <div className="flex items-center gap-2 rounded-md py-1 transition-colors hover:bg-zinc-800/40">
                <Pill className="h-3.5 w-3.5 shrink-0 text-emerald-400/80" aria-hidden />
                <span className="min-w-0 truncate text-xs text-zinc-200">Illness</span>
                {latest.illness === true ? (
                  <span className="rounded bg-red-500/25 px-1.5 py-0.5 text-xs font-medium text-red-400 ring-1 ring-red-500/30">Yes</span>
                ) : (
                  <span className="text-xs text-zinc-400">—</span>
                )}
              </div>
            </div>
            {latest.body_parts && Object.keys(latest.body_parts).length > 0 && (
              <div className="mt-4 rounded-xl border border-emerald-500/30 bg-zinc-900/50 px-4 py-4 shadow-md ring-1 ring-emerald-500/10">
                <h4 className="text-xs font-medium text-zinc-500 pl-1 border-l-2 border-emerald-500/50">Body map (soreness / pain 1–10)</h4>
                <div className="mt-3">
                  <BodyMapViewOnly bodyParts={latest.body_parts} />
                </div>
                <div className="mt-4 space-y-4">
                  {/* Soreness – külön blokk */}
                  {(() => {
                    const soreEntries = Object.entries(latest.body_parts)
                      .filter(([, v]) => (v.s ?? 0) > 0)
                      .sort(([a], [b]) => getBodyPartLabel(a).localeCompare(getBodyPartLabel(b), "en"));
                    if (soreEntries.length === 0) return null;
                    return (
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 py-2 px-3">
                        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-amber-400/90">Soreness</p>
                        <ul className="space-y-1.5 text-sm">
                          {soreEntries.map(([partId, v]) => {
                            const s = v.s ?? 0;
                            const label = getBodyPartLabel(partId);
                            return (
                              <li
                                key={`s-${partId}`}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border-l-4 border-l-amber-500/70 bg-zinc-800/60 px-3 py-2 shadow-sm transition-colors hover:bg-zinc-800/80"
                              >
                                <span className="font-medium text-zinc-200">{label}</span>
                                <span className="rounded-md bg-amber-500/25 px-2 py-0.5 text-xs font-semibold text-amber-400 ring-1 ring-amber-500/30">
                                  {s}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })()}
                  {/* Pain – külön blokk */}
                  {(() => {
                    const painEntries = Object.entries(latest.body_parts)
                      .filter(([, v]) => (v.p ?? 0) > 0)
                      .sort(([a], [b]) => getBodyPartLabel(a).localeCompare(getBodyPartLabel(b), "en"));
                    if (painEntries.length === 0) return null;
                    return (
                      <div className="rounded-lg border border-red-500/20 bg-red-500/5 py-2 px-3">
                        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-red-400/90">Pain</p>
                        <ul className="space-y-1.5 text-sm">
                          {painEntries.map(([partId, v]) => {
                            const p = v.p ?? 0;
                            const label = getBodyPartLabel(partId);
                            return (
                              <li
                                key={`p-${partId}`}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border-l-4 border-l-red-500/70 bg-zinc-800/60 px-3 py-2 shadow-sm transition-colors hover:bg-zinc-800/80"
                              >
                                <span className="font-medium text-zinc-200">{label}</span>
                                <span className="rounded-md bg-red-500/25 px-2 py-0.5 text-xs font-semibold text-red-400 ring-1 ring-red-500/30">
                                  {p}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 7-day / 28-day averages – lejjebb, Latest values és body map után */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div
            className="rounded-xl border border-zinc-600/80 border-l-emerald-500/40 bg-white/[0.04] px-4 py-3.5 shadow-sm ring-1 ring-zinc-500/10"
          >
            <p className="text-xs font-medium text-zinc-500">7-day average</p>
            <p className="mt-1 text-sm text-white">
              {avg7Wellness != null || avg7Sleep != null ? (
                <>
                  Wellness: <span className="font-semibold text-emerald-400">{avg7Wellness != null ? avg7Wellness.toFixed(1) : "—"}</span>
                  {avg7Sleep != null && (
                    <> · Sleep: <span className="font-semibold">{formatSleepDuration(avg7Sleep)}h</span></>
                  )}
                </>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div
            className="rounded-xl border border-zinc-600/80 border-l-zinc-500/50 bg-white/[0.04] px-4 py-3.5 shadow-sm ring-1 ring-zinc-500/10"
          >
            <p className="text-xs font-medium text-zinc-500">28-day average</p>
            <p className="mt-1 text-sm text-white">
              {avg28Wellness != null || avg28Sleep != null ? (
                <>
                  Wellness: <span className="font-semibold text-emerald-400">{avg28Wellness != null ? avg28Wellness.toFixed(1) : "—"}</span>
                  {avg28Sleep != null && (
                    <> · Sleep: <span className="font-semibold">{formatSleepDuration(avg28Sleep)}h</span></>
                  )}
                </>
              ) : (
                "—"
              )}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-600/70 bg-zinc-900/30 px-4 py-3 shadow-sm ring-1 ring-zinc-500/10">
            <h3 className="text-sm font-medium text-zinc-400 pl-1 border-l-2 border-emerald-500/40">Wellness trend</h3>
            <div className="mt-2 h-32">
              {chartWellness.length > 0 && hasEnoughHistory ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartWellness} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                    <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#71717a" tick={{ fontSize: 10 }} domain={[0, 10]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card-bg)",
                        border: "1px solid #3f3f46",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.2)",
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
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-zinc-600/60 bg-zinc-800/40 text-sm text-zinc-500">
                  {chartWellness.length < 2 ? "Need at least 2 entries for trend" : "No data"}
                </div>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-600/70 bg-zinc-900/30 px-4 py-3 shadow-sm ring-1 ring-zinc-500/10">
            <h3 className="text-sm font-medium text-zinc-400 pl-1 border-l-2 border-blue-500/40">Sleep hours trend</h3>
            <div className="mt-2 h-32">
              {chartSleep.length > 0 && chartSleep.some((d) => d.hours > 0) && hasEnoughHistory ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartSleep} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                    <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#71717a" tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card-bg)",
                        border: "1px solid #3f3f46",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.2)",
                      }}
                      formatter={(v: number) => [`${v}h`, "Sleep"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="hours"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: "#3b82f6" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-zinc-600/60 bg-zinc-800/40 text-sm text-zinc-500">
                  {chartSleep.length < 2 ? "Need at least 2 entries" : "No sleep data"}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-zinc-600/80 pt-5">
          <Link
            href={`/players/${userId}`}
            className="inline-flex items-center rounded-xl border border-zinc-600 bg-zinc-700/80 px-4 py-2 text-sm font-medium text-white shadow-sm ring-1 ring-zinc-500/10 hover:border-zinc-500 hover:bg-zinc-600 hover:shadow hover:ring-zinc-500/20 transition-all"
          >
            View full history
          </Link>
        </div>
      </div>
    </div>
  );
}
