"use client";

import { useMemo, useRef, useState } from "react";
import { Activity, AlertTriangle } from "lucide-react";
import type { WellnessRow } from "@/lib/types";
import { useSearchShortcut } from "@/lib/useSearchShortcut";
import { getDateContextLabel } from "@/lib/dateContext";
import { wellnessAverageFromRow, averageWellness } from "@/utils/wellness";
import { getBodyPartLabel } from "@/lib/bodyMapParts";
import { KpiCard } from "./KpiCard";
import { BadgeScore } from "./BadgeScore";
import { RiskRowHighlight, RiskBadge } from "./RiskRowHighlight";
import { PlayerWellnessModal } from "./PlayerWellnessModal";
import { BodyMapViewOnly } from "@/components/BodyMap";

type BodyPartEntry = { label: string; value: number };

/** Aggregate body_parts from all rows: per part id, max s and max p. */
function aggregateBodyParts(rows: WellnessRow[]): Record<string, { s: number; p: number }> {
  const out: Record<string, { s: number; p: number }> = {};
  rows.forEach((r) => {
    if (!r.body_parts) return;
    Object.entries(r.body_parts).forEach(([id, v]) => {
      const s = v.s ?? 0;
      const p = v.p ?? 0;
      if (!out[id]) out[id] = { s: 0, p: 0 };
      out[id].s = Math.max(out[id].s, s);
      out[id].p = Math.max(out[id].p, p);
    });
  });
  return out;
}

function splitBodyParts(bodyParts: WellnessRow["body_parts"]): {
  soreness: BodyPartEntry[];
  pain: BodyPartEntry[];
} {
  const soreness: BodyPartEntry[] = [];
  const pain: BodyPartEntry[] = [];
  if (!bodyParts) return { soreness, pain };
  Object.entries(bodyParts).forEach(([partId, v]) => {
    const s = v.s ?? 0;
    const p = v.p ?? 0;
    const label = getBodyPartLabel(partId);
    if (s > 0) soreness.push({ label, value: s });
    if (p > 0) pain.push({ label, value: p });
  });
  return { soreness, pain };
}

/** Opacity 0.35 (value 1) → 1 (value 10) so higher values look stronger */
function intensityOpacity(value: number): number {
  return Math.min(1, Math.max(0, 0.35 + (value / 10) * 0.65));
}

/** Badge opacity for number: 1 = lighter, 10 = solid dark so difference is visible */
function numberBadgeOpacity(value: number): number {
  return Math.min(1, Math.max(0.35, 0.35 + (value / 10) * 0.65));
}

const CARD_RADIUS = "12px";

type SortOption = "newest" | "lowestWellness" | "highestFatigue";

function isAtRisk(r: WellnessRow): boolean {
  if (r.sleep_quality != null && r.sleep_quality <= 3) return true;
  if (r.fatigue != null && r.fatigue >= 7) return true;
  if (r.soreness != null && r.soreness >= 7) return true;
  if (r.stress != null && r.stress >= 7) return true;
  if (r.mood != null && r.mood <= 3) return true;
  if (r.illness === true) return true;
  return false;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** "23:00:00" → "23:00", "07:30" → "07:30" */
function timeToHHmm(s: string | null | undefined): string | null {
  if (!s || typeof s !== "string") return null;
  const parts = s.trim().split(":");
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
  return s;
}

interface StaffWellnessViewProps {
  list: WellnessRow[];
  emailByUserId: Record<string, string>;
  displayNameByUserId: Record<string, string>;
  totalPlayers: number | null;
  allPlayerIds?: string[];
}

export function StaffWellnessView({
  list,
  emailByUserId,
  displayNameByUserId,
  totalPlayers,
  allPlayerIds = [],
}: StaffWellnessViewProps) {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyAtRisk, setOnlyAtRisk] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [modalUserId, setModalUserId] = useState<string | null>(null);
  const [bodyMapMode, setBodyMapMode] = useState<"soreness" | "pain">("soreness");
  const [popoverCard, setPopoverCard] = useState<"at-risk" | "missing" | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  useSearchShortcut(searchInputRef);

  const filteredAndSorted = useMemo(() => {
    let rows = list.filter((r) => r.date === selectedDate);
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      rows = rows.filter((r) => {
        const email = (emailByUserId[r.user_id] ?? "").toLowerCase();
        const name = (displayNameByUserId[r.user_id] ?? "").toLowerCase();
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
  }, [list, selectedDate, searchQuery, onlyAtRisk, sortBy, emailByUserId, displayNameByUserId]);

  const summaryForDate = useMemo(() => {
    const rowsForDate = list.filter((r) => r.date === selectedDate);
    const submitted = new Set(rowsForDate.map((r) => r.user_id)).size;
    const atRiskCount = new Set(rowsForDate.filter(isAtRisk).map((r) => r.user_id)).size;
    const avgWellness = averageWellness(rowsForDate);
    const missing = totalPlayers != null ? Math.max(0, totalPlayers - submitted) : null;
    const total = totalPlayers ?? null;
    return { submitted, atRiskCount, avgWellness, missing, total };
  }, [list, selectedDate, totalPlayers]);

  const yesterdayAvg = useMemo(() => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    const yesterday = d.toISOString().slice(0, 10);
    const rowsYesterday = list.filter((r) => r.date === yesterday);
    return rowsYesterday.length > 0 ? averageWellness(rowsYesterday) : null;
  }, [list, selectedDate]);

  const modalUser = modalUserId ? (displayNameByUserId[modalUserId] ?? emailByUserId[modalUserId] ?? modalUserId) : null;

  const rowsForDate = useMemo(
    () => list.filter((r) => r.date === selectedDate),
    [list, selectedDate]
  );
  const atRiskList = useMemo(
    () =>
      rowsForDate
        .filter(isAtRisk)
        .map((r) => ({ id: r.user_id, name: displayNameByUserId[r.user_id] ?? emailByUserId[r.user_id] ?? r.user_id })),
    [rowsForDate, displayNameByUserId, emailByUserId]
  );
  const submittedUserIds = useMemo(() => new Set(rowsForDate.map((r) => r.user_id)), [rowsForDate]);
  const missingList = useMemo(
    () =>
      allPlayerIds
        .filter((id) => !submittedUserIds.has(id))
        .map((id) => ({ id, name: displayNameByUserId[id] ?? emailByUserId[id] ?? id })),
    [allPlayerIds, submittedUserIds, displayNameByUserId, emailByUserId]
  );

  return (
    <div
      className="min-h-screen px-4 py-8 sm:px-6 lg:px-8"
      style={{ backgroundColor: "var(--page-bg)" }}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        {/* HEADER */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Wellness</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Daily submissions. Table and body map by selected date.
          </p>
        </div>

        {/* FILTER BAR – one row, wraps on small screens */}
        <div
          className="rounded-xl p-4"
          style={{ backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS }}
        >
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              Date
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="min-h-[44px] rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </label>
            <button
              type="button"
              onClick={() => setSelectedDate(todayISO())}
              className="min-h-[44px] shrink-0 rounded-lg border border-zinc-600 bg-zinc-800/80 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700/80"
            >
              Today
            </button>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={onlyAtRisk}
                onChange={(e) => setOnlyAtRisk(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-red-500 focus:ring-red-500"
              />
              Only at-risk
            </label>
            <div className="relative min-w-0 flex-1 sm:max-w-[200px]">
              <input
                ref={searchInputRef}
                type="search"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 pr-16 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                aria-label="Search by name or email"
                title="Search by name or email (Ctrl+K)"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                Ctrl+K
              </span>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="min-h-[44px] shrink-0 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="newest">Newest</option>
              <option value="lowestWellness">Lowest wellness</option>
              <option value="highestFatigue">Highest fatigue</option>
            </select>
          </div>
        </div>

        {/* SUMMARY STRIP – icons, clickable at-risk, trend, “of X players” */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label={<span className="inline-flex items-center gap-1.5"><span aria-hidden className="text-emerald-400">✓</span> Submitted</span>}
            value={
              summaryForDate.total != null
                ? `${summaryForDate.submitted} / ${summaryForDate.total}`
                : `${summaryForDate.submitted} submissions`
            }
            sublabel={summaryForDate.total != null ? `of ${summaryForDate.total} players` : undefined}
          />
          <KpiCard
            label={<span className="inline-flex items-center gap-1.5"><span aria-hidden className="text-zinc-400">◇</span> Avg wellness score</span>}
            value={
              summaryForDate.avgWellness != null
                ? summaryForDate.avgWellness.toFixed(1)
                : "—"
            }
            sublabel={
              summaryForDate.avgWellness != null && yesterdayAvg != null
                ? (() => {
                    const diff = summaryForDate.avgWellness - yesterdayAvg;
                    if (diff === 0) return "— vs yesterday";
                    return diff > 0
                      ? `↑ ${diff.toFixed(1)} vs yesterday`
                      : `↓ ${(-diff).toFixed(1)} vs yesterday`;
                  })()
                : undefined
            }
          />
          <KpiCard
            label={<span className="inline-flex items-center gap-1.5"><span aria-hidden className="text-red-400">!</span> At-risk</span>}
            value={
              summaryForDate.atRiskCount > 0 ? (
                <span className="text-red-400">{summaryForDate.atRiskCount}</span>
              ) : (
                summaryForDate.atRiskCount
              )
            }
            sublabel="Risk factors"
            onClick={() => setPopoverCard((c) => (c === "at-risk" ? null : "at-risk"))}
          />
          {summaryForDate.missing != null && (
            <KpiCard
              label={<span className="inline-flex items-center gap-1.5"><span aria-hidden className="text-amber-400">−</span> Missing</span>}
              value={summaryForDate.missing}
              sublabel="not submitted"
              onClick={() => setPopoverCard((c) => (c === "missing" ? null : "missing"))}
            />
          )}
        </div>

        {popoverCard && (
          <div
            className="rounded-xl border border-zinc-600 bg-zinc-800/90 px-4 py-3 shadow-lg"
            style={{ borderRadius: CARD_RADIUS }}
          >
            {popoverCard === "at-risk" && (
              <>
                <p className="text-sm font-semibold text-red-400">At risk</p>
                {atRiskList.length === 0 ? (
                  <p className="mt-1 text-sm text-zinc-400">No one</p>
                ) : (
                  <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-sm text-zinc-300">
                    {atRiskList.map(({ id, name }) => (
                      <li key={id}>{name}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
            {popoverCard === "missing" && (
              <>
                <p className="text-sm font-semibold text-amber-400">Not submitted</p>
                {missingList.length === 0 ? (
                  <p className="mt-1 text-sm text-zinc-400">No one</p>
                ) : (
                  <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-sm text-zinc-300">
                    {missingList.map(({ id, name }) => (
                      <li key={id}>{name}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
            <button
              type="button"
              onClick={() => setPopoverCard(null)}
              className="mt-2 text-xs text-zinc-500 hover:text-zinc-300"
            >
              Close
            </button>
          </div>
        )}

        {/* TABLE */}
        <div
          className="overflow-hidden rounded-xl"
          style={{ backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS }}
        >
          {filteredAndSorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-zinc-400">No wellness entries for selected date.</p>
              {list.length === 0 && (
                <p className="mt-1 text-sm text-zinc-500">Try another date or ensure data is loaded.</p>
              )}
            </div>
          ) : (
            <>
              <div className="border-b border-zinc-700 px-4 py-2">
                <p className="text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-3 w-8 rounded bg-emerald-500/30" aria-hidden />
                    Good
                  </span>
                  {" · "}
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-3 w-8 rounded bg-amber-500/30" aria-hidden />
                    Watch
                  </span>
                  {" · "}
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-3 w-8 rounded bg-red-500/30" aria-hidden />
                    Critical
                  </span>
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b-2 border-zinc-500 bg-zinc-800 shadow-md">
                    <tr className="text-zinc-200">
                      <th className="px-4 py-2.5 text-base font-bold">Player</th>
                      <th className="px-4 py-2.5 text-base font-bold">Date</th>
                      <th className="px-4 py-2.5 text-base font-bold">Bed</th>
                      <th className="px-4 py-2.5 text-base font-bold">Wake</th>
                      <th className="px-4 py-2.5 text-base font-bold">Sleep (h)</th>
                      <th className="px-4 py-2.5 text-base font-bold">Sleep quality</th>
                      <th className="px-4 py-2.5 text-base font-bold">Fatigue</th>
                      <th className="px-4 py-2.5 text-base font-bold">Soreness</th>
                      <th className="px-4 py-2.5 text-base font-bold">Stress</th>
                      <th className="px-4 py-2.5 text-base font-bold">Mood</th>
                      <th className="px-4 py-2.5 text-base font-bold">Illness</th>
                      <th className="border-l border-zinc-600 pl-4 pr-4 py-2.5 text-base font-bold">Readiness</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-300">
                    {filteredAndSorted.map((r, index) => {
                      const atRisk = isAtRisk(r);
                      const displayName = displayNameByUserId[r.user_id] ?? emailByUserId[r.user_id] ?? r.user_id;
                      return (
                        <RiskRowHighlight key={r.id} isAtRisk={atRisk} rowIndex={index}>
                          <td className="px-4 py-2">
                            <button
                              type="button"
                              onClick={() => setModalUserId(r.user_id)}
                              className="min-h-[40px] rounded font-medium text-emerald-400 hover:underline"
                            >
                              {displayName}
                            </button>
                            {atRisk && <RiskBadge />}
                          </td>
                          <td className="px-4 py-2">{r.date}<span className="text-zinc-500">{getDateContextLabel(r.date)}</span></td>
                          <td className="px-4 py-2">{timeToHHmm(r.bed_time) ?? "—"}</td>
                          <td className="px-4 py-2">{timeToHHmm(r.wake_time) ?? "—"}</td>
                          <td className="px-4 py-2">
                            {r.sleep_duration != null ? (
                              <span
                                className="inline-flex rounded-md px-2 py-1 tabular-nums font-semibold"
                                style={
                                  r.sleep_duration >= 8
                                    ? { backgroundColor: "rgba(16, 185, 129, 0.25)", color: "#34d399" }
                                    : { backgroundColor: "rgba(239, 68, 68, 0.25)", color: "#f87171" }
                                }
                              >
                                {r.sleep_duration}h
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <BadgeScore value={r.sleep_quality} type="goodHigh" />
                          </td>
                          <td className="px-4 py-2">
                            <BadgeScore value={r.fatigue != null ? 10 - r.fatigue : null} type="goodHigh" />
                          </td>
                          <td className="px-4 py-2">
                            <BadgeScore value={r.soreness != null ? 10 - r.soreness : null} type="goodHigh" />
                          </td>
                          <td className="px-4 py-2">
                            <BadgeScore value={r.stress != null ? 10 - r.stress : null} type="goodHigh" />
                          </td>
                          <td className="px-4 py-2">
                            <BadgeScore value={r.mood} type="goodHigh" />
                          </td>
                          <td className="px-4 py-2">
                            {r.illness === true ? (
                              <span className="rounded bg-red-500/20 px-2 py-1 text-sm font-semibold text-red-400">Yes</span>
                            ) : (
                              <span className="rounded bg-emerald-500/20 px-2 py-1 text-sm font-semibold text-emerald-400">No</span>
                            )}
                          </td>
                          <td className="border-l border-zinc-600 px-4 py-2">
                            <BadgeScore value={wellnessAverageFromRow(r)} type="goodHigh" />
                          </td>
                        </RiskRowHighlight>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Body map (all players aggregated): between table and Body parts list */}
        {filteredAndSorted.length > 0 &&
          filteredAndSorted.some((r) => {
            const { soreness, pain } = splitBodyParts(r.body_parts);
            return soreness.length > 0 || pain.length > 0;
          }) && (
          <div
            className="rounded-xl border border-zinc-700 px-4 py-4 sm:px-5"
            style={{ backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-zinc-500">Map:</span>
              <button
                type="button"
                onClick={() => setBodyMapMode("soreness")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  bodyMapMode === "soreness"
                    ? "bg-amber-600 text-white"
                    : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
                }`}
              >
                Soreness
              </button>
              <button
                type="button"
                onClick={() => setBodyMapMode("pain")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  bodyMapMode === "pain"
                    ? "bg-red-600 text-white"
                    : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
                }`}
              >
                Pain
              </button>
            </div>
            <div className="mt-3">
              <BodyMapViewOnly
                bodyParts={aggregateBodyParts(filteredAndSorted)}
                mode={bodyMapMode}
                hideLabels
                size="large"
              />
            </div>
          </div>
        )}

        {/* Body parts: only show if at least one player has any soreness or pain */}
        {filteredAndSorted.length > 0 &&
          filteredAndSorted.some((r) => {
            const { soreness, pain } = splitBodyParts(r.body_parts);
            return soreness.length > 0 || pain.length > 0;
          }) && (
          <div
            className="rounded-xl border border-zinc-700 px-4 py-4 sm:px-5"
            style={{ backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS }}
          >
            <h3 className="text-sm font-medium text-zinc-400">Body parts</h3>

            {/* Section 1: Soreness – every player who has soreness */}
            <div className="mt-4">
              <span className="inline-flex items-center gap-2 text-base font-semibold text-amber-400">
                <Activity className="h-5 w-5" aria-hidden />
                Soreness
              </span>
              <ul className="mt-2 space-y-3">
                {filteredAndSorted
                  .filter((r) => splitBodyParts(r.body_parts).soreness.length > 0)
                  .map((r) => {
                    const displayName = displayNameByUserId[r.user_id] ?? emailByUserId[r.user_id] ?? r.user_id;
                    const { soreness } = splitBodyParts(r.body_parts);
                    return (
                      <li key={r.id}>
                        <div className="rounded-lg border border-zinc-700/80 bg-zinc-800/50 px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => setModalUserId(r.user_id)}
                            className="text-left text-sm font-medium text-emerald-400 hover:underline"
                          >
                            {displayName}
                          </button>
                          <div className="mt-2 flex flex-wrap gap-2 text-sm">
                            {soreness.map(({ label, value }) => {
                              const op = intensityOpacity(value);
                              const badgeOp = numberBadgeOpacity(value);
                              return (
                                <span
                                  key={label}
                                  className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5"
                                  style={{
                                    backgroundColor: `rgba(245, 158, 11, ${op * 0.5})`,
                                    borderColor: `rgba(245, 158, 11, ${op * 0.8})`,
                                    color: `rgba(253, 224, 71, ${0.5 + op * 0.5})`,
                                  }}
                                >
                                  <span>{label}</span>
                                  <span
                                    className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded px-1 text-xs font-bold tabular-nums text-white"
                                    style={{ backgroundColor: `rgba(120, 53, 15, ${badgeOp})` }}
                                  >
                                    {value}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                {filteredAndSorted.every((r) => splitBodyParts(r.body_parts).soreness.length === 0) && (
                  <li className="text-sm text-zinc-500">—</li>
                )}
              </ul>
            </div>

            {/* Section 2: Pain – every player who has pain */}
            <div className="mt-4">
              <span className="inline-flex items-center gap-2 text-base font-semibold text-red-400">
                <AlertTriangle className="h-5 w-5" aria-hidden />
                Pain
              </span>
              <ul className="mt-2 space-y-3">
                {filteredAndSorted
                  .filter((r) => splitBodyParts(r.body_parts).pain.length > 0)
                  .map((r) => {
                    const displayName = displayNameByUserId[r.user_id] ?? emailByUserId[r.user_id] ?? r.user_id;
                    const { pain } = splitBodyParts(r.body_parts);
                    return (
                      <li key={r.id}>
                        <div className="rounded-lg border border-zinc-700/80 bg-zinc-800/50 px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => setModalUserId(r.user_id)}
                            className="text-left text-sm font-medium text-emerald-400 hover:underline"
                          >
                            {displayName}
                          </button>
                          <div className="mt-2 flex flex-wrap gap-2 text-sm">
                            {pain.map(({ label, value }) => {
                              const op = intensityOpacity(value);
                              const badgeOp = numberBadgeOpacity(value);
                              return (
                                <span
                                  key={label}
                                  className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5"
                                  style={{
                                    backgroundColor: `rgba(239, 68, 68, ${op * 0.5})`,
                                    borderColor: `rgba(239, 68, 68, ${op * 0.8})`,
                                    color: `rgba(252, 165, 165, ${0.5 + op * 0.5})`,
                                  }}
                                >
                                  <span>{label}</span>
                                  <span
                                    className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded px-1 text-xs font-bold tabular-nums text-white"
                                    style={{ backgroundColor: `rgba(127, 29, 29, ${badgeOp})` }}
                                  >
                                    {value}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                {filteredAndSorted.every((r) => splitBodyParts(r.body_parts).pain.length === 0) && (
                  <li className="text-sm text-zinc-500">—</li>
                )}
              </ul>
            </div>
          </div>
        )}
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
