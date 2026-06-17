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
import type { SessionRow } from "@/lib/types";
import { formatDayShort, formatMonthDay } from "@/lib/formatDate";
import {
  formatMatchdayTagDisplay,
  formatSessionTypeDisplay,
} from "@/lib/sessionDisplay";
import { RiskBadge, spikeToRiskLevel } from "./RiskBadge";

const CARD_RADIUS = "12px";

interface PlayerLoadModalProps {
  playerName: string;
  userId: string;
  sessions: SessionRow[];
  spikePercent: number | null;
  highlightDate?: string;
  onClose: () => void;
}

export function PlayerLoadModal({
  playerName,
  userId,
  sessions,
  spikePercent,
  highlightDate,
  onClose,
}: PlayerLoadModalProps) {
  const last7 = sessions.slice(0, 7);
  const dailyLoad = last7.map((s) => ({
    date: formatDayShort(s.date),
    load: s.load ?? 0,
  })).reverse();
  const dailyLoadSum = last7.reduce((a, s) => a + (s.load ?? 0), 0);
  const riskLevel = spikeToRiskLevel(spikePercent);

  const detailSessions = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => (a.date < b.date ? 1 : -1));
    if (highlightDate) {
      const onDate = sorted.filter((session) => session.date === highlightDate);
      if (onDate.length > 0) return onDate;
    }
    return sorted.slice(0, 12);
  }, [highlightDate, sessions]);

  const detailTitle = highlightDate
    ? `Sessions on ${formatMonthDay(highlightDate)}`
    : "Recent sessions";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rpe-modal-title"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl p-6 shadow-xl"
        style={{ backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <h2 id="rpe-modal-title" className="text-xl font-bold text-white">
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

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-zinc-400">Napi load (utolsó)</p>
            <p className="mt-1 text-xl font-bold text-white">
              {last7[0] ? (last7[0].load ?? 0) : "—"}
            </p>
          </div>
          <div>
            <p className="text-sm text-zinc-400">Heti load (7 nap)</p>
            <p className="mt-1 text-xl font-bold text-white">{dailyLoadSum}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm text-zinc-400">Load spike:</span>
          {spikePercent != null ? (
            <span className="font-medium text-white">{(spikePercent * 100).toFixed(0)}%</span>
          ) : (
            <span className="text-zinc-500">—</span>
          )}
          <RiskBadge level={riskLevel} />
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-medium text-zinc-400">{detailTitle}</h3>
          {detailSessions.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No sessions to show.</p>
          ) : (
            <div className="mt-2 overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="bg-zinc-900/80 text-zinc-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Duration</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">MD</th>
                    <th className="px-3 py-2 font-medium">RPE</th>
                    <th className="px-3 py-2 font-medium">Load</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-300">
                  {detailSessions.map((session) => (
                    <tr key={session.id} className="border-t border-zinc-800/80">
                      <td className="px-3 py-2">{formatMonthDay(session.date)}</td>
                      <td className="px-3 py-2 tabular-nums">{session.duration} min</td>
                      <td className="px-3 py-2">
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium">
                          {formatSessionTypeDisplay(session.session_type)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium">
                          {formatMatchdayTagDisplay(session.matchday_tag)}
                        </span>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{session.rpe ?? "—"}</td>
                      <td className="px-3 py-2 tabular-nums">{session.load ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-medium text-zinc-400">7 nap trend</h3>
          <div className="mt-2 h-36">
            {dailyLoad.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyLoad} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
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
                  <Line type="monotone" dataKey="load" stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981" }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg bg-zinc-900/40 text-sm text-zinc-500">
                No data
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 border-t border-zinc-800 pt-4">
          <Link
            href={`/players/${userId}`}
            className="inline-flex items-center rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-600"
          >
            Full history
          </Link>
        </div>
      </div>
    </div>
  );
}
