"use client";

import { useMemo, useState } from "react";
import type { WellnessRow } from "@/lib/types";
import { wellnessAverageFromRow, averageWellness } from "@/utils/wellness";
import { KpiCard } from "./KpiCard";
import { BadgeScore } from "./BadgeScore";
import { RiskRowHighlight, RiskBadge } from "./RiskRowHighlight";
import { PlayerWellnessModal } from "./PlayerWellnessModal";

const BG_PAGE = "#0b0f14";
const BG_CARD = "#11161c";
const CARD_RADIUS = "12px";

type SortOption = "newest" | "lowestWellness" | "highestFatigue";

function isAtRisk(r: WellnessRow): boolean {
  if (r.sleep_quality != null && r.sleep_quality <= 3) return true;
  if (r.fatigue != null && r.fatigue >= 7) return true;
  if (r.soreness != null && r.soreness >= 7) return true;
  if (r.stress != null && r.stress >= 7) return true;
  if (r.mood != null && r.mood <= 3) return true;
  return false;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

interface StaffWellnessViewProps {
  list: WellnessRow[];
  emailByUserId: Record<string, string>;
  totalPlayers: number | null;
}

export function StaffWellnessView({
  list,
  emailByUserId,
  totalPlayers,
}: StaffWellnessViewProps) {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyAtRisk, setOnlyAtRisk] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [modalUserId, setModalUserId] = useState<string | null>(null);

  const filteredAndSorted = useMemo(() => {
    let rows = list.filter((r) => r.date === selectedDate);
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      rows = rows.filter((r) => {
        const email = (emailByUserId[r.user_id] ?? "").toLowerCase();
        const name = email; // we use email as display name
        return name.includes(query) || email.includes(query);
      });
    }
    if (onlyAtRisk) rows = rows.filter(isAtRisk);
    if (sortBy === "newest") {
      rows = [...rows].sort((a, b) => (b.date > a.date ? 1 : -1));
    } else if (sortBy === "lowestWellness") {
      rows = [...rows].sort((a, b) => {
        const wa = wellnessAverageFromRow(a) ?? 0;
        const wb = wellnessAverageFromRow(b) ?? 0;
        return wa - wb;
      });
    } else {
      rows = [...rows].sort((a, b) => (b.fatigue ?? 0) - (a.fatigue ?? 0));
    }
    return rows;
  }, [list, selectedDate, searchQuery, onlyAtRisk, sortBy, emailByUserId]);

  const summaryForDate = useMemo(() => {
    const rowsForDate = list.filter((r) => r.date === selectedDate);
    const submitted = new Set(rowsForDate.map((r) => r.user_id)).size;
    const atRiskCount = new Set(rowsForDate.filter(isAtRisk).map((r) => r.user_id)).size;
    const avgWellness = averageWellness(rowsForDate);
    const missing = totalPlayers != null ? Math.max(0, totalPlayers - submitted) : null;
    return { submitted, atRiskCount, avgWellness, missing, total: totalPlayers };
  }, [list, selectedDate, totalPlayers]);

  const modalUser = modalUserId ? emailByUserId[modalUserId] ?? modalUserId : null;

  return (
    <div
      className="min-h-screen px-4 py-8 sm:px-6 lg:px-8"
      style={{ backgroundColor: BG_PAGE }}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        {/* HEADER */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Wellness</h1>
          <p className="mt-1 text-zinc-400">
            Daily wellness submissions (sleep, fatigue, soreness, stress, mood).
          </p>
        </div>

        {/* FILTER BAR */}
        <div
          className="flex flex-wrap items-center gap-4 rounded-xl p-4"
          style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
        >
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            Date
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </label>
          <input
            type="search"
            placeholder="Search by name or email"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:w-56"
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={onlyAtRisk}
              onChange={(e) => setOnlyAtRisk(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-red-500 focus:ring-red-500"
            />
            Only at-risk
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="newest">Newest</option>
            <option value="lowestWellness">Lowest wellness</option>
            <option value="highestFatigue">Highest fatigue</option>
          </select>
        </div>

        {/* SUMMARY STRIP */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Submitted"
            value={
              summaryForDate.total != null
                ? `${summaryForDate.submitted} / ${summaryForDate.total}`
                : `${summaryForDate.submitted} submissions`
            }
          />
          <KpiCard
            label="Avg wellness score"
            value={
              summaryForDate.avgWellness != null
                ? summaryForDate.avgWellness.toFixed(1)
                : "—"
            }
          />
          <KpiCard
            label="At-risk count"
            value={
              summaryForDate.atRiskCount > 0 ? (
                <span className="text-red-400">{summaryForDate.atRiskCount}</span>
              ) : (
                summaryForDate.atRiskCount
              )
            }
          />
          {summaryForDate.missing != null && (
            <KpiCard label="Missing submissions" value={summaryForDate.missing} />
          )}
        </div>

        {/* TABLE */}
        <div
          className="overflow-hidden rounded-xl"
          style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
        >
          {filteredAndSorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-zinc-400">No wellness entries for selected date.</p>
              {list.length === 0 && (
                <p className="mt-1 text-sm text-zinc-500">Try another date or ensure data is loaded.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-zinc-900/95 shadow-sm">
                  <tr className="border-b border-zinc-700 text-zinc-400">
                    <th className="px-4 py-3 font-medium">Player</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Bed</th>
                    <th className="px-4 py-3 font-medium">Wake</th>
                    <th className="px-4 py-3 font-medium">Sleep (h)</th>
                    <th className="px-4 py-3 font-medium">Sleep quality</th>
                    <th className="px-4 py-3 font-medium">Fatigue</th>
                    <th className="px-4 py-3 font-medium">Soreness</th>
                    <th className="px-4 py-3 font-medium">Stress</th>
                    <th className="px-4 py-3 font-medium">Mood</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-300">
                  {filteredAndSorted.map((r) => {
                    const atRisk = isAtRisk(r);
                    const displayName = emailByUserId[r.user_id] ?? r.user_id;
                    return (
                      <RiskRowHighlight key={r.id} isAtRisk={atRisk}>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setModalUserId(r.user_id)}
                            className="font-medium text-emerald-400 hover:underline"
                          >
                            {displayName}
                          </button>
                          {atRisk && <RiskBadge />}
                        </td>
                        <td className="px-4 py-3">{r.date}</td>
                        <td className="px-4 py-3">{r.bed_time ?? "—"}</td>
                        <td className="px-4 py-3">{r.wake_time ?? "—"}</td>
                        <td className="px-4 py-3 tabular-nums">
                          {r.sleep_duration != null ? `${r.sleep_duration}h` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <BadgeScore value={r.sleep_quality} type="goodHigh" />
                        </td>
                        <td className="px-4 py-3">
                          <BadgeScore value={r.fatigue} type="badHigh" />
                        </td>
                        <td className="px-4 py-3">
                          <BadgeScore value={r.soreness} type="badHigh" />
                        </td>
                        <td className="px-4 py-3">
                          <BadgeScore value={r.stress} type="badHigh" />
                        </td>
                        <td className="px-4 py-3">
                          <BadgeScore value={r.mood} type="badLow" />
                        </td>
                      </RiskRowHighlight>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modalUserId && modalUser && (
        <PlayerWellnessModal
          playerName={modalUser}
          userId={modalUserId}
          allRows={list}
          onClose={() => setModalUserId(null)}
        />
      )}
    </div>
  );
}
