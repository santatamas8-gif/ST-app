"use client";

import { useMemo, useRef, useState } from "react";
import { X, Pill, Clock, Moon, BatteryLow, Activity, Brain, Smile, Gauge, HeartPulse } from "lucide-react";
import type { WellnessRow } from "@/lib/types";
import { wellnessAverageFromRow } from "@/utils/wellness";
import { formatSleepDuration } from "@/utils/sleep";
import { useTheme } from "@/components/ThemeProvider";
import { NEON_CARD_STYLE, MATT_CARD_STYLE } from "@/lib/themes";
import { BodyMapViewOnly } from "@/components/BodyMap";
import { BadgeScore } from "@/app/(app)/wellness/components/BadgeScore";
import { getBodyPartLabel } from "@/lib/bodyMapParts";

const CARD_RADIUS = "12px";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function timeToHHmm(s: string | null | undefined): string | null {
  if (!s || typeof s !== "string") return null;
  const parts = s.trim().split(":");
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
  return s;
}

type FilterChip = "all" | "missing" | "watch" | "critical";

/** Bands: 1–4 = Critical, 5–7 = Watch, 8+ = Good. Pain/illness = Critical. */
function getStatusBadge(
  statusOrReadiness: "Good" | "Watch" | "Critical" | number | null
): { label: string; className: string } {
  const status: "Good" | "Watch" | "Critical" =
    typeof statusOrReadiness === "string"
      ? statusOrReadiness
      : statusOrReadiness == null
        ? "Good"
        : statusOrReadiness <= 4
          ? "Critical"
          : statusOrReadiness <= 7
            ? "Watch"
            : "Good";
  if (status === "Critical")
    return { label: "Critical", className: "bg-red-500/50 text-red-300 ring-1 ring-red-400/30" };
  if (status === "Watch")
    return { label: "Watch", className: "bg-yellow-500/60 text-yellow-400 ring-1 ring-yellow-400/40" };
  return { label: "Good", className: "bg-emerald-500/50 text-emerald-400 ring-1 ring-emerald-400/30" };
}

/** Band by average (readiness) only; pain/illness shown as separate chip. */
function getStatusLabel(row: WellnessRow, readiness: number | null): "Good" | "Watch" | "Critical" {
  if (readiness == null) return "Good";
  if (readiness <= 4) return "Critical";
  if (readiness <= 7) return "Watch";
  return "Good";
}

const SORT_ORDER: Record<string, number> = { Critical: 0, Watch: 1, Missing: 2, Good: 3 };

/** High risk = Critical zone only (1–4). Pain/illness always listed. */
function getTopIssues(row: WellnessRow): string[] {
  const issues: string[] = [];
  if (row.illness === true) issues.push("Illness");
  if (
    row.body_parts &&
    Object.values(row.body_parts).some((v) => (v.p ?? 0) > 0)
  )
    issues.push("Pain");
  if (row.sleep_quality != null && row.sleep_quality < 5) issues.push("Sleep low");
  if (row.sleep_duration != null && row.sleep_duration < 8) issues.push("Sleep short");
  if (row.fatigue != null && row.fatigue < 5) issues.push("Fatigue low");
  if (row.soreness != null && row.soreness < 5) issues.push("Soreness low");
  if (row.stress != null && row.stress < 5) issues.push("Stress low");
  if (row.mood != null && row.mood < 5) issues.push("Mood low");
  return issues.slice(0, 3);
}

function readinessColorClass(readiness: number | null | undefined, isHighContrast: boolean): string {
  if (readiness == null) {
    return isHighContrast ? "text-white" : "text-zinc-200";
  }
  if (readiness < 5) {
    // 1–4.9: piros
    return "text-red-400";
  }
  if (readiness < 8) {
    // 5–7.9: sárga
    return "text-amber-300";
  }
  // 8+: zöld
  return "text-emerald-300";
}

export interface MobileWellnessListProps {
  list: WellnessRow[];
  emailByUserId: Record<string, string>;
  displayNameByUserId: Record<string, string>;
  totalPlayers?: number | null;
  allPlayerIds?: string[];
}

export function MobileWellnessList({
  list,
  emailByUserId,
  displayNameByUserId,
  allPlayerIds = [],
}: MobileWellnessListProps) {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [filter, setFilter] = useState<FilterChip>("all");
  const [detailRow, setDetailRow] = useState<WellnessRow | null>(null);
  const [bodyMapMode, setBodyMapMode] = useState<"soreness" | "pain">("soreness");
  const [bodyMapView, setBodyMapView] = useState<"front" | "back">("front");
  const [showCopied, setShowCopied] = useState(false);
  const copiedToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";

  const copyReminder = (playerName: string) => {
    const text = `Hi ${playerName}, please complete today's wellness check in STAMS.`;

    const showCopiedToast = () => {
      if (copiedToastTimeoutRef.current != null) clearTimeout(copiedToastTimeoutRef.current);
      setShowCopied(true);
      copiedToastTimeoutRef.current = setTimeout(() => {
        setShowCopied(false);
        copiedToastTimeoutRef.current = null;
      }, 2000);
    };

    const fallbackTextarea = (): boolean => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    };

    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(showCopiedToast).catch(() => {
          if (fallbackTextarea()) showCopiedToast();
          else window.prompt("Copy this message:", text);
        });
      } else if (fallbackTextarea()) {
        showCopiedToast();
      } else {
        window.prompt("Copy this message:", text);
      }
    } catch {
      if (fallbackTextarea()) showCopiedToast();
      else window.prompt("Copy this message:", text);
    }
  };

  const rowsForDate = useMemo(
    () => list.filter((r) => r.date === selectedDate),
    [list, selectedDate]
  );
  const submittedUserIds = useMemo(
    () => new Set(rowsForDate.map((r) => r.user_id)),
    [rowsForDate]
  );
  const missingUserIds = useMemo(
    () => allPlayerIds.filter((id) => !submittedUserIds.has(id)),
    [allPlayerIds, submittedUserIds]
  );

  const [sortByReadiness, setSortByReadiness] = useState<"none" | "asc" | "desc">("none");

  const sortedAndFiltered = useMemo(() => {
    type Item = { type: "row"; row: WellnessRow; status: string } | { type: "missing"; user_id: string };
    const items: Item[] = [];
    rowsForDate.forEach((r) => {
      const readiness = wellnessAverageFromRow(r);
      items.push({ type: "row", row: r, status: getStatusLabel(r, readiness ?? null) });
    });
    missingUserIds.forEach((user_id) => {
      items.push({ type: "missing", user_id });
    });
    const filtered =
      filter === "all"
        ? items
        : filter === "missing"
          ? items.filter((i) => i.type === "missing")
          : items.filter((i) => i.type === "row" && i.status.toLowerCase() === filter);
    const baseSorted = filtered.sort((a, b) => {
      const submittedFirst = (a.type === "row" ? 0 : 1) - (b.type === "row" ? 0 : 1);
      if (submittedFirst !== 0) return submittedFirst;
      if (a.type === "row" && b.type === "row")
        return (SORT_ORDER[a.status] ?? 4) - (SORT_ORDER[b.status] ?? 4);
      return 0;
    });
    if (sortByReadiness === "none") return baseSorted;
    return [...baseSorted].sort((a, b) => {
      if (a.type !== "row" && b.type === "row") return 1;
      if (a.type === "row" && b.type !== "row") return -1;
      if (a.type !== "row" && b.type !== "row") return 0;
      const ra = a.type === "row" ? wellnessAverageFromRow(a.row) ?? 0 : 0;
      const rb = b.type === "row" ? wellnessAverageFromRow(b.row) ?? 0 : 0;
      return sortByReadiness === "asc" ? ra - rb : rb - ra;
    });
  }, [rowsForDate, missingUserIds, filter, sortByReadiness]);

  return (
    <div className="min-h-screen min-w-0 -mx-4 overflow-x-hidden px-3 py-4 sm:py-6 sm:mx-0 sm:px-4" style={{ backgroundColor: "var(--page-bg)" }}>
      <div className="mx-auto max-w-7xl min-w-0">
        {/* Sticky filter/search header - mobile only */}
        <div className="sticky top-0 z-10 -mx-3 px-3 py-3 pb-2" style={{ backgroundColor: "var(--page-bg)" }}>
          <div
            className={`flex flex-col items-center rounded-xl border px-4 py-3 text-center shadow-sm ${themeId === "neon" ? "border-emerald-500/30 bg-emerald-950/20 ring-1 ring-emerald-500/20" : isHighContrast ? "border-white/15 bg-white/5" : "border-emerald-500/35 bg-emerald-950/25 ring-1 ring-emerald-500/25"}`}
          >
            <h1 className="flex items-center justify-center gap-2 text-lg font-bold tracking-tight text-white">
              <HeartPulse className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
              Wellness
            </h1>
            <span className={`mt-1 text-xs font-medium ${isHighContrast ? "text-white/70" : "text-zinc-500"}`}>
              Daily check-ins by date
            </span>
          </div>
          <div className="mt-2 flex justify-center w-full">
            <div
              className="inline-flex w-full max-w-md items-center gap-2 rounded-[14px] border p-2"
              style={{
                backgroundColor: isHighContrast ? "rgba(255,255,255,0.06)" : "rgba(15,23,32,0.9)",
                borderColor: isHighContrast ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.05)",
              }}
            >
              <span className={`shrink-0 text-sm font-medium ${isHighContrast ? "text-white/90" : "text-zinc-300"}`}>Date</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={`min-h-[36px] flex-1 min-w-0 rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 ${
                  isHighContrast
                    ? "border-white/20 bg-white/5 text-white focus:border-white/40 focus:ring-white/20"
                    : "border-white/10 bg-white/5 text-white focus:border-white/20 focus:ring-white/10"
                }`}
              />
              <button
                type="button"
                onClick={() => setSelectedDate(todayISO())}
                className={`min-h-[36px] shrink-0 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors ${
                  isHighContrast
                    ? "border-white/20 bg-white/5 text-white/90 hover:bg-white/15"
                    : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() =>
                  setSortByReadiness((prev) =>
                    prev === "none" ? "desc" : prev === "desc" ? "asc" : "none",
                  )
                }
                className={`flex h-9 w-9 items-center justify-center rounded-lg border text-[11px] font-medium ${
                  sortByReadiness === "none"
                    ? isHighContrast
                      ? "border-white/20 bg-white/5 text-white/80"
                      : "border-white/10 bg-white/5 text-zinc-300"
                    : "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                }`}
                aria-label="Sort by readiness"
              >
                {sortByReadiness === "asc" ? "↑" : sortByReadiness === "desc" ? "↓" : "↕"}
              </button>
            </div>
          </div>
          <div className="mt-2 flex w-full justify-center">
            <div
              className="inline-flex w-full max-w-md rounded-[14px] border p-0.5 h-10"
              style={{
                backgroundColor: isHighContrast ? "rgba(255,255,255,0.06)" : "rgba(15,23,32,0.9)",
                borderColor: isHighContrast ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.08)",
              }}
            >
              {(["all", "missing", "watch", "critical"] as const).map((key) => {
                const isActive = filter === key;
                const activeBg =
                  key === "all"
                    ? "bg-emerald-600/90"
                    : key === "missing"
                      ? "bg-zinc-500/70"
                      : key === "watch"
                        ? "bg-yellow-500/90"
                        : "bg-red-600/90";
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={`min-w-0 flex-1 rounded-[10px] text-xs font-medium capitalize transition-all duration-200 ${
                      isActive ? `${activeBg} text-white` : "bg-transparent text-gray-400 hover:text-gray-300 hover:bg-white/5 active:bg-white/10"
                    }`}
                  >
                    {key}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {sortedAndFiltered.length === 0 ? (
          <div
            className={`mt-2 rounded-xl border px-4 py-8 text-center ${isHighContrast ? "border-white/20" : "border-zinc-700"}`}
            style={
              themeId === "neon"
                ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
                : themeId === "matt"
                  ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS }
                  : { backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS }
            }
          >
            <p className={isHighContrast ? "text-white/90" : "text-zinc-400"}>No players match the filter for this date.</p>
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
            {sortedAndFiltered.map((item) => {
              if (item.type === "missing") {
                const displayName = displayNameByUserId[item.user_id] ?? emailByUserId[item.user_id] ?? item.user_id;
                return (
                  <li key={`missing-${item.user_id}`}>
                    <div
                      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 ${isHighContrast ? "border-white/20 bg-white/5" : "border-zinc-700"}`}
                      style={
                        themeId === "neon"
                          ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
                          : themeId === "matt"
                            ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS }
                            : { backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS }
                      }
                    >
                      <span className={`min-w-0 flex-1 truncate font-medium ${isHighContrast ? "text-white/80" : "text-zinc-400"}`}>
                        {displayName}
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${isHighContrast ? "bg-white/15 text-white/70" : "bg-zinc-600/60 text-zinc-400"}`}>
                        Missing
                      </span>
                    </div>
                  </li>
                );
              }
              const r = item.row;
              const displayName = displayNameByUserId[r.user_id] ?? emailByUserId[r.user_id] ?? r.user_id;
              const readiness = wellnessAverageFromRow(r);
              const status = getStatusLabel(r, readiness ?? null);
              const badge = getStatusBadge(status);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setDetailRow(r)}
                    className={`flex w-full items-center gap-2 rounded-xl border px-4 py-3 text-left transition ${
                      isHighContrast ? "border-white/20 bg-white/5 hover:bg-white/10" : "border-zinc-700 hover:bg-zinc-700/80"
                    }`}
                    style={
                      themeId === "neon"
                        ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
                        : themeId === "matt"
                          ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS }
                          : { backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS }
                    }
                  >
                    <span className="min-w-0 flex-1 truncate font-medium text-white">
                      {displayName}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 tabular-nums text-sm font-semibold ${readinessColorClass(
                        readiness,
                        isHighContrast,
                      )}`}
                    >
                      {readiness != null ? readiness.toFixed(1) : "—"}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                    {getTopIssues(r)
                      .filter((issue) => issue === "Pain" || issue === "Illness")
                      .map((issue) => (
                        <span
                          key={issue}
                          className="shrink-0 rounded bg-red-600/30 px-1.5 py-0.5 text-[10px] font-semibold text-red-300"
                        >
                          {issue}
                        </span>
                      ))}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {showCopied && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-lg ${
            isHighContrast ? "border border-white/20 bg-white/20" : "bg-zinc-700"
          }`}
          style={
            themeId === "neon"
              ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
              : themeId === "matt"
                ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS }
                : undefined
          }
          role="status"
          aria-live="polite"
        >
          Copied
        </div>
      )}

      {/* Mobile detail panel */}
      {detailRow && (
        <div
          className="fixed inset-0 z-50 flex flex-col overflow-x-hidden bg-gradient-to-b from-zinc-900 via-zinc-900/98 to-zinc-950"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-wellness-detail-title"
        >
          <div
            className={`sticky top-0 z-20 flex shrink-0 flex-col border-b px-4 pb-3 pt-2 ${isHighContrast ? "border-white/20" : "border-emerald-500/25"} bg-zinc-900/95 shadow-md`}
          >
            <div className="relative flex items-center justify-center min-h-[52px]">
              <h2 id="mobile-wellness-detail-title" className="text-xl font-bold tracking-tight text-white drop-shadow-sm text-center">
                {displayNameByUserId[detailRow.user_id] ?? emailByUserId[detailRow.user_id] ?? detailRow.user_id}
              </h2>
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                className="absolute right-0 top-1/2 -translate-y-1/2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-700/90 text-zinc-300 hover:bg-zinc-600 hover:text-white active:scale-95 transition-transform"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {(() => {
              const readiness = wellnessAverageFromRow(detailRow);
              const status = getStatusLabel(detailRow, readiness ?? null);
              const statusBadge = getStatusBadge(status);
              return (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`rounded-xl border-l-2 border-emerald-500/50 px-3 py-2 text-xs font-semibold text-white shadow-sm ${isHighContrast ? "bg-white/15" : "bg-zinc-800/90"}`}>
                    Readiness {readiness != null ? readiness.toFixed(1) : "—"}
                  </span>
                  <span className={`rounded-xl border-l-2 border-emerald-500/50 px-3 py-2 text-xs font-semibold text-white shadow-sm ${isHighContrast ? "bg-white/15" : "bg-zinc-800/90"}`}>
                    Sleep {detailRow.sleep_duration != null ? `${formatSleepDuration(detailRow.sleep_duration)}h` : "—"}
                  </span>
                  <span className={`rounded-xl px-3 py-2 text-xs font-semibold ring-1 ring-white/10 shadow-sm ${statusBadge.className}`}>
                    {statusBadge.label}
                  </span>
                </div>
              );
            })()}
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+96px)]">
            {getTopIssues(detailRow).length > 0 && (() => {
              const issues = getTopIssues(detailRow);
              const hasPainOrIllness = issues.some((i) => i === "Pain" || i === "Illness");
              const isRed = hasPainOrIllness;
              return (
                <div
                  className={`mb-4 rounded-xl border px-4 py-3 shadow-sm ${
                    isRed
                      ? "border-red-500/30 border-l-4 border-l-red-500/60 bg-red-500/10"
                      : "border-amber-500/30 border-l-4 border-l-amber-500/60 bg-amber-500/10"
                  }`}
                >
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide ${
                      isRed ? "text-red-400/90" : "text-amber-400/90"
                    }`}
                  >
                    Top issues
                  </p>
                  <ul
                    className={`mt-1.5 flex flex-wrap gap-x-1.5 gap-y-0.5 text-sm ${
                      isRed ? "text-red-200/90" : "text-amber-200/90"
                    }`}
                  >
                    {issues.map((issue, idx) => (
                      <li key={issue} className="flex items-center gap-1">
                        <span>{issue}</span>
                        {idx < issues.length - 1 && <span className="opacity-70">·</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}
            <div className="mb-4 rounded-xl border border-emerald-500/25 bg-zinc-800/50 px-4 py-3.5 shadow-sm ring-1 ring-emerald-500/5">
              <dl className={`divide-y divide-zinc-700/50 text-sm ${isHighContrast ? "text-white/90" : ""}`}>
              <div className="flex justify-between gap-3 items-center py-3.5 first:pt-0">
                <dt className={`flex items-center gap-2.5 font-medium ${isHighContrast ? "text-white/70" : "text-zinc-300"}`}>
                  <Pill className="h-4 w-4 shrink-0 text-emerald-400/70" aria-hidden />
                  Illness
                </dt>
                <dd>
                  {detailRow.illness === true ? (
                    <span className="rounded-md bg-red-500/25 px-2.5 py-1 text-xs font-semibold text-red-400 ring-1 ring-red-500/30">Yes</span>
                  ) : (
                    <span className="rounded-md bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/25">No</span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-3 items-center py-3.5">
                <dt className={`flex items-center gap-2.5 font-medium ${isHighContrast ? "text-white/70" : "text-zinc-300"}`}>
                  <Clock className="h-4 w-4 shrink-0 text-emerald-400/70" aria-hidden />
                  Bed → Wake
                </dt>
                <dd
                  className={`rounded-lg px-2.5 py-1.5 tabular-nums font-medium ring-1 ${
                    detailRow.sleep_duration != null
                      ? detailRow.sleep_duration >= 8
                        ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20"
                        : detailRow.sleep_duration >= 6
                          ? "bg-amber-500/15 text-amber-300 ring-amber-500/25"
                          : "bg-red-500/15 text-red-300 ring-red-500/25"
                      : "bg-zinc-700/50 text-white ring-zinc-600/50"
                  }`}
                >
                  {timeToHHmm(detailRow.bed_time) != null && timeToHHmm(detailRow.wake_time) != null
                    ? `${timeToHHmm(detailRow.bed_time)} → ${timeToHHmm(detailRow.wake_time)}`
                    : timeToHHmm(detailRow.bed_time) ?? timeToHHmm(detailRow.wake_time) ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3 items-center py-3.5">
                <dt className={`flex items-center gap-2.5 font-medium ${isHighContrast ? "text-white/70" : "text-zinc-300"}`}>
                  <Moon className="h-4 w-4 shrink-0 text-emerald-400/70" aria-hidden />
                  Sleep quality
                </dt>
                <dd>
                  <BadgeScore value={detailRow.sleep_quality} type="goodHigh" />
                </dd>
              </div>
              <div className="flex justify-between gap-3 items-center py-3.5">
                <dt className={`flex items-center gap-2.5 font-medium ${isHighContrast ? "text-white/70" : "text-zinc-300"}`}>
                  <BatteryLow className="h-4 w-4 shrink-0 text-emerald-400/70" aria-hidden />
                  Fatigue
                </dt>
                <dd>
                  <BadgeScore value={detailRow.fatigue} type="goodHigh" />
                </dd>
              </div>
              <div className="flex justify-between gap-3 items-center py-3.5">
                <dt className={`flex items-center gap-2.5 font-medium ${isHighContrast ? "text-white/70" : "text-zinc-300"}`}>
                  <Activity className="h-4 w-4 shrink-0 text-emerald-400/70" aria-hidden />
                  Soreness
                </dt>
                <dd>
                  <BadgeScore value={detailRow.soreness} type="goodHigh" />
                </dd>
              </div>
              <div className="flex justify-between gap-3 items-center py-3.5">
                <dt className={`flex items-center gap-2.5 font-medium ${isHighContrast ? "text-white/70" : "text-zinc-300"}`}>
                  <Brain className="h-4 w-4 shrink-0 text-emerald-400/70" aria-hidden />
                  Stress
                </dt>
                <dd>
                  <BadgeScore value={detailRow.stress} type="goodHigh" />
                </dd>
              </div>
              <div className="flex justify-between gap-3 items-center py-3.5">
                <dt className={`flex items-center gap-2.5 font-medium ${isHighContrast ? "text-white/70" : "text-zinc-300"}`}>
                  <Smile className="h-4 w-4 shrink-0 text-emerald-400/70" aria-hidden />
                  Mood
                </dt>
                <dd>
                  <BadgeScore value={detailRow.mood} type="goodHigh" />
                </dd>
              </div>
              <div className="flex justify-between gap-3 items-center py-3.5 last:pb-0">
                <dt className={`flex items-center gap-2.5 font-medium ${isHighContrast ? "text-white/70" : "text-zinc-300"}`}>
                  <Gauge className="h-4 w-4 shrink-0 text-emerald-400/70" aria-hidden />
                  Readiness
                </dt>
                <dd>
                  <BadgeScore value={wellnessAverageFromRow(detailRow)} type="goodHigh" />
                </dd>
              </div>
              </dl>
            </div>

            {/* Body map – only inside player details panel on mobile; one view at a time */}
            {detailRow.body_parts && Object.keys(detailRow.body_parts).length > 0 && (
              <div
                className={`mt-6 rounded-xl border px-4 py-4 ${themeId === "neon" ? "neon-card-text border-white/20" : themeId === "matt" ? "matt-card-text border-white/20" : "border-emerald-500/25 bg-emerald-500/5 ring-1 ring-emerald-500/10"}`}
                style={
                  themeId === "neon"
                    ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
                    : themeId === "matt"
                      ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS }
                      : { borderRadius: CARD_RADIUS }
                }
              >
                {/* Csak mobil sheet: Body map feljebb zölddel, Mode/View kis felirat a sorok fölé */}
                <div className="mb-3">
                  <div className="flex justify-center">
                    <span
                      className={`text-xs font-semibold uppercase ${
                        isHighContrast ? "text-white/90" : "text-emerald-400"
                      }`}
                    >
                      Body map
                    </span>
                  </div>
                  <div className="mt-1.5 flex justify-center">
                    <div className="w-full max-w-[12rem]">
                      <p className={`mb-0.5 text-[9px] font-medium uppercase tracking-wide ${isHighContrast ? "text-white/60" : "text-zinc-500"}`}>
                        Mode
                      </p>
                      <div className="grid grid-cols-2 grid-rows-[1.85rem] gap-1">
                        <button
                          type="button"
                          onClick={() => setBodyMapMode("soreness")}
                          className={`flex items-center justify-center rounded border text-xs font-medium transition ${
                            bodyMapMode === "soreness"
                              ? "border-amber-500/50 bg-amber-600 text-white"
                              : isHighContrast
                                ? "border-white/20 bg-white/10 text-white/80"
                                : "border-zinc-600/80 bg-zinc-700/80 text-zinc-400"
                          }`}
                        >
                          Soreness
                        </button>
                        <button
                          type="button"
                          onClick={() => setBodyMapMode("pain")}
                          className={`flex items-center justify-center rounded border text-xs font-medium transition ${
                            bodyMapMode === "pain"
                              ? "border-red-500/50 bg-red-600 text-white"
                              : isHighContrast
                                ? "border-white/20 bg-white/10 text-white/80"
                                : "border-zinc-600/80 bg-zinc-700/80 text-zinc-400"
                          }`}
                        >
                          Pain
                        </button>
                      </div>
                      <p className={`mb-0.5 mt-1 text-[9px] font-medium uppercase tracking-wide ${isHighContrast ? "text-white/60" : "text-zinc-500"}`}>
                        View
                      </p>
                      <div className="grid grid-cols-2 grid-rows-[1.85rem] gap-1">
                        <button
                          type="button"
                          onClick={() => setBodyMapView("front")}
                          className={`flex items-center justify-center rounded border text-xs font-medium transition ${
                            bodyMapView === "front"
                              ? "border-emerald-500/50 bg-emerald-600 text-white"
                              : isHighContrast
                                ? "border-white/20 bg-white/10 text-white/80"
                                : "border-zinc-600/80 bg-zinc-700/80 text-zinc-400"
                          }`}
                        >
                          Front
                        </button>
                        <button
                          type="button"
                          onClick={() => setBodyMapView("back")}
                          className={`flex items-center justify-center rounded border text-xs font-medium transition ${
                            bodyMapView === "back"
                              ? "border-emerald-500/50 bg-emerald-600 text-white"
                              : isHighContrast
                                ? "border-white/20 bg-white/10 text-white/80"
                                : "border-zinc-600/80 bg-zinc-700/80 text-zinc-400"
                          }`}
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  className={
                    bodyMapView === "front"
                      ? "[&>div>div>div:first-child]:block [&>div>div>div:last-child]:hidden"
                      : "[&>div>div>div:first-child]:hidden [&>div>div>div:last-child]:block"
                  }
                >
                  <BodyMapViewOnly
                    bodyParts={detailRow.body_parts}
                    mode={bodyMapMode}
                    hideLabels
                    size="default"
                  />
                </div>
                <ul className="mt-3 space-y-2 text-sm">
                  {Object.entries(detailRow.body_parts)
                    .filter(([, v]) => (v.s ?? 0) > 0 || (v.p ?? 0) > 0)
                    .sort(([, a], [, b]) => {
                      const ap = a.p ?? 0;
                      const bp = b.p ?? 0;
                      if (ap > 0 && bp === 0) return -1;
                      if (ap === 0 && bp > 0) return 1;
                      return 0;
                    })
                    .map(([partId, v]) => {
                      const s = v.s ?? 0;
                      const p = v.p ?? 0;
                      const label = getBodyPartLabel(partId);
                      const hasBoth = s > 0 && p > 0;
                      const leftAccent = hasBoth ? "border-l-amber-400/60" : p > 0 ? "border-l-red-500/70" : "border-l-amber-500/70";
                      return (
                        <li
                          key={partId}
                          className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border-l-4 ${leftAccent} bg-zinc-800/80 px-3 py-2.5 shadow-sm ${isHighContrast ? "text-white/90" : "text-zinc-300"}`}
                        >
                          <span className="font-medium">{label}</span>
                          <span className="flex items-center gap-2">
                            {p > 0 && (
                              <span className="rounded-md bg-red-500/25 px-2 py-0.5 text-xs font-semibold text-red-400 ring-1 ring-red-500/30">
                                Pain {p}
                              </span>
                            )}
                            {s > 0 && (
                              <span className="rounded-md bg-amber-500/25 px-2 py-0.5 text-xs font-semibold text-amber-400 ring-1 ring-amber-500/30">
                                Soreness {s}
                              </span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
