"use client";

import { useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Activity, AlertTriangle, UserRound, FileDown } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { NEON_CARD_STYLE, MATT_CARD_STYLE } from "@/lib/themes";
import type { WellnessRow } from "@/lib/types";
import { useSearchShortcut } from "@/lib/useSearchShortcut";
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

/** Soreness badge by intensity: 1–4 light, 5–7 medium, 8–10 strong (higher = worse) */
function sorenessBadgeStyle(value: number): CSSProperties {
  if (value <= 4) return { backgroundColor: "rgba(180, 83, 9, 0.45)", color: "#fef3c7" };
  if (value <= 7) return { backgroundColor: "rgba(146, 64, 14, 0.8)", color: "#fde68a" };
  return { backgroundColor: "rgba(120, 53, 15, 1)", color: "#fef9c3" };
}

/** Pain badge by intensity: 1–4 light, 5–7 medium, 8–10 strong (higher = worse) */
function painBadgeStyle(value: number): CSSProperties {
  if (value <= 4) return { backgroundColor: "rgba(185, 28, 28, 0.45)", color: "#fecaca" };
  if (value <= 7) return { backgroundColor: "rgba(153, 27, 27, 0.85)", color: "#fca5a5" };
  return { backgroundColor: "rgba(127, 29, 29, 1)", color: "#fef2f2" };
}

const CARD_RADIUS = "12px";

type SortOption = "newest" | "lowestWellness" | "highestFatigue" | "readinessAsc" | "readinessDesc";

/** High risk = Critical zone only (1–4). All metrics: higher = better, no inversion. */
function isAtRisk(r: WellnessRow): boolean {
  if (r.sleep_quality != null && r.sleep_quality < 5) return true;
  if (r.mood != null && r.mood < 5) return true;
  if (r.fatigue != null && r.fatigue < 5) return true;
  if (r.soreness != null && r.soreness < 5) return true;
  if (r.stress != null && r.stress < 5) return true;
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
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [modalUserId, setModalUserId] = useState<string | null>(null);
  const [bodyMapMode, setBodyMapMode] = useState<"soreness" | "pain">("soreness");
  const [popoverCard, setPopoverCard] = useState<"at-risk" | "missing" | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";
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
    if (sortBy === "newest") {
      rows = [...rows].sort((a, b) => (b.date > a.date ? 1 : -1));
    } else if (sortBy === "lowestWellness") {
      rows = [...rows].sort((a, b) => {
        const wa = wellnessAverageFromRow(a) ?? 0;
        const wb = wellnessAverageFromRow(b) ?? 0;
        return wa - wb;
      });
    } else if (sortBy === "readinessAsc") {
      rows = [...rows].sort((a, b) => {
        const ra = wellnessAverageFromRow(a) ?? 0;
        const rb = wellnessAverageFromRow(b) ?? 0;
        return ra - rb;
      });
    } else if (sortBy === "readinessDesc") {
      rows = [...rows].sort((a, b) => {
        const ra = wellnessAverageFromRow(a) ?? 0;
        const rb = wellnessAverageFromRow(b) ?? 0;
        return rb - ra;
      });
    } else {
      // highestFatigue = worst first (lowest value = least energy)
      rows = [...rows].sort((a, b) => (a.fatigue ?? 10) - (b.fatigue ?? 10));
    }
    return rows;
  }, [list, selectedDate, searchQuery, sortBy, emailByUserId, displayNameByUserId]);

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

  const teamReadinessAvg = useMemo(
    () => (filteredAndSorted.length > 0 ? averageWellness(filteredAndSorted) : null),
    [filteredAndSorted]
  );

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
      className="min-h-screen min-w-0 -mx-4 overflow-x-hidden px-3 py-8 sm:mx-0 sm:px-6 lg:px-8"
      style={{ backgroundColor: "var(--page-bg)" }}
    >
      <div className="mx-auto max-w-7xl min-w-0 space-y-8">
        {/* HEADER */}
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl lg:text-2xl">Wellness</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Daily submissions. Table and body map by selected date.
          </p>
        </div>

        {/* SUMMARY STRIP – icons, clickable at-risk, trend, “of X players” */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label={<span className="inline-flex items-center gap-1.5"><span aria-hidden className="text-emerald-400">✓</span> Submitted</span>}
            value={
              summaryForDate.total != null ? (
                <>
                  <span>{summaryForDate.submitted} / {summaryForDate.total}</span>
                  <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-zinc-700">
                    <span
                      className="block h-full rounded-full bg-emerald-500"
                      style={{ width: `${summaryForDate.total > 0 ? (100 * summaryForDate.submitted) / summaryForDate.total : 0}%` }}
                      aria-hidden
                    />
                  </span>
                </>
              ) : (
                `${summaryForDate.submitted} submissions`
              )
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
            className="ring-2 ring-red-500/50 bg-red-500/10"
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
            className={`rounded-xl border px-4 py-3 shadow-lg ${isHighContrast ? "neon-card-text border-white/20" : "border-zinc-600 bg-zinc-800/90"}`}
            style={themeId === "neon" ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS } : themeId === "matt" ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS } : { borderRadius: CARD_RADIUS }}
          >
            {popoverCard === "at-risk" && (
              <>
                <p className="text-sm font-semibold text-red-400">At risk</p>
                <p className={`mt-0.5 text-xs ${isHighContrast ? "text-white/70" : "text-zinc-500"}`}>
                  Risk factors: low sleep quality, high fatigue, high soreness, high stress, low mood, illness.
                </p>
                {atRiskList.length === 0 ? (
                  <p className={`mt-1 text-sm ${isHighContrast ? "text-white/90" : "text-zinc-400"}`}>No one</p>
                ) : (
                  <ul className={`mt-1.5 list-inside list-disc space-y-0.5 text-sm ${isHighContrast ? "text-white/90" : "text-zinc-300"}`}>
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
                  <p className={`mt-1 text-sm ${isHighContrast ? "text-white/90" : "text-zinc-400"}`}>No one</p>
                ) : (
                  <ul className={`mt-1.5 list-inside list-disc space-y-0.5 text-sm ${isHighContrast ? "text-white/90" : "text-zinc-300"}`}>
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
              className={`mt-2 text-xs ${isHighContrast ? "text-white/80 hover:text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              Close
            </button>
          </div>
        )}

        {/* TABLE */}
        <div
          className={`wellness-print-area mt-2 overflow-hidden rounded-xl ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
          style={themeId === "neon" ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS } : themeId === "matt" ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS } : { backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS }}
        >
          {filteredAndSorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className={isHighContrast ? "text-white/90" : "text-zinc-400"}>No wellness entries for selected date.</p>
              {list.length === 0 && (
                <p className={`mt-1 text-sm ${isHighContrast ? "text-white/70" : "text-zinc-500"}`}>Try another date or ensure data is loaded.</p>
              )}
            </div>
          ) : (
            <>
              <div className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-4 py-3 sm:gap-x-4 ${isHighContrast ? "border-white/20 bg-white/5" : "border-zinc-700 bg-zinc-800/70"}`}>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <label className={`flex items-center gap-1.5 text-sm ${isHighContrast ? "text-white/90" : "text-zinc-400"}`}>
                    Date
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className={`min-h-[36px] rounded-md border px-2 py-1.5 text-sm focus:outline-none ${isHighContrast ? "border-white/30 bg-white/10 text-white focus:border-white/60" : "border-zinc-600 bg-zinc-800/80 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"}`}
                    />
                  </label>
                  <div className="relative min-w-0 flex-1 basis-32 sm:max-w-[180px]">
                    <input
                      ref={searchInputRef}
                      type="search"
                      placeholder="Search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`min-h-[36px] w-full rounded-md border px-2 py-1.5 pr-12 text-sm placeholder-zinc-500 focus:outline-none ${isHighContrast ? "border-white/30 bg-white/10 text-white focus:border-white/60" : "border-zinc-600 bg-zinc-800/80 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"}`}
                      aria-label="Search by name or email"
                      title="Search by name or email (Ctrl+K)"
                    />
                    <span className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs ${isHighContrast ? "text-white/60" : "text-zinc-500"}`}>
                      Ctrl+K
                    </span>
                  </div>
                  <label className={`flex items-center gap-1.5 text-sm ${isHighContrast ? "text-white/80" : "text-zinc-500"}`}>
                    Sort by
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className={`min-h-[36px] shrink-0 rounded-md border px-2.5 py-1.5 text-sm focus:outline-none ${isHighContrast ? "border-white/30 bg-white/10 text-white focus:border-white/60" : "border-zinc-600 bg-zinc-800/80 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"}`}
                    aria-label="Sort table by"
                  >
                    <option value="newest" style={{ backgroundColor: "#fff", color: "#18181b" }}>Newest</option>
                    <option value="lowestWellness" style={{ backgroundColor: "#fff", color: "#18181b" }}>Lowest wellness</option>
                    <option value="highestFatigue" style={{ backgroundColor: "#fff", color: "#18181b" }}>Highest fatigue</option>
                    <option value="readinessAsc" style={{ backgroundColor: "#fff", color: "#18181b" }}>Readiness (low→high)</option>
                    <option value="readinessDesc" style={{ backgroundColor: "#fff", color: "#18181b" }}>Readiness (high→low)</option>
                  </select>
                </div>
                <div className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-3">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${isHighContrast ? "text-white/90" : "text-zinc-300"}`}>
                    <span className="inline-block h-3 w-5 rounded bg-emerald-500/50 ring-1 ring-emerald-400/30" aria-hidden />
                    Good
                  </span>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${isHighContrast ? "text-white/90" : "text-zinc-300"}`}>
                    <span className="inline-block h-3 w-5 rounded bg-yellow-500/60 ring-1 ring-yellow-400/40" aria-hidden />
                    Watch
                  </span>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${isHighContrast ? "text-white/90" : "text-zinc-300"}`}>
                    <span className="inline-block h-3 w-5 rounded bg-red-500/50 ring-1 ring-red-400/30" aria-hidden />
                    Critical
                  </span>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className={`ml-1 flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium no-print sm:ml-2 ${isHighContrast ? "border-white/30 bg-white/10 text-white/90 hover:bg-white/20" : "border-zinc-600 bg-zinc-700/80 text-zinc-200 hover:bg-zinc-600"}`}
                    title="Export / Save as PDF (opens print dialog)"
                    aria-label="Export as PDF"
                  >
                    <FileDown className="h-3.5 w-3.5" aria-hidden />
                    Export PDF
                  </button>
                </div>
                <p className={`mt-2 w-full text-xs md:hidden ${isHighContrast ? "text-white/70" : "text-zinc-500"}`}>
                  Scale: 1–4 poor, 5–7 okay, 8+ great
                </p>
              </div>
              <div className={`overflow-x-auto ${isHighContrast ? "rounded-b-xl ring-1 ring-white/10" : ""}`}>
                <table className={`w-full text-left text-sm ${isHighContrast ? "border border-white/10" : ""}`}>
                  <thead className={`sticky top-0 z-10 border-b-2 shadow-md ${isHighContrast ? "border-white/25 bg-white/12 text-white" : "border-zinc-500 bg-zinc-800 text-zinc-200"}`}>
                    <tr>
                      <th className="px-4 py-2.5 text-base font-bold">Player</th>
                      <th className="px-4 py-2.5 text-base font-bold">Illness</th>
                      <th className="px-4 py-2.5 text-base font-bold">Bed – Wake</th>
                      <th className="px-4 py-2.5 text-base font-bold">Sleep (h)</th>
                      <th className="min-w-[5rem] px-2 py-2.5 text-center text-base font-bold">Sleep quality</th>
                      <th className="min-w-[5rem] px-2 py-2.5 text-center text-base font-bold">Fatigue</th>
                      <th className="min-w-[5rem] px-2 py-2.5 text-center text-base font-bold">Soreness</th>
                      <th className="min-w-[5rem] px-2 py-2.5 text-center text-base font-bold">Stress</th>
                      <th className="min-w-[5rem] px-2 py-2.5 text-center text-base font-bold">Mood</th>
                      <th className={`min-w-[5rem] border-l px-2 py-2.5 text-center text-base font-bold ${isHighContrast ? "border-white/20" : "border-zinc-600"}`}>Readiness</th>
                    </tr>
                  </thead>
                  <tbody className={isHighContrast ? "text-white/90" : "text-zinc-300"}>
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
                          <td className="px-4 py-2">
                            {r.illness === true ? (
                              <span className="rounded bg-red-600/30 px-2 py-1 text-sm font-semibold text-red-300">Yes</span>
                            ) : (
                              <span className="rounded bg-emerald-500/20 px-2 py-1 text-sm font-semibold text-emerald-400">No</span>
                            )}
                          </td>
                          <td className="px-4 py-2 tabular-nums">
                            {timeToHHmm(r.bed_time) != null && timeToHHmm(r.wake_time) != null
                              ? `${timeToHHmm(r.bed_time)} – ${timeToHHmm(r.wake_time)}`
                              : timeToHHmm(r.bed_time) ?? timeToHHmm(r.wake_time) ?? "—"}
                          </td>
                          <td className="px-4 py-2">
                            {r.sleep_duration != null ? (
                              <span
                                className="inline-flex min-w-[3rem] justify-center rounded-md px-3 py-1 tabular-nums font-semibold"
                                style={
                                  r.sleep_duration >= 8
                                    ? { backgroundColor: "rgba(16, 185, 129, 0.25)", color: "#34d399" }
                                    : r.sleep_duration >= 5
                                      ? { backgroundColor: "rgba(234, 179, 8, 0.3)", color: "#fde047" }
                                      : { backgroundColor: "rgba(220, 38, 38, 0.3)", color: "#fecaca" }
                                }
                              >
                                {r.sleep_duration}h
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <BadgeScore value={r.sleep_quality} type="goodHigh" />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <BadgeScore value={r.fatigue} type="goodHigh" />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <BadgeScore value={r.soreness} type="goodHigh" />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <BadgeScore value={r.stress} type="goodHigh" />
                          </td>
                          <td className="px-2 py-2 text-center">
                            <BadgeScore value={r.mood} type="goodHigh" />
                          </td>
                          <td className={`border-l px-2 py-2 text-center ${isHighContrast ? "border-white/20" : "border-zinc-600"}`}>
                            <BadgeScore value={wellnessAverageFromRow(r)} type="goodHigh" />
                          </td>
                        </RiskRowHighlight>
                      );
                    })}
                  </tbody>
                  {filteredAndSorted.length > 0 && (
                    <tfoot className={`border-t-2 ${isHighContrast ? "border-white/25 bg-white/8 text-white" : "border-zinc-500 bg-zinc-800/60 text-zinc-200"}`}>
                      <tr>
                        <td className="px-4 py-2.5 font-semibold" colSpan={9}>
                          Team average
                        </td>
                        <td className={`border-l px-2 py-2.5 text-center ${isHighContrast ? "border-white/20" : "border-zinc-600"}`}>
                          <BadgeScore value={teamReadinessAvg} type="goodHigh" />
                        </td>
                      </tr>
                    </tfoot>
                  )}
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
            className={`rounded-xl border px-4 py-4 sm:px-5 ${isHighContrast ? "neon-card-text border-white/20" : "border-zinc-700"}`}
            style={themeId === "neon" ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS } : themeId === "matt" ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS } : { backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs font-medium ${isHighContrast ? "text-white/80" : "text-zinc-500"}`}>Map:</span>
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
            className={`overflow-hidden rounded-xl border ${isHighContrast ? "border-white/20" : "border-zinc-700"}`}
            style={themeId === "neon" ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS } : themeId === "matt" ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS } : { backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS }}
          >
            {/* Body parts – külön sáv + skála jelmagyarázat */}
            <div
              className={`flex w-full flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-5 ${isHighContrast ? "bg-white/10" : "bg-zinc-700/80"}`}
            >
              <div className="flex items-center gap-2">
                <UserRound className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                <span className={`text-base font-medium ${isHighContrast ? "text-white/90" : "text-zinc-300"}`}>Body parts</span>
              </div>
              <p className={`text-xs ${isHighContrast ? "text-white/70" : "text-zinc-500"}`}>
                Value 1–10: higher = stronger soreness/pain
              </p>
            </div>

            {/* Tartalom: Soreness + Pain */}
            <div className={`px-4 py-4 sm:px-5 ${isHighContrast ? "neon-card-text" : ""}`}>
            {/* Mobile: stacked list layout (unchanged) */}
            <div className="md:hidden">
            {/* Soreness – enyhe sárga háttér, sáv + lista */}
            <div className={`-mx-4 rounded-lg bg-amber-500/10 px-4 pt-0 pb-3 sm:-mx-5 sm:px-5 ${isHighContrast ? "bg-amber-500/15" : ""}`}>
              <div className="flex items-center gap-2 py-2">
                <Activity className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
                <span className="text-base font-semibold text-amber-700">Soreness</span>
              </div>
              <ul className="mt-3 space-y-3">
                {filteredAndSorted
                  .filter((r) => splitBodyParts(r.body_parts).soreness.length > 0)
                  .map((r) => {
                    const displayName = displayNameByUserId[r.user_id] ?? emailByUserId[r.user_id] ?? r.user_id;
                    const { soreness } = splitBodyParts(r.body_parts);
                    return (
                      <li key={r.id}>
                        <div className="rounded-lg bg-white/5 px-3 py-2.5">
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
                  <li className={`text-sm ${isHighContrast ? "text-white/60" : "text-zinc-500"}`}>No soreness reported.</li>
                )}
              </ul>
            </div>

            {/* Pain – enyhe piros háttér, sáv + lista */}
            <div className={`mt-6 -mx-4 rounded-lg bg-red-500/10 px-4 pt-0 pb-3 sm:-mx-5 sm:px-5 ${isHighContrast ? "bg-red-500/15" : ""}`}>
              <div className="flex items-center gap-2 py-2">
                <AlertTriangle className="h-5 w-5 shrink-0 text-red-700" aria-hidden />
                <span className="text-base font-semibold text-red-700">Pain</span>
              </div>
              <ul className="mt-3 space-y-3">
                {filteredAndSorted
                  .filter((r) => splitBodyParts(r.body_parts).pain.length > 0)
                  .map((r) => {
                    const displayName = displayNameByUserId[r.user_id] ?? emailByUserId[r.user_id] ?? r.user_id;
                    const { pain } = splitBodyParts(r.body_parts);
                    return (
                      <li key={r.id}>
                        <div className="rounded-lg bg-white/5 px-3 py-2.5">
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
                  <li className={`text-sm ${isHighContrast ? "text-white/60" : "text-zinc-500"}`}>No pain reported.</li>
                )}
              </ul>
            </div>
            </div>

            {/* Laptop only: two tables side by side under Body parts */}
            <div className="hidden md:grid md:grid-cols-2 md:gap-4">
              {/* Soreness table */}
              <div className={`overflow-hidden rounded-lg bg-amber-500/10 ${isHighContrast ? "bg-amber-500/15" : ""}`}>
                <div className="flex items-center gap-2 border-b border-amber-500/30 px-3 py-2">
                  <Activity className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
                  <span className="text-base font-semibold text-amber-700">Soreness</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[200px] text-sm">
                    <thead>
                      <tr className={`border-b ${isHighContrast ? "border-white/20" : "border-zinc-600"}`}>
                        <th className="px-3 py-2 text-left font-semibold">Player</th>
                        <th className="px-3 py-2 text-left font-semibold">Body part</th>
                        <th className="px-3 py-2 text-center font-semibold">Value (1–10)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAndSorted
                        .filter((r) => splitBodyParts(r.body_parts).soreness.length > 0)
                        .map((r) => {
                          const displayName = displayNameByUserId[r.user_id] ?? emailByUserId[r.user_id] ?? r.user_id;
                          const soreness = splitBodyParts(r.body_parts).soreness;
                          return soreness.map(({ label, value }, idx) => {
                            const isLastRow = idx === soreness.length - 1;
                            return (
                              <tr
                                key={`${r.id}-${label}`}
                                className={`border-b ${isLastRow ? "border-amber-500/70 border-b-4" : isHighContrast ? "border-white/10" : "border-zinc-700/80"}`}
                              >
                                {idx === 0 && (
                                  <td rowSpan={soreness.length} className="align-top px-3 py-2">
                                    <button type="button" onClick={() => setModalUserId(r.user_id)} className="text-emerald-400 hover:underline">
                                      {displayName}
                                    </button>
                                  </td>
                                )}
                                <td className="px-3 py-2 text-zinc-300">{label}</td>
                                <td className="px-3 py-2 text-center">
                                  <span
                                    className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded px-1.5 text-xs font-bold tabular-nums"
                                    style={sorenessBadgeStyle(value)}
                                  >
                                    {value}
                                  </span>
                                </td>
                              </tr>
                            );
                          });
                        })}
                      {filteredAndSorted.every((r) => splitBodyParts(r.body_parts).soreness.length === 0) && (
                        <tr><td colSpan={3} className={`px-3 py-4 text-center text-sm ${isHighContrast ? "text-white/60" : "text-zinc-500"}`}>No soreness reported.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pain table */}
              <div className={`overflow-hidden rounded-lg bg-red-500/10 ${isHighContrast ? "bg-red-500/15" : ""}`}>
                <div className="flex items-center gap-2 border-b border-red-500/30 px-3 py-2">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-red-700" aria-hidden />
                  <span className="text-base font-semibold text-red-700">Pain</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[200px] text-sm">
                    <thead>
                      <tr className={`border-b ${isHighContrast ? "border-white/20" : "border-zinc-600"}`}>
                        <th className="px-3 py-2 text-left font-semibold">Player</th>
                        <th className="px-3 py-2 text-left font-semibold">Body part</th>
                        <th className="px-3 py-2 text-center font-semibold">Value (1–10)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAndSorted
                        .filter((r) => splitBodyParts(r.body_parts).pain.length > 0)
                        .map((r) => {
                          const displayName = displayNameByUserId[r.user_id] ?? emailByUserId[r.user_id] ?? r.user_id;
                          const pain = splitBodyParts(r.body_parts).pain;
                          return pain.map(({ label, value }, idx) => {
                            const isLastRow = idx === pain.length - 1;
                            return (
                              <tr
                                key={`${r.id}-${label}`}
                                className={`border-b ${isLastRow ? "border-red-500/70 border-b-4" : isHighContrast ? "border-white/10" : "border-zinc-700/80"}`}
                              >
                                {idx === 0 && (
                                  <td rowSpan={pain.length} className="align-top px-3 py-2">
                                    <button type="button" onClick={() => setModalUserId(r.user_id)} className="text-emerald-400 hover:underline">
                                      {displayName}
                                    </button>
                                  </td>
                                )}
                                <td className="px-3 py-2 text-zinc-300">{label}</td>
                                <td className="px-3 py-2 text-center">
                                  <span
                                    className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded px-1.5 text-xs font-bold tabular-nums"
                                    style={painBadgeStyle(value)}
                                  >
                                    {value}
                                  </span>
                                </td>
                              </tr>
                            );
                          });
                        })}
                      {filteredAndSorted.every((r) => splitBodyParts(r.body_parts).pain.length === 0) && (
                        <tr><td colSpan={3} className={`px-3 py-4 text-center text-sm ${isHighContrast ? "text-white/60" : "text-zinc-500"}`}>No pain reported.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
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
