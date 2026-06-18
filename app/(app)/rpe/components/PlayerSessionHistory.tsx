"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { History, RefreshCw } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { MATCHDAY_TAGS, SESSION_TYPES } from "@/lib/kioskRpe/constants";
import {
  PLAYER_SESSION_HISTORY_ALL_MATCHDAYS,
  PLAYER_SESSION_HISTORY_ALL_SESSION_TYPES,
  PLAYER_SESSION_HISTORY_LIMITS,
  PLAYER_SESSION_HISTORY_NO_TAG,
  type PlayerSessionHistoryDay,
  type PlayerSessionHistoryLimit,
  type PlayerSessionHistorySummary,
} from "@/lib/rpe/playerSessionHistory";
import { formatMonthDay } from "@/lib/formatDate";
import { formatMatchdayTagDisplay, formatSessionTypeDisplay } from "@/lib/sessionDisplay";
import { PlayerSessionHistoryChart } from "./PlayerSessionHistoryChart";

type PlayerSessionHistoryResponse = {
  daysNewestFirst?: PlayerSessionHistoryDay[];
  daysChronological?: PlayerSessionHistoryDay[];
  summary?: PlayerSessionHistorySummary;
  error?: string;
};

type PlayerSessionHistoryProps = {
  players: Array<{ id: string; name: string }>;
};

const EMPTY_SUMMARY: PlayerSessionHistorySummary = {
  daysShown: 0,
  latestLoad: null,
  latestDate: null,
  averageDailyLoad: null,
  highestDailyLoad: null,
  lowestDailyLoad: null,
};

function formatLoad(value: number | null): string {
  if (value == null) return "—";
  return `${Math.round(value).toLocaleString("en-GB")} AU`;
}

function formatRpe(value: number | null): string {
  return value == null ? "—" : value.toFixed(1);
}

function KpiCard({
  label,
  value,
  sublabel,
  isHighContrast,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  isHighContrast: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        isHighContrast ? "border-white/15 bg-white/[0.04]" : "border-zinc-800/90 bg-zinc-900/45"
      }`}
    >
      <p className={`text-[11px] font-semibold uppercase tracking-wide ${isHighContrast ? "text-white/65" : "text-zinc-500"}`}>
        {label}
      </p>
      <p className="mt-2 text-xl font-bold tabular-nums text-teal-300">{value}</p>
      {sublabel && (
        <p className={`mt-1 text-xs ${isHighContrast ? "text-white/55" : "text-zinc-500"}`}>
          {sublabel}
        </p>
      )}
    </div>
  );
}

export function PlayerSessionHistory({ players }: PlayerSessionHistoryProps) {
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";
  const [playerId, setPlayerId] = useState("");
  const [matchday, setMatchday] = useState(PLAYER_SESSION_HISTORY_ALL_MATCHDAYS);
  const [sessionType, setSessionType] = useState(PLAYER_SESSION_HISTORY_ALL_SESSION_TYPES);
  const [limit, setLimit] = useState<PlayerSessionHistoryLimit>(10);
  const [daysNewestFirst, setDaysNewestFirst] = useState<PlayerSessionHistoryDay[]>([]);
  const [daysChronological, setDaysChronological] = useState<PlayerSessionHistoryDay[]>([]);
  const [summary, setSummary] = useState<PlayerSessionHistorySummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  useEffect(() => {
    if (!playerId) return;

    const controller = new AbortController();
    // Fetch loading state is synchronized with the active filter request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      playerId,
      limit: String(limit),
      matchday,
      sessionType,
    });

    fetch(`/api/rpe/player-session-history?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const json = (await response.json().catch(() => ({}))) as PlayerSessionHistoryResponse;
        if (!response.ok) {
          throw new Error(json.error ?? "Unable to load session history.");
        }
        setDaysNewestFirst(json.daysNewestFirst ?? []);
        setDaysChronological(json.daysChronological ?? []);
        setSummary(json.summary ?? EMPTY_SUMMARY);
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setDaysNewestFirst([]);
        setDaysChronological([]);
        setSummary(EMPTY_SUMMARY);
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load session history.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [limit, matchday, playerId, sessionType]);

  const selectedPlayerName = useMemo(
    () => players.find((player) => player.id === playerId)?.name ?? null,
    [playerId, players]
  );

  const inputClass =
    "h-10 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
  const matchdayOptions = [
    PLAYER_SESSION_HISTORY_ALL_MATCHDAYS,
    PLAYER_SESSION_HISTORY_NO_TAG,
    ...MATCHDAY_TAGS.filter((tag) => tag !== PLAYER_SESSION_HISTORY_NO_TAG),
  ];
  const sessionTypeOptions = [PLAYER_SESSION_HISTORY_ALL_SESSION_TYPES, ...SESSION_TYPES];
  const visibleDaysNewestFirst = playerId ? daysNewestFirst : [];
  const visibleDaysChronological = playerId ? daysChronological : [];
  const visibleSummary = playerId ? summary : EMPTY_SUMMARY;
  const visibleHasData = visibleDaysNewestFirst.length > 0;
  const filterSummary = [
    selectedPlayerName,
    matchday,
    sessionType,
    `Last ${limit}`,
  ].filter(Boolean).join(" · ");

  return (
    <section className="space-y-4">
      <h2
        className={`flex items-center gap-2 border-b pb-2 text-sm font-bold uppercase tracking-wider ${
          isHighContrast ? "border-white/20 text-white/90" : "border-zinc-700 text-zinc-200"
        }`}
      >
        <History className="h-4 w-4 shrink-0" aria-hidden />
        Session History
      </h2>
      <div className="space-y-1">
        <p className={`text-xs font-semibold uppercase tracking-wide ${isHighContrast ? "text-white/75" : "text-zinc-400"}`}>
          SESSION HISTORY
        </p>
        <p className={`text-sm ${isHighContrast ? "text-white/65" : "text-zinc-500"}`}>
          Review a player&apos;s latest daily load values.
        </p>
        <p className={`text-sm ${isHighContrast ? "text-white/65" : "text-zinc-500"}`}>
          Compare the player&apos;s latest training days or filter by Matchday and Session Type.
        </p>
      </div>

      <div className={`rounded-xl border p-4 ${isHighContrast ? "border-white/15 bg-white/[0.04]" : "border-zinc-800/90 bg-zinc-900/45"}`}>
        <div className="grid gap-3 md:grid-cols-[minmax(14rem,1.4fr)_minmax(9rem,0.8fr)_minmax(9rem,0.8fr)_auto] md:items-end">
          <label className={`flex min-w-0 flex-col gap-1 text-xs ${isHighContrast ? "text-white/80" : "text-zinc-500"}`}>
            Player
            <select
              value={playerId}
              onChange={(event) => {
                setPlayerId(event.target.value);
                setExpandedDate(null);
              }}
              className={`${inputClass} w-full`}
            >
              <option value="">Select player...</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>

          <label className={`flex min-w-0 flex-col gap-1 text-xs ${isHighContrast ? "text-white/80" : "text-zinc-500"}`}>
            Matchday
            <select
              value={matchday}
              onChange={(event) => {
                setMatchday(event.target.value);
                setExpandedDate(null);
              }}
              className={`${inputClass} w-full`}
            >
              {matchdayOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className={`flex min-w-0 flex-col gap-1 text-xs ${isHighContrast ? "text-white/80" : "text-zinc-500"}`}>
            Session Type
            <select
              value={sessionType}
              onChange={(event) => {
                setSessionType(event.target.value);
                setExpandedDate(null);
              }}
              className={`${inputClass} w-full`}
            >
              {sessionTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className={`mb-1 block text-xs ${isHighContrast ? "text-white/80" : "text-zinc-500"}`}>
              History length
            </span>
            <div
              className="inline-flex h-10 rounded-[14px] border p-0.5"
              style={{
                backgroundColor: isHighContrast ? "rgba(255,255,255,0.06)" : "rgba(15,23,32,0.9)",
                borderColor: isHighContrast ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.08)",
              }}
            >
              {PLAYER_SESSION_HISTORY_LIMITS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setLimit(option);
                    setExpandedDate(null);
                  }}
                  aria-pressed={limit === option}
                  className={`min-w-[68px] rounded-[10px] px-3 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    limit === option
                      ? "bg-emerald-700/90 text-white"
                      : "bg-transparent text-gray-400 hover:bg-white/5 hover:text-gray-300 active:bg-white/10"
                  }`}
                >
                  Last {option}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {!playerId && (
        <div className={`rounded-xl border p-6 text-center text-sm ${isHighContrast ? "border-white/15 bg-white/[0.04] text-white/70" : "border-zinc-800/90 bg-zinc-900/45 text-zinc-400"}`}>
          Select a player to review their session history.
        </div>
      )}

      {playerId && (
        <>
          {loading && (
            <div className={`flex items-center gap-2 rounded-xl border p-4 text-sm ${isHighContrast ? "border-white/15 bg-white/[0.04] text-white/70" : "border-zinc-800/90 bg-zinc-900/45 text-zinc-400"}`}>
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
              Loading session history...
            </div>
          )}

          {error && !loading && (
            <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-300" role="alert">
              {error}
            </div>
          )}

          {!loading && !error && !visibleHasData && (
            <div className={`rounded-xl border p-6 text-center ${isHighContrast ? "border-white/15 bg-white/[0.04]" : "border-zinc-800/90 bg-zinc-900/45"}`}>
              <p className="text-sm text-zinc-300">No matching sessions were found for this player.</p>
              <p className={`mt-1 text-xs ${isHighContrast ? "text-white/55" : "text-zinc-500"}`}>
                Try another Matchday, Session Type or history filter.
              </p>
            </div>
          )}

          {!loading && !error && visibleHasData && (
            <>
              <p className={`text-xs ${isHighContrast ? "text-white/55" : "text-zinc-500"}`}>
                {visibleSummary.daysShown < limit
                  ? `Showing ${visibleSummary.daysShown} available matching days.`
                  : `Showing ${visibleSummary.daysShown} matching days.`}{" "}
                {filterSummary}
              </p>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <KpiCard label="Days shown" value={visibleSummary.daysShown} isHighContrast={isHighContrast} />
                <KpiCard
                  label="Latest load"
                  value={formatLoad(visibleSummary.latestLoad)}
                  sublabel={visibleSummary.latestDate ? formatMonthDay(visibleSummary.latestDate) : undefined}
                  isHighContrast={isHighContrast}
                />
                <KpiCard label="Average daily load" value={formatLoad(visibleSummary.averageDailyLoad)} isHighContrast={isHighContrast} />
                <KpiCard label="Highest daily load" value={formatLoad(visibleSummary.highestDailyLoad)} isHighContrast={isHighContrast} />
                <KpiCard label="Lowest daily load" value={formatLoad(visibleSummary.lowestDailyLoad)} isHighContrast={isHighContrast} />
              </div>

              <section className={`rounded-xl border p-4 ${isHighContrast ? "border-white/15 bg-white/[0.04]" : "border-zinc-800/90 bg-zinc-900/45"}`}>
                <h3 className="text-base font-semibold text-white">Daily Load History</h3>
                <div className="mt-3">
                  <PlayerSessionHistoryChart days={visibleDaysChronological} isHighContrast={isHighContrast} />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className={`text-sm font-bold uppercase tracking-wider ${isHighContrast ? "text-white/90" : "text-zinc-200"}`}>
                  Session History Details
                </h3>
                <div className={`overflow-hidden rounded-xl border ${isHighContrast ? "border-white/15 bg-white/[0.04]" : "border-zinc-800/90 bg-zinc-900/45"}`}>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left text-xs">
                      <thead className={isHighContrast ? "bg-white/8" : "bg-zinc-800/80"}>
                        <tr className={`border-b ${isHighContrast ? "border-white/20 text-white/80" : "border-zinc-700 text-zinc-400"}`}>
                          <th className="px-3 py-2.5 font-medium">Date</th>
                          <th className="px-3 py-2.5 font-medium">Sessions</th>
                          <th className="px-3 py-2.5 font-medium">Avg RPE</th>
                          <th className="px-3 py-2.5 font-medium">Total duration</th>
                          <th className="px-3 py-2.5 font-medium">Total load</th>
                          <th className="px-3 py-2.5 font-medium">Session Type</th>
                          <th className="px-3 py-2.5 font-medium">Matchday</th>
                          <th className="px-3 py-2.5 font-medium">Details</th>
                        </tr>
                      </thead>
                      <tbody className={isHighContrast ? "text-white/90" : "text-zinc-300"}>
                        {visibleDaysNewestFirst.map((day) => {
                          const expanded = expandedDate === day.date;
                          return (
                            <Fragment key={day.date}>
                              <tr className={`border-b ${isHighContrast ? "border-white/10" : "border-zinc-800/80"}`}>
                                <td className="px-3 py-3 font-medium text-emerald-300">{formatMonthDay(day.date)}</td>
                                <td className="px-3 py-3 tabular-nums">{day.sessionCount}</td>
                                <td className="px-3 py-3 tabular-nums">{formatRpe(day.averageRpe)}</td>
                                <td className="px-3 py-3 tabular-nums">{day.totalDuration} min</td>
                                <td className="px-3 py-3 font-medium tabular-nums text-teal-300">{formatLoad(day.totalLoad)}</td>
                                <td className="px-3 py-3">{day.sessionTypeLabel}</td>
                                <td className="px-3 py-3">{day.matchdayTagLabel}</td>
                                <td className="px-3 py-3">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedDate(expanded ? null : day.date)}
                                    aria-expanded={expanded}
                                    className="min-h-[34px] rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-zinc-700/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                                  >
                                    {expanded ? "Hide" : "View"}
                                  </button>
                                </td>
                              </tr>
                              {expanded && (
                                <tr className={isHighContrast ? "bg-white/[0.03]" : "bg-zinc-950/30"}>
                                  <td colSpan={8} className="px-3 py-3">
                                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                      {day.sessions.map((session, index) => (
                                        <div key={`${day.date}-${index}`} className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
                                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                            Session {index + 1}
                                          </p>
                                          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                                            <dt className="text-zinc-500">Type</dt>
                                            <dd>{formatSessionTypeDisplay(session.sessionType)}</dd>
                                            <dt className="text-zinc-500">Matchday</dt>
                                            <dd>{formatMatchdayTagDisplay(session.matchdayTag)}</dd>
                                            <dt className="text-zinc-500">RPE</dt>
                                            <dd>{session.rpe ?? "—"}</dd>
                                            <dt className="text-zinc-500">Duration</dt>
                                            <dd>{session.duration ?? "—"} min</dd>
                                            <dt className="text-zinc-500">Load</dt>
                                            <dd>{formatLoad(session.load)}</dd>
                                          </dl>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </section>
  );
}
