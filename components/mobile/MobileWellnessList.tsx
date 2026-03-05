"use client";

import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { WellnessRow } from "@/lib/types";
import { wellnessAverageFromRow } from "@/utils/wellness";
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

function getStatusBadge(readiness: number | null): { label: string; className: string } {
  if (readiness == null) return { label: "—", className: "bg-zinc-600/60 text-zinc-400" };
  if (readiness <= 3) return { label: "Critical", className: "bg-red-500/50 text-red-300 ring-1 ring-red-400/30" };
  if (readiness <= 6) return { label: "Watch", className: "bg-yellow-500/60 text-yellow-400 ring-1 ring-yellow-400/40" };
  return { label: "Good", className: "bg-emerald-500/50 text-emerald-400 ring-1 ring-emerald-400/30" };
}

function getStatusLabel(readiness: number | null): "Good" | "Watch" | "Critical" {
  if (readiness == null) return "Good";
  if (readiness <= 3) return "Critical";
  if (readiness <= 6) return "Watch";
  return "Good";
}

const SORT_ORDER: Record<string, number> = { Critical: 0, Watch: 1, Missing: 2, Good: 3 };

/** Max 3 top issues from row values (simple thresholds). */
function getTopIssues(row: WellnessRow): string[] {
  const issues: string[] = [];
  if (row.illness === true) issues.push("Illness");
  if (row.sleep_quality != null && row.sleep_quality <= 3) issues.push("Sleep low");
  if (row.sleep_duration != null && row.sleep_duration < 8) issues.push("Sleep short");
  if (row.fatigue != null && row.fatigue >= 7) issues.push("Fatigue high");
  if (row.soreness != null && row.soreness >= 7) issues.push("Soreness high");
  if (row.stress != null && row.stress >= 7) issues.push("Stress high");
  if (row.mood != null && row.mood <= 3) issues.push("Mood low");
  return issues.slice(0, 3);
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

  const sortedAndFiltered = useMemo(() => {
    type Item = { type: "row"; row: WellnessRow; status: string } | { type: "missing"; user_id: string };
    const items: Item[] = [];
    rowsForDate.forEach((r) => {
      const readiness = wellnessAverageFromRow(r);
      items.push({ type: "row", row: r, status: getStatusLabel(readiness ?? null) });
    });
    missingUserIds.forEach((user_id) => {
      items.push({ type: "missing", user_id });
    });
    const filtered =
      filter === "all"
        ? items
        : filter === "missing"
          ? items.filter((i) => i.type === "missing")
          : items.filter((i) => i.type === "row" && i.status === filter);
    return filtered.sort((a, b) => {
      const statusA = a.type === "row" ? a.status : "Missing";
      const statusB = b.type === "row" ? b.status : "Missing";
      return (SORT_ORDER[statusA] ?? 4) - (SORT_ORDER[statusB] ?? 4);
    });
  }, [rowsForDate, missingUserIds, filter]);

  return (
    <div className="min-h-screen px-4 py-6" style={{ backgroundColor: "var(--page-bg)" }}>
      <div className="mx-auto max-w-7xl">
        {/* Sticky filter/search header */}
        <div className="sticky top-0 z-10 -mx-4 px-4 py-3 pb-4" style={{ backgroundColor: "var(--page-bg)" }}>
          <h1 className="text-lg font-bold tracking-tight text-white">Wellness</h1>
          <p className={`mt-1 text-sm ${isHighContrast ? "text-white/70" : "text-zinc-500"}`}>
            Daily submissions. Table and body map by selected date.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className={`flex items-center gap-1.5 text-sm ${isHighContrast ? "text-white/90" : "text-zinc-400"}`}>
              Date
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={`min-h-[36px] rounded-md border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 ${
                  isHighContrast
                    ? "border-white/30 bg-white/10 text-white focus:border-white/60 focus:ring-white/40"
                    : "border-zinc-600 bg-zinc-800/80 text-white focus:border-emerald-500 focus:ring-emerald-500"
                }`}
              />
            </label>
            <button
              type="button"
              onClick={() => setSelectedDate(todayISO())}
              className={`min-h-[36px] shrink-0 rounded-md border px-2.5 py-1.5 text-sm font-medium ${
                isHighContrast
                  ? "border-white/30 bg-white/10 text-white/90 hover:bg-white/20"
                  : "border-zinc-600 bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700/80"
              }`}
            >
              Today
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["all", "missing", "watch", "critical"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition ${
                  filter === key
                    ? "bg-emerald-600 text-white"
                    : isHighContrast
                      ? "bg-white/10 text-white/80 hover:bg-white/20"
                      : "bg-zinc-700/80 text-zinc-400 hover:bg-zinc-600"
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        {sortedAndFiltered.length === 0 ? (
          <div
            className={`mt-4 rounded-xl border px-4 py-8 text-center ${isHighContrast ? "border-white/20" : "border-zinc-700"}`}
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
          <ul className="mt-4 space-y-2">
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
                      <span className={`shrink-0 tabular-nums ${isHighContrast ? "text-white/60" : "text-zinc-500"}`}>—</span>
                      <span className={`shrink-0 tabular-nums ${isHighContrast ? "text-white/60" : "text-zinc-500"}`}>—</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${isHighContrast ? "bg-white/15 text-white/70" : "bg-zinc-600/60 text-zinc-400"}`}>
                        Missing
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyReminder(displayName);
                        }}
                        className="shrink-0 rounded-lg bg-emerald-600/80 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
                      >
                        Remind
                      </button>
                    </div>
                  </li>
                );
              }
              const r = item.row;
              const displayName = displayNameByUserId[r.user_id] ?? emailByUserId[r.user_id] ?? r.user_id;
              const readiness = wellnessAverageFromRow(r);
              const badge = getStatusBadge(readiness ?? null);
              const sleepHours = r.sleep_duration != null ? `${r.sleep_duration}h` : "—";
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setDetailRow(r)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
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
                    <span className={`shrink-0 tabular-nums ${isHighContrast ? "text-white/70" : "text-zinc-400"}`}>{sleepHours}</span>
                    <span className="shrink-0 tabular-nums text-white">
                      {readiness != null ? readiness.toFixed(1) : "—"}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                    >
                      {badge.label}
                    </span>
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
          className="fixed inset-0 z-50 flex flex-col overflow-x-hidden"
          style={{ backgroundColor: "var(--page-bg)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-wellness-detail-title"
        >
          <div
            className={`sticky top-0 z-20 flex shrink-0 flex-col border-b px-4 py-3 ${isHighContrast ? "border-white/20" : "border-zinc-700"}`}
            style={{ backgroundColor: "var(--page-bg)" }}
          >
            <div className="flex items-center justify-between">
              <h2 id="mobile-wellness-detail-title" className="text-lg font-bold text-white">
                {displayNameByUserId[detailRow.user_id] ?? emailByUserId[detailRow.user_id] ?? detailRow.user_id}
              </h2>
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                className={`rounded-lg p-2 hover:text-white ${isHighContrast ? "text-white/70 hover:bg-white/10" : "text-zinc-400 hover:bg-zinc-700"}`}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {(() => {
              const readiness = wellnessAverageFromRow(detailRow);
              const statusBadge = getStatusBadge(readiness ?? null);
              return (
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`rounded-lg px-2.5 py-1 text-xs font-medium text-white ${isHighContrast ? "bg-white/15" : "bg-zinc-700/80"}`}>
                    Readiness {readiness != null ? readiness.toFixed(1) : "—"}
                  </span>
                  <span className={`rounded-lg px-2.5 py-1 text-xs font-medium text-white ${isHighContrast ? "bg-white/15" : "bg-zinc-700/80"}`}>
                    Sleep {detailRow.sleep_duration != null ? `${detailRow.sleep_duration}h` : "—"}
                  </span>
                  <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${statusBadge.className}`}>
                    {statusBadge.label}
                  </span>
                </div>
              );
            })()}
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+96px)]">
            {getTopIssues(detailRow).length > 0 && (
              <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                <p className="text-xs font-medium text-amber-400/90">Top issues</p>
                <ul className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-sm text-amber-200/90">
                  {getTopIssues(detailRow).map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
            <dl className={`space-y-3 text-sm ${isHighContrast ? "text-white/90" : ""}`}>
              <div className="flex justify-between gap-2">
                <dt className={isHighContrast ? "text-white/70" : "text-zinc-500"}>Illness</dt>
                <dd>
                  {detailRow.illness === true ? (
                    <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">Yes</span>
                  ) : (
                    <span className={isHighContrast ? "text-white/80" : "text-zinc-400"}>No</span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className={isHighContrast ? "text-white/70" : "text-zinc-500"}>Bed → Wake</dt>
                <dd className="tabular-nums text-white">
                  {timeToHHmm(detailRow.bed_time) != null && timeToHHmm(detailRow.wake_time) != null
                    ? `${timeToHHmm(detailRow.bed_time)} → ${timeToHHmm(detailRow.wake_time)}`
                    : timeToHHmm(detailRow.bed_time) ?? timeToHHmm(detailRow.wake_time) ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2 items-center">
                <dt className={isHighContrast ? "text-white/70" : "text-zinc-500"}>Sleep quality</dt>
                <dd>
                  <BadgeScore value={detailRow.sleep_quality} type="goodHigh" />
                </dd>
              </div>
              <div className="flex justify-between gap-2 items-center">
                <dt className={isHighContrast ? "text-white/70" : "text-zinc-500"}>Fatigue</dt>
                <dd>
                  <BadgeScore value={detailRow.fatigue} type="goodHigh" />
                </dd>
              </div>
              <div className="flex justify-between gap-2 items-center">
                <dt className={isHighContrast ? "text-white/70" : "text-zinc-500"}>Soreness</dt>
                <dd>
                  <BadgeScore value={detailRow.soreness != null ? 10 - detailRow.soreness : null} type="goodHigh" />
                </dd>
              </div>
              <div className="flex justify-between gap-2 items-center">
                <dt className={isHighContrast ? "text-white/70" : "text-zinc-500"}>Stress</dt>
                <dd>
                  <BadgeScore value={detailRow.stress} type="goodHigh" />
                </dd>
              </div>
              <div className="flex justify-between gap-2 items-center">
                <dt className={isHighContrast ? "text-white/70" : "text-zinc-500"}>Mood</dt>
                <dd>
                  <BadgeScore value={detailRow.mood} type="goodHigh" />
                </dd>
              </div>
              <div className="flex justify-between gap-2 items-center">
                <dt className={isHighContrast ? "text-white/70" : "text-zinc-500"}>Readiness</dt>
                <dd>
                  <BadgeScore value={wellnessAverageFromRow(detailRow)} type="goodHigh" />
                </dd>
              </div>
            </dl>

            {/* Body map – only inside player details panel on mobile; one view at a time */}
            {detailRow.body_parts && Object.keys(detailRow.body_parts).length > 0 && (
              <div
                className={`mt-6 rounded-xl border px-4 py-4 ${themeId === "neon" ? "neon-card-text border-white/20" : themeId === "matt" ? "matt-card-text border-white/20" : "border-zinc-700 bg-zinc-800/50"}`}
                style={
                  themeId === "neon"
                    ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
                    : themeId === "matt"
                      ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS }
                      : { backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS }
                }
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className={`text-xs font-medium ${isHighContrast ? "text-white/80" : "text-zinc-500"}`}>Body map</span>
                  <button
                    type="button"
                    onClick={() => setBodyMapMode("soreness")}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      bodyMapMode === "soreness"
                        ? "bg-amber-600 text-white"
                        : isHighContrast
                          ? "bg-white/10 text-white/80 hover:bg-white/20"
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
                        : isHighContrast
                          ? "bg-white/10 text-white/80 hover:bg-white/20"
                          : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
                    }`}
                  >
                    Pain
                  </button>
                </div>
                <div className="mb-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBodyMapView("front")}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      bodyMapView === "front"
                        ? "bg-emerald-600 text-white"
                        : isHighContrast
                          ? "bg-white/10 text-white/80 hover:bg-white/20"
                          : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
                    }`}
                  >
                    Front
                  </button>
                  <button
                    type="button"
                    onClick={() => setBodyMapView("back")}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      bodyMapView === "back"
                        ? "bg-emerald-600 text-white"
                        : isHighContrast
                          ? "bg-white/10 text-white/80 hover:bg-white/20"
                          : "bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
                    }`}
                  >
                    Back
                  </button>
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
                <ul className={`mt-3 space-y-1 text-sm ${isHighContrast ? "text-white/80" : "text-zinc-300"}`}>
                  {Object.entries(detailRow.body_parts).map(([partId, v]) => {
                    const s = v.s ?? 0;
                    const p = v.p ?? 0;
                    const label = getBodyPartLabel(partId);
                    const parts: string[] = [];
                    if (s > 0) parts.push(`soreness ${s}`);
                    if (p > 0) parts.push(`pain ${p}`);
                    if (parts.length === 0) return null;
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
        </div>
      )}
    </div>
  );
}
