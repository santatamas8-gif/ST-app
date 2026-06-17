"use client";

import { useMemo, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { NEON_CARD_STYLE, MATT_CARD_STYLE } from "@/lib/themes";
import { getLocalDateString } from "@/lib/kioskRpe/localDate";
import {
  SESSION_TYPE_FILTER_OPTIONS,
  type SessionTypeFilterOption,
  formatAverageDuration,
  formatAverageLoad,
  formatAverageRpe,
  formatTotalLoad,
} from "@/lib/kioskRpe/matchdayAnalytics";
import { MATCHDAY_FILTER_OPTIONS, type MatchdayFilterOption } from "@/lib/kioskRpe/playerComparisonAnalytics";
import {
  BASELINE_PERIOD_OPTIONS,
  buildPlayerSelfBaselineResult,
  calculateSelfBaselineDateRanges,
  interpretationLabel,
  RECENT_PERIOD_OPTIONS,
  type BaselinePeriodDays,
  type MetricDeviation,
  type RecentPeriodDays,
  type SelfBaselineChartMetric,
} from "@/lib/kioskRpe/playerSelfBaselineAnalytics";
import { PlayerSelfBaselineChart } from "./PlayerSelfBaselineChart";
import {
  EMPTY_ANALYTICS_DISPLAY_NAMES,
  EMPTY_ANALYTICS_PLAYERS,
  EMPTY_ANALYTICS_SESSIONS,
} from "@/lib/kioskRpe/analyticsData";
import { useRpeAnalyticsData } from "./RpeAnalyticsDataProvider";
import { RefreshCw, TrendingUp } from "lucide-react";

const CARD_RADIUS = "12px";

function playerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return "?";
}

function formatSignedNumber(value: number, decimals = 0): string {
  const rounded =
    decimals === 0 ? Math.round(value).toString() : value.toFixed(decimals);
  if (value > 0) return `+${rounded}`;
  return rounded;
}

function formatPercentageDiff(value: number | null): string {
  if (value == null) return "—";
  return `${formatSignedNumber(value, 1)}%`;
}

function formatAbsoluteDiff(
  value: number | null,
  kind: "rpe" | "duration" | "load"
): string {
  if (value == null) return "—";
  switch (kind) {
    case "rpe":
      return formatSignedNumber(value, 1);
    case "duration":
      return `${formatSignedNumber(value, 0)} min`;
    case "load":
      return `${formatSignedNumber(value, 0)} AU`;
  }
}

function interpretationClass(
  interpretation: MetricDeviation["interpretation"],
  isHighContrast: boolean
): string {
  switch (interpretation) {
    case "higher":
      return "text-amber-400";
    case "lower":
      return "text-sky-400";
    case "similar":
      return isHighContrast ? "text-emerald-300" : "text-emerald-400";
    case "insufficient":
      return isHighContrast ? "text-white/60" : "text-zinc-500";
  }
}

export function PlayerSelfBaseline() {
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";
  const cardStyle =
    themeId === "neon"
      ? NEON_CARD_STYLE
      : themeId === "matt"
        ? MATT_CARD_STYLE
        : { backgroundColor: "var(--card-bg)" };

  const [recentDays, setRecentDays] = useState<RecentPeriodDays>(7);
  const [baselineDays, setBaselineDays] = useState<BaselinePeriodDays>(28);
  const [playerId, setPlayerId] = useState("");
  const [matchdayTag, setMatchdayTag] = useState<MatchdayFilterOption>("All matchday tags");
  const [sessionType, setSessionType] = useState<SessionTypeFilterOption>("All session types");
  const [chartMetric, setChartMetric] = useState<SelfBaselineChartMetric>("averageLoad");

  const ranges = useMemo(
    () => calculateSelfBaselineDateRanges(getLocalDateString(), recentDays, baselineDays),
    [recentDays, baselineDays]
  );

  const { data, loading, error: fetchError } = useRpeAnalyticsData(
    ranges.combinedFrom,
    ranges.combinedTo
  );
  const sessions = data?.sessions ?? EMPTY_ANALYTICS_SESSIONS;
  const players = data?.players ?? EMPTY_ANALYTICS_PLAYERS;
  const nameByPlayerId = data?.displayNameByUserId ?? EMPTY_ANALYTICS_DISPLAY_NAMES;

  const result = useMemo(() => {
    if (!playerId) return null;
    return buildPlayerSelfBaselineResult(sessions, {
      playerId,
      ranges,
      matchdayTag,
      sessionType,
    });
  }, [sessions, playerId, ranges, matchdayTag, sessionType]);

  const selectedPlayerName = playerId
    ? nameByPlayerId[playerId] ?? players.find((p) => p.id === playerId)?.name ?? "Player"
    : null;

  const inputClass =
    "h-9 rounded border border-zinc-700 bg-zinc-800/80 px-2 py-1 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  const metricCards = result
    ? [
        {
          title: "Average RPE",
          recent: formatAverageRpe(result.recent.averageRpe),
          baseline: formatAverageRpe(result.baseline.averageRpe),
          absolute: formatAbsoluteDiff(result.deviations.averageRpe.absoluteDifference, "rpe"),
          percentage: formatPercentageDiff(result.deviations.averageRpe.percentageDifference),
          interpretation: result.deviations.averageRpe.interpretation,
        },
        {
          title: "Average Duration",
          recent: result.recent.averageDuration != null ? `${formatAverageDuration(result.recent.averageDuration)} min` : "—",
          baseline: result.baseline.averageDuration != null ? `${formatAverageDuration(result.baseline.averageDuration)} min` : "—",
          absolute: formatAbsoluteDiff(result.deviations.averageDuration.absoluteDifference, "duration"),
          percentage: formatPercentageDiff(result.deviations.averageDuration.percentageDifference),
          interpretation: result.deviations.averageDuration.interpretation,
        },
        {
          title: "Average Load",
          recent: result.recent.averageLoad != null ? `${formatAverageLoad(result.recent.averageLoad)} AU` : "—",
          baseline: result.baseline.averageLoad != null ? `${formatAverageLoad(result.baseline.averageLoad)} AU` : "—",
          absolute: formatAbsoluteDiff(result.deviations.averageLoad.absoluteDifference, "load"),
          percentage: formatPercentageDiff(result.deviations.averageLoad.percentageDifference),
          interpretation: result.deviations.averageLoad.interpretation,
        },
        {
          title: "Total Load",
          recent: result.recent.sessionCount > 0 ? `${formatTotalLoad(result.recent.totalLoad)} AU` : "—",
          baseline: result.baseline.sessionCount > 0 ? `${formatTotalLoad(result.baseline.totalLoad)} AU` : "—",
          absolute: null,
          percentage: null,
          interpretation: null as MetricDeviation["interpretation"] | null,
          recentSessions: result.recent.sessionCount,
          baselineSessions: result.baseline.sessionCount,
        },
      ]
    : [];

  return (
    <section className="space-y-4">
      <h2
        className={`flex items-center gap-2 border-b pb-2 text-sm font-bold uppercase tracking-wider ${
          isHighContrast ? "border-white/20 text-white/90" : "border-zinc-700 text-zinc-200"
        }`}
      >
        <TrendingUp className="h-4 w-4 shrink-0" aria-hidden />
        Player Self-Baseline
      </h2>

      <div
        className={`rounded-xl p-4 space-y-4 ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
        style={{ borderRadius: CARD_RADIUS, ...cardStyle }}
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className={`flex flex-col gap-1 text-xs ${isHighContrast ? "text-white/80" : "text-zinc-500"}`}>
            Player
            <select
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              className={`${inputClass} min-w-[10rem]`}
            >
              <option value="">Select player…</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className={`flex flex-col gap-1 text-xs ${isHighContrast ? "text-white/80" : "text-zinc-500"}`}>
            Recent period
            <select
              value={recentDays}
              onChange={(e) => setRecentDays(Number(e.target.value) as RecentPeriodDays)}
              className={`${inputClass} min-w-[5.5rem]`}
            >
              {RECENT_PERIOD_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  {days} days
                </option>
              ))}
            </select>
          </label>

          <label className={`flex flex-col gap-1 text-xs ${isHighContrast ? "text-white/80" : "text-zinc-500"}`}>
            Baseline period
            <select
              value={baselineDays}
              onChange={(e) => setBaselineDays(Number(e.target.value) as BaselinePeriodDays)}
              className={`${inputClass} min-w-[5.5rem]`}
            >
              {BASELINE_PERIOD_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  {days} days
                </option>
              ))}
            </select>
          </label>

          <label className={`flex flex-col gap-1 text-xs ${isHighContrast ? "text-white/80" : "text-zinc-500"}`}>
            Matchday
            <select
              value={matchdayTag}
              onChange={(e) => setMatchdayTag(e.target.value as MatchdayFilterOption)}
              className={`${inputClass} min-w-[9rem]`}
            >
              {MATCHDAY_FILTER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className={`flex flex-col gap-1 text-xs ${isHighContrast ? "text-white/80" : "text-zinc-500"}`}>
            Session type
            <select
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value as SessionTypeFilterOption)}
              className={`${inputClass} min-w-[9rem]`}
            >
              {SESSION_TYPE_FILTER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className={`text-xs ${isHighContrast ? "text-white/60" : "text-zinc-500"}`}>
          Recent: {ranges.recentStart} – {ranges.recentEnd} · Baseline: {ranges.baselineStart} –{" "}
          {ranges.baselineEnd}
        </p>

        {fetchError && (
          <p className="text-sm text-red-400" role="alert">
            {fetchError}
          </p>
        )}

        {!playerId && !loading && (
          <p className={`text-sm ${isHighContrast ? "text-white/70" : "text-zinc-400"}`}>
            Select a player to compare recent values with their own baseline.
          </p>
        )}

        {playerId && selectedPlayerName && (
          <div className="flex items-center gap-2">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                isHighContrast ? "bg-white/10 text-white" : "bg-zinc-700 text-zinc-200"
              }`}
            >
              {playerInitials(selectedPlayerName)}
            </span>
            <span className={`text-sm font-medium ${isHighContrast ? "text-white/90" : "text-zinc-200"}`}>
              {selectedPlayerName}
            </span>
          </div>
        )}

        {playerId && (
          <p className={`text-xs leading-relaxed ${isHighContrast ? "text-white/70" : "text-zinc-500"}`}>
            Differences describe changes in submitted RPE sessions and should be interpreted together
            with session count, training content, wellness, GPS and coaching context.
          </p>
        )}

        {loading && (
          <div className={`flex items-center gap-2 text-sm ${isHighContrast ? "text-white/70" : "text-zinc-400"}`}>
            <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
            Loading sessions…
          </div>
        )}

        {playerId && !loading && result && !result.hasAnySessions && (
          <p className={`text-sm ${isHighContrast ? "text-white/70" : "text-zinc-400"}`}>
            No matching RPE sessions found for the selected player and filters.
          </p>
        )}

        {playerId && !loading && result && result.hasAnySessions && (
          <>
            {result.limitedData && (
              <p className="text-sm text-amber-400" role="status">
                Limited data: one or both periods contain fewer than 3 sessions.
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metricCards.map((card) => (
                <div
                  key={card.title}
                  className={`rounded-lg border p-3 ${
                    isHighContrast ? "border-white/15 bg-white/5" : "border-zinc-700/80 bg-zinc-900/40"
                  }`}
                >
                  <p className={`text-[11px] font-semibold uppercase tracking-wide ${isHighContrast ? "text-white/70" : "text-zinc-500"}`}>
                    {card.title}
                  </p>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className={isHighContrast ? "text-white/60" : "text-zinc-500"}>Recent</span>
                      <span className="font-medium tabular-nums text-emerald-400">{card.recent}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className={isHighContrast ? "text-white/60" : "text-zinc-500"}>Baseline</span>
                      <span className="tabular-nums">{card.baseline}</span>
                    </div>
                    {card.title === "Total Load" ? (
                      <p className={`pt-1 text-[10px] ${isHighContrast ? "text-white/50" : "text-zinc-500"}`}>
                        {result.recent.sessionCount} recent · {result.baseline.sessionCount} baseline sessions
                      </p>
                    ) : (
                      <>
                        <div className="flex justify-between gap-2 border-t border-zinc-700/60 pt-1">
                          <span className={isHighContrast ? "text-white/60" : "text-zinc-500"}>Diff</span>
                          <span className="tabular-nums">{card.absolute}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className={isHighContrast ? "text-white/60" : "text-zinc-500"}>%</span>
                          <span className="tabular-nums">{card.percentage}</span>
                        </div>
                        {card.interpretation && (
                          <p className={`pt-1 text-[11px] font-medium ${interpretationClass(card.interpretation, isHighContrast)}`}>
                            {interpretationLabel(card.interpretation)}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-lg border border-zinc-700/80">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead
                  className={`border-b ${isHighContrast ? "border-white/20 bg-white/5 text-white/80" : "border-zinc-700 bg-zinc-800/80 text-zinc-400"}`}
                >
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Period</th>
                    <th className="px-3 py-2.5 font-medium">Dates</th>
                    <th className="px-3 py-2.5 font-medium">Sessions</th>
                    <th className="px-3 py-2.5 font-medium">Avg RPE</th>
                    <th className="px-3 py-2.5 font-medium">Avg Duration</th>
                    <th className="px-3 py-2.5 font-medium">Avg Load</th>
                    <th className="px-3 py-2.5 font-medium">Total Load</th>
                  </tr>
                </thead>
                <tbody className={isHighContrast ? "text-white/90" : "text-zinc-300"}>
                  <tr className={`border-b ${isHighContrast ? "border-white/10" : "border-zinc-800"}`}>
                    <td className="px-3 py-2.5 font-medium text-emerald-400">Recent</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {result.ranges.recentStart} – {result.ranges.recentEnd}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums font-medium text-emerald-400">
                      {result.recent.sessionCount}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{formatAverageRpe(result.recent.averageRpe)}</td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {formatAverageDuration(result.recent.averageDuration)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums font-medium text-emerald-400">
                      {formatAverageLoad(result.recent.averageLoad)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {result.recent.sessionCount > 0 ? formatTotalLoad(result.recent.totalLoad) : "—"}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2.5 font-medium text-sky-400">Baseline</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {result.ranges.baselineStart} – {result.ranges.baselineEnd}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{result.baseline.sessionCount}</td>
                    <td className="px-3 py-2.5 tabular-nums">{formatAverageRpe(result.baseline.averageRpe)}</td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {formatAverageDuration(result.baseline.averageDuration)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {formatAverageLoad(result.baseline.averageLoad)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {result.baseline.sessionCount > 0 ? formatTotalLoad(result.baseline.totalLoad) : "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3
                  className={`text-xs font-semibold uppercase tracking-wide ${isHighContrast ? "text-white/80" : "text-zinc-400"}`}
                >
                  Period comparison
                </h3>
                <div
                  className={`flex flex-wrap rounded-lg border p-0.5 ${isHighContrast ? "border-white/20" : "border-zinc-700"}`}
                >
                  {(
                    [
                      ["averageLoad", "Avg Load"],
                      ["averageRpe", "Avg RPE"],
                      ["averageDuration", "Avg Duration"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setChartMetric(value)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                        chartMetric === value
                          ? "bg-emerald-600/30 text-emerald-400"
                          : isHighContrast
                            ? "text-white/70 hover:text-white"
                            : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <PlayerSelfBaselineChart
                result={result}
                metric={chartMetric}
                isHighContrast={isHighContrast}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
