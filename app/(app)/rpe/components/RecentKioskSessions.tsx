"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ClipboardList } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import {
  DEFAULT_RECENT_KIOSK_BATCH_LIMIT,
  type RecentKioskSessionSummary,
} from "@/lib/kioskRpe/recentKioskSessions";
import {
  formatKioskAverageRpe,
  formatKioskDetailRpe,
  formatKioskDurationMinutes,
  formatKioskLoadAu,
  formatKioskMatchdayTag,
  formatKioskSessionDate,
  formatKioskSessionType,
  formatKioskSubmittedTime,
} from "@/lib/rpe/kioskSessionDisplay";

const CARD_RADIUS = "12px";

type RecentKioskSessionsProps = {
  sessions: RecentKioskSessionSummary[];
  loadError?: boolean;
};

export function RecentKioskSessions({ sessions, loadError = false }: RecentKioskSessionsProps) {
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";
  const [openBatchIds, setOpenBatchIds] = useState<Set<string>>(() => new Set());

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
      <div className="flex flex-col gap-1 border-b border-zinc-800 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider ${isHighContrast ? "text-white/90" : "text-zinc-200"}`}>
            <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
            Kiosk Sessions
          </h2>
          <p className={`mt-1 text-sm ${isHighContrast ? "text-white/65" : "text-zinc-500"}`}>
            Review batches submitted through Kiosk RPE.
          </p>
        </div>
        <p className={`text-xs ${isHighContrast ? "text-white/55" : "text-zinc-500"}`}>
          Showing the latest {DEFAULT_RECENT_KIOSK_BATCH_LIMIT} submitted batches.
        </p>
      </div>

      <div
        className={`overflow-hidden rounded-xl border ${
          isHighContrast ? "border-white/15 bg-white/[0.04]" : "border-zinc-800/90 bg-zinc-900/45"
        }`}
        style={{ borderRadius: CARD_RADIUS }}
      >
        {loadError ? (
          <div className={`px-4 py-5 text-sm ${isHighContrast ? "text-white/70" : "text-zinc-400"}`} role="status">
            Recent Kiosk Sessions are temporarily unavailable.
          </div>
        ) : sessions.length === 0 ? (
          <div className={`px-4 py-5 text-sm ${isHighContrast ? "text-white/70" : "text-zinc-400"}`}>
            <p>No Kiosk sessions have been submitted yet.</p>
            <p className={`mt-1 text-xs ${isHighContrast ? "text-white/50" : "text-zinc-500"}`}>
              New Kiosk submissions will appear here.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[880px] text-left text-xs">
                <thead className={isHighContrast ? "bg-white/8" : "bg-zinc-800/80"}>
                  <tr className={`border-b ${isHighContrast ? "border-white/20 text-white/80" : "border-zinc-800 text-zinc-400"}`}>
                    <th className="px-3 py-2.5 font-medium">Date</th>
                    <th className="px-3 py-2.5 font-medium">Time</th>
                    <th className="px-3 py-2.5 font-medium">Session Type</th>
                    <th className="px-3 py-2.5 font-medium">Matchday</th>
                    <th className="px-3 py-2.5 font-medium">Players</th>
                    <th className="px-3 py-2.5 font-medium">Avg RPE</th>
                    <th className="px-3 py-2.5 font-medium">Total Load</th>
                    <th className="px-3 py-2.5 text-right font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className={isHighContrast ? "text-white/90" : "text-zinc-300"}>
                  {sessions.map((session) => {
                    const isOpen = openBatchIds.has(session.batchId);
                    return (
                      <Fragment key={session.batchId}>
                        <tr
                          className={`border-b ${isHighContrast ? "border-white/10" : "border-zinc-800/80"} ${
                            isOpen ? (isHighContrast ? "bg-white/[0.03]" : "bg-zinc-900/55") : ""
                          }`}
                        >
                          <td className="whitespace-nowrap px-3 py-3 font-medium">{formatKioskSessionDate(session.date)}</td>
                          <td className="px-3 py-3 tabular-nums">{formatKioskSubmittedTime(session.submittedAt)}</td>
                          <td className="px-3 py-3">
                            <MetadataBadge value={session.sessionTypeLabel} kind="type" />
                          </td>
                          <td className="px-3 py-3">
                            <MetadataBadge value={session.matchdayTagLabel} kind="matchday" />
                          </td>
                          <td className="px-3 py-3 tabular-nums">{session.playerCount}</td>
                          <td className="px-3 py-3 tabular-nums">{formatKioskAverageRpe(session.averageRpe)}</td>
                          <td className="px-3 py-3 font-medium tabular-nums text-emerald-400">{formatKioskLoadAu(session.totalLoad)}</td>
                          <td className="px-3 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => toggleBatch(session.batchId)}
                              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-zinc-700/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
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
                          <tr className={isHighContrast ? "bg-white/[0.03]" : "bg-zinc-950/25"}>
                            <td colSpan={8} className="px-3 pb-3 pt-0">
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
                        <p className="font-semibold text-white">{formatKioskSessionDate(session.date)}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {formatKioskSubmittedTime(session.submittedAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleBatch(session.batchId)}
                        className="inline-flex min-h-[40px] shrink-0 items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-xs font-medium text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                        aria-expanded={isOpen}
                      >
                        {isOpen ? "Hide" : "Details"}
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition ${isOpen ? "rotate-180" : ""}`}
                          aria-hidden
                        />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <MetadataBadge value={session.sessionTypeLabel} kind="type" />
                      <MetadataBadge value={session.matchdayTagLabel} kind="matchday" />
                    </div>

                    <dl className="grid grid-cols-3 gap-2 text-xs">
                      <SummaryItem label="Players" value={String(session.playerCount)} />
                      <SummaryItem label="Avg RPE" value={formatKioskAverageRpe(session.averageRpe)} />
                      <SummaryItem label="Total Load" value={formatKioskLoadAu(session.totalLoad)} />
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

function MetadataBadge({ value, kind }: { value: string; kind: "type" | "matchday" }) {
  const tone =
    value === "Multiple"
      ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
      : value === "—" || value === "No tag"
        ? "border-zinc-700 bg-zinc-800/70 text-zinc-400"
        : kind === "type"
          ? "border-cyan-500/25 bg-cyan-500/10 text-cyan-300"
          : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";

  return (
    <span className={`inline-flex max-w-[12rem] items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      <span className="truncate">{value}</span>
    </span>
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
              <td className="px-3 py-2 tabular-nums">{formatKioskDetailRpe(detail.rpe)}</td>
              <td className="px-3 py-2 tabular-nums">{formatKioskDurationMinutes(detail.duration)}</td>
              <td className="px-3 py-2 font-medium tabular-nums text-emerald-400">{formatKioskLoadAu(detail.load)}</td>
              <td className="px-3 py-2">{formatKioskSessionType(detail.sessionType)}</td>
              <td className="px-3 py-2">{formatKioskMatchdayTag(detail.matchdayTag)}</td>
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
            <SummaryItem label="RPE" value={formatKioskDetailRpe(detail.rpe)} />
            <SummaryItem label="Duration" value={formatKioskDurationMinutes(detail.duration)} />
            <SummaryItem label="Load" value={formatKioskLoadAu(detail.load)} />
            <SummaryItem label="Type" value={formatKioskSessionType(detail.sessionType)} />
            <SummaryItem label="Matchday" value={formatKioskMatchdayTag(detail.matchdayTag)} wide />
          </dl>
        </div>
      ))}
    </div>
  );
}
