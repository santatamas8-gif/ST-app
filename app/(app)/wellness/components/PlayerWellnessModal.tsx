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
} from "recharts";
import type { WellnessRow } from "@/lib/types";
import { wellnessAverageFromRow } from "@/utils/wellness";
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
  const playerRows = allRows
    .filter((r) => r.user_id === userId)
    .sort((a, b) => (b.date > a.date ? 1 : -1))
    .slice(0, 7);
  const latest = playerRows[0];
  const hasEnoughHistory = playerRows.length >= 2;

  const chartWellness = playerRows
    .slice()
    .reverse()
    .map((r) => ({
      date: formatShortDate(r.date),
      wellness: wellnessAverageFromRow(r) ?? 0,
    }));
  const chartSleep = playerRows
    .slice()
    .reverse()
    .map((r) => ({
      date: formatShortDate(r.date),
      hours: r.sleep_duration ?? 0,
    }));

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
          {playerRows.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No entries for this player in loaded data.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {playerRows.map((r) => {
                const w = wellnessAverageFromRow(r);
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-900/60 px-3 py-2 text-sm"
                  >
                    <span className="text-zinc-300">{r.date}</span>
                    <span className="text-zinc-400">
                      Wellness: {w != null ? w.toFixed(1) : "—"} · Sleep: {r.sleep_duration != null ? `${r.sleep_duration}h` : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {playerRows.length > 0 && playerRows.length < 7 && (
            <p className="mt-2 text-xs text-amber-500/90">
              History requires last-7-days endpoint for full trend. Showing {playerRows.length} available.
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
