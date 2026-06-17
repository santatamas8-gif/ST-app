"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ClipboardList } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { NEON_CARD_STYLE, MATT_CARD_STYLE } from "@/lib/themes";
import { TEAM_SESSION_TIME_ZONE } from "@/lib/kioskRpe/localDate";
import type { RecentKioskSessionSummary } from "@/lib/kioskRpe/recentKioskSessions";

const CARD_RADIUS = "12px";

type RecentKioskSessionsProps = {
  sessions: RecentKioskSessionSummary[];
  loadError?: boolean;
};

function formatSessionDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return "—";
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatSubmittedTime(submittedAt: string | null): string {
  if (!submittedAt) return "—";
  const date = new Date(submittedAt);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: TEAM_SESSION_TIME_ZONE,
  }).format(date);
}

function formatLoad(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
  }).format(value)} AU`;
}

function formatRpe(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(1).replace(/\.0$/, "");
}

function formatDuration(value: number): string {
  return `${value} min`;
}

function formatSessionType(value: string | null): string {
  const trimmed = value?.trim() ?? "";
  return trimmed || "—";
}

function formatMatchdayTag(value: string | null): string {
  const trimmed = value?.trim() ?? "";
  return trimmed || "No tag";
}

export function RecentKioskSessions({ sessions, loadError = false }: RecentKioskSessionsProps) {
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";
  const [openBatchIds, setOpenBatchIds] = useState<Set<string>>(() => new Set());

  const cardStyle =
    themeId === "neon"
      ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
      : themeId === "matt"
        ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS }
        : { backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS };

  const toggleBatch = (batchId: string) => {
    setOpenBatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  };

  return (
    <section id="recent-kiosk-sessions" className="space-y-3 scroll-mt-24">
      <div className="flex flex-col gap-1 border-b border-zinc-700 pb-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider ${isHighContrast ? "text-white/90" : "text-zinc-200"}`}>
            <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
            Recent Kiosk Sessions
          </h2>
          <p className={`mt-1 text-xs ${isHighContrast ? "text-white/70" : "text-zinc-500"}`}>
            Latest RPE batches submitted through Kiosk RPE.
          </p>
        </div>
      </div>

      <div
        className={`overflow-hidden rounded-xl border ${themeId === "neon" ? "neon-card-text border-white/20" : themeId === "matt" ? "matt-card-text border-white/10" : "border-zinc-800/90"}`}
        style={cardStyle}
      >
        {loadError ? (
          <div className="px-4 py-5 text-sm text-zinc-400">
            Recent Kiosk Sessions are temporarily unavailable.
          </div>
        ) : sessions.length === 0 ? (
          <div className="px-4 py-5 text-sm text-zinc-400">
            No Kiosk sessions have been submitted yet.
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[880px] text-left text-xs">
                <thead className={isHighContrast ? "bg-white/8" : "bg-zinc-800/80"}>
                  <tr className={`border-b ${isHighContrast ? "border-white/20 text-white/80" : "border-zinc-700 text-zinc-400"}`}>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Session Type</th>
                    <th className="px-3 py-2 font-medium">Matchday</th>
                    <th className="px-3 py-2 font-medium">Players</th>
                    <th className="px-3 py-2 font-medium">Avg RPE</th>
                    <th className="px-3 py-2 font-medium">Total Load</th>
                    <th className="px-3 py-2 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className={isHighContrast ? "text-white/90" : "text-zinc-300"}>
                  {sessions.map((session) => {
                    const isOpen = openBatchIds.has(session.batchId);
                    return (
                      <Fragment key={session.batchId}>
                        <tr
                          className={`border-b ${isHighContrast ? "border-white/10" : "border-zinc-800/80"}`}
                        >
                          <td className="px-3 py-3 whitespace-nowrap">{formatSessionDate(session.date)}</td>
                          <td className="px-3 py-3 tabular-nums">{formatSubmittedTime(session.submittedAt)}</td>
                          <td className="px-3 py-3">{session.sessionTypeLabel}</td>
                          <td className="px-3 py-3">{session.matchdayTagLabel}</td>
                          <td className="px-3 py-3 tabular-nums">{session.playerCount}</td>
                          <td className="px-3 py-3 tabular-nums">{session.averageRpe.toFixed(1)}</td>
                          <td className="px-3 py-3 tabular-nums">{formatLoad(session.totalLoad)}</td>
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              onClick={() => toggleBatch(session.batchId)}
                              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-zinc-700/80"
                              aria-expanded={isOpen}
                            >
                              {isOpen ? "Hide details" : "View details"}
                              <ChevronDown
                                className={`h-3.5 w-3.5 transition ${isOpen ? "rotate-180" : ""}`}
                                aria-hidden
                              />
                            </button>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className={isHighContrast ? "bg-white/[0.03]" : "bg-zinc-900/40"}>
                            <td colSpan={8} className="px-3 py-3">
                              <DetailTable session={session} isHighContrast={isHighContrast} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-zinc-800 md:hidden">
              {sessions.map((session) => {
                const isOpen = openBatchIds.has(session.batchId);
                return (
                  <article key={session.batchId} className="space-y-3 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{formatSessionDate(session.date)}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {formatSubmittedTime(session.submittedAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleBatch(session.batchId)}
                        className="inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-xs font-medium text-emerald-400"
                        aria-expanded={isOpen}
                      >
                        {isOpen ? "Hide" : "Details"}
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition ${isOpen ? "rotate-180" : ""}`}
                          aria-hidden
                        />
                      </button>
                    </div>

                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      <SummaryItem label="Type" value={session.sessionTypeLabel} />
                      <SummaryItem label="Matchday" value={session.matchdayTagLabel} />
                      <SummaryItem label="Players" value={String(session.playerCount)} />
                      <SummaryItem label="Avg RPE" value={session.averageRpe.toFixed(1)} />
                      <SummaryItem label="Total Load" value={formatLoad(session.totalLoad)} wide />
                    </dl>

                    {isOpen && <DetailCards session={session} />}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function SummaryItem({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-lg bg-zinc-900/50 px-3 py-2 ${wide ? "col-span-2" : ""}`}>
      <dt className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-zinc-200">{value}</dd>
    </div>
  );
}

function DetailTable({
  session,
  isHighContrast,
}: {
  session: RecentKioskSessionSummary;
  isHighContrast: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full min-w-[700px] text-left text-xs">
        <thead className={isHighContrast ? "bg-white/8" : "bg-zinc-800/80"}>
          <tr className={isHighContrast ? "text-white/70" : "text-zinc-400"}>
            <th className="px-3 py-2 font-medium">Player</th>
            <th className="px-3 py-2 font-medium">RPE</th>
            <th className="px-3 py-2 font-medium">Duration</th>
            <th className="px-3 py-2 font-medium">Load</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Matchday</th>
          </tr>
        </thead>
        <tbody>
          {session.details.map((detail) => (
            <tr key={detail.sessionId} className="border-t border-zinc-800">
              <td className="px-3 py-2 font-medium text-zinc-200">{detail.playerName}</td>
              <td className="px-3 py-2 tabular-nums">{formatRpe(detail.rpe)}</td>
              <td className="px-3 py-2 tabular-nums">{formatDuration(detail.duration)}</td>
              <td className="px-3 py-2 tabular-nums">{formatLoad(detail.load)}</td>
              <td className="px-3 py-2">{formatSessionType(detail.sessionType)}</td>
              <td className="px-3 py-2">{formatMatchdayTag(detail.matchdayTag)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailCards({ session }: { session: RecentKioskSessionSummary }) {
  return (
    <div className="space-y-2">
      {session.details.map((detail) => (
        <div key={detail.sessionId} className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
          <p className="font-medium text-zinc-100">{detail.playerName}</p>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-400">
            <SummaryItem label="RPE" value={formatRpe(detail.rpe)} />
            <SummaryItem label="Duration" value={formatDuration(detail.duration)} />
            <SummaryItem label="Load" value={formatLoad(detail.load)} />
            <SummaryItem label="Type" value={formatSessionType(detail.sessionType)} />
            <SummaryItem label="Matchday" value={formatMatchdayTag(detail.matchdayTag)} wide />
          </dl>
        </div>
      ))}
    </div>
  );
}
