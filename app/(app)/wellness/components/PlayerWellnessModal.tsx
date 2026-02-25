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
import { getBodyPartLabel } from "@/lib/bodyMapParts";
import { BadgeScore } from "./BadgeScore";

const BG_PAGE = "#0b0f14";
const BG_CARD = "#11161c";
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl p-6 shadow-xl"
        style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <h2 id="modal-title" className="text-xl font-bold text-white">
            {playerName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 7-day / 28-day averages */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div
            className="rounded-lg border border-zinc-700 px-3 py-2.5"
            style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
          >
            <p className="text-xs font-medium text-zinc-500">7-day average</p>
            <p className="mt-1 text-sm text-white">
              {avg7Wellness != null || avg7Sleep != null ? (
                <>
                  Wellness: <span className="font-semibold text-emerald-400">{avg7Wellness != null ? avg7Wellness.toFixed(1) : "—"}</span>
                  {avg7Sleep != null && (
                    <> · Sleep: <span className="font-semibold">{avg7Sleep.toFixed(1)}h</span></>
                  )}
                </>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div
            className="rounded-lg border border-zinc-700 px-3 py-2.5"
            style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
          >
            <p className="text-xs font-medium text-zinc-500">28-day average</p>
            <p className="mt-1 text-sm text-white">
              {avg28Wellness != null || avg28Sleep != null ? (
                <>
                  Wellness: <span className="font-semibold text-emerald-400">{avg28Wellness != null ? avg28Wellness.toFixed(1) : "—"}</span>
                  {avg28Sleep != null && (
                    <> · Sleep: <span className="font-semibold">{avg28Sleep.toFixed(1)}h</span></>
                  )}
                </>
              ) : (
                "—"
              )}
            </p>
          </div>
        </div>

        {latest && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-zinc-400">Latest values</h3>
            <div className="mt-2 flex flex-wrap gap-3">
              <span className="text-zinc-500">Sleep quality</span>
              <BadgeScore value={latest.sleep_quality} type="goodHigh" />
              <span className="text-zinc-500">Fatigue</span>
              <BadgeScore value={latest.fatigue} type="badHigh" />
              <span className="text-zinc-500">Soreness</span>
              <BadgeScore value={latest.soreness} type="badHigh" />
              <span className="text-zinc-500">Stress</span>
              <BadgeScore value={latest.stress} type="badHigh" />
              <span className="text-zinc-500">Mood</span>
              <BadgeScore value={latest.mood} type="badLow" />
              <span className="text-zinc-500">Motivation</span>
              <BadgeScore value={latest.motivation} type="goodHigh" />
              <span className="text-zinc-500">Illness</span>
              {latest.illness === true ? (
                <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">Yes</span>
              ) : (
                <span className="text-zinc-500">—</span>
              )}
            </div>
            {latest.body_parts && Object.keys(latest.body_parts).length > 0 && (
              <div className="mt-3 rounded-lg border border-zinc-700 bg-zinc-900/40 px-3 py-2">
                <h4 className="text-xs font-medium text-zinc-500">Body map (soreness / pain 1–10)</h4>
                <ul className="mt-1.5 space-y-1 text-sm text-zinc-300">
                  {Object.entries(latest.body_parts).map(([partId, v]) => {
                    const s = v.s ?? 0;
                    const p = v.p ?? 0;
                    const label = getBodyPartLabel(partId);
                    const parts: string[] = [];
                    if (s > 0) parts.push(`soreness ${s}`);
                    if (p > 0) parts.push(`pain ${p}`);
                    return (
                      <li key={partId}>
                        {label}: {parts.join(", ")}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="mt-6">
          <h3 className="text-sm font-medium text-zinc-400">Last 7 entries</h3>
          {last7.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No entries for this player in loaded data.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {last7.map((r) => {
                const w = wellnessAverageFromRow(r);
                const sleep = r.sleep_duration;
                const sleepStyle =
                  sleep != null
                    ? sleep >= 8
                      ? { backgroundColor: "rgba(16, 185, 129, 0.25)", color: "#34d399" }
                      : { backgroundColor: "rgba(239, 68, 68, 0.25)", color: "#f87171" }
                    : undefined;
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-900/60 px-3 py-2 text-sm"
                  >
                    <span className="text-zinc-300">{r.date}</span>
                    <span className="flex items-center gap-1.5 text-zinc-400">
                      Wellness: {w != null ? w.toFixed(1) : "—"}
                      {" · "}
                      Sleep:{" "}
                      {sleep != null ? (
                        <span className="inline-flex rounded px-1.5 py-0.5 font-medium tabular-nums" style={sleepStyle}>
                          {sleep}h
                        </span>
                      ) : (
                        "—"
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {last7.length > 0 && sortedByDate.length < 7 && (
            <p className="mt-2 text-xs text-amber-500/90">
              Showing {sortedByDate.length} available. View full history for more.
            </p>
          )}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium text-zinc-400">Wellness trend</h3>
            <div className="mt-2 h-32">
              {chartWellness.length > 0 && hasEnoughHistory ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartWellness} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
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
                <div className="flex h-full items-center justify-center rounded-lg bg-zinc-900/40 text-sm text-zinc-500">
                  {chartWellness.length < 2 ? "Need at least 2 entries for trend" : "No data"}
                </div>
              )}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-zinc-400">Sleep hours trend</h3>
            <div className="mt-2 h-32">
              {chartSleep.length > 0 && chartSleep.some((d) => d.hours > 0) && hasEnoughHistory ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartSleep} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#71717a" tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: BG_CARD,
                        border: "1px solid #27272a",
                        borderRadius: "8px",
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
                <div className="flex h-full items-center justify-center rounded-lg bg-zinc-900/40 text-sm text-zinc-500">
                  {chartSleep.length < 2 ? "Need at least 2 entries" : "No sleep data"}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-zinc-800 pt-4">
          <Link
            href={`/players/${userId}`}
            className="inline-flex items-center rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-600"
          >
            View full history
          </Link>
        </div>
      </div>
    </div>
  );
}
