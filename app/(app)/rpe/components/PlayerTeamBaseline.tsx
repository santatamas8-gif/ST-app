"use client";

import { useMemo, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { NEON_CARD_STYLE, MATT_CARD_STYLE } from "@/lib/themes";
import {
  getDefaultDateRange,
  SESSION_TYPE_FILTER_OPTIONS,
  type SessionTypeFilterOption,
  validateDateRange,
  formatAverageDuration,
  formatAverageLoad,
  formatAverageRpe,
  formatTotalLoad,
} from "@/lib/kioskRpe/matchdayAnalytics";
import { MATCHDAY_FILTER_OPTIONS, type MatchdayFilterOption } from "@/lib/kioskRpe/playerComparisonAnalytics";
import {
  buildPlayerTeamBaselineResult,
  chartMetricTitle,
  teamInterpretationLabel,
  type PlayerTeamChartMetric,
  type PlayerTeamDeviation,
} from "@/lib/kioskRpe/playerTeamBaselineAnalytics";
import { PlayerTeamBaselineChart } from "./PlayerTeamBaselineChart";
import {
  EMPTY_ANALYTICS_DISPLAY_NAMES,
  EMPTY_ANALYTICS_PLAYERS,
  EMPTY_ANALYTICS_SESSIONS,
} from "@/lib/kioskRpe/analyticsData";
import { useRpeAnalyticsData } from "./RpeAnalyticsDataProvider";
import { RefreshCw, UsersRound } from "lucide-react";

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
  interpretation: PlayerTeamDeviation["interpretation"],
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

export function PlayerTeamBaseline() {
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";
  const cardStyle =
    themeId === "neon"
      ? NEON_CARD_STYLE
      : themeId === "matt"
        ? MATT_CARD_STYLE
        : { backgroundColor: "var(--card-bg)" };

  const defaults = useMemo(() => getDefaultDateRange(), []);
  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);
  const [appliedFrom, setAppliedFrom] = useState(defaults.from);
  const [appliedTo, setAppliedTo] = useState(defaults.to);
  const [playerId, setPlayerId] = useState("");
  const [matchdayTag, setMatchdayTag] = useState<MatchdayFilterOption>("All matchday tags");
  const [sessionType, setSessionType] = useState<SessionTypeFilterOption>("All session types");
  const [chartMetric, setChartMetric] = useState<PlayerTeamChartMetric>("averageLoad");
  const [rangeError, setRangeError] = useState<string | null>(null);

  const rangeIsValid = validateDateRange(appliedFrom, appliedTo).valid;
  const { data, loading, error: fetchError } = useRpeAnalyticsData(
    appliedFrom,
    appliedTo,
    rangeIsValid
  );
  const sessions = data?.sessions ?? EMPTY_ANALYTICS_SESSIONS;
  const players = data?.players ?? EMPTY_ANALYTICS_PLAYERS;
  const nameByPlayerId = data?.displayNameByUserId ?? EMPTY_ANALYTICS_DISPLAY_NAMES;

  const handleApplyRange = () => {
    const check = validateDateRange(fromDate, toDate);
    if (!check.valid) {
      setRangeError(check.message);
      return;
    }
    setRangeError(null);
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
  };

  const validPlayerIds = useMemo(() => players.map((p) => p.id), [players]);

  const result = useMemo(() => {
    if (!playerId || !rangeIsValid) return null;
    return buildPlayerTeamBaselineResult(sessions, {
      selectedPlayerId: playerId,
      from: appliedFrom,
      to: appliedTo,
      matchdayTag,
      sessionType,
      validPlayerIds,
    });
  }, [
    sessions,
    playerId,
    appliedFrom,
    appliedTo,
    matchdayTag,
    sessionType,
    validPlayerIds,
    rangeIsValid,
  ]);

  const selectedPlayerName = playerId
    ? nameByPlayerId[playerId] ?? players.find((p) => p.id === playerId)?.name ?? "Player"
    : null;

  const inputClass =
    "h-10 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  const metricCards = result
    ? [
        {
          title: "Average RPE",
          player: formatAverageRpe(result.player.averageRpe),
          team: formatAverageRpe(result.team.averageRpe),
          absolute: formatAbsoluteDiff(result.deviations.averageRpe.absoluteDifference, "rpe"),
          percentage: formatPercentageDiff(result.deviations.averageRpe.percentageDifference),
          interpretation: result.deviations.averageRpe.interpretation,
        },
        {
          title: "Average Duration",
          player:
            result.player.averageDuration != null
              ? `${formatAverageDuration(result.player.averageDuration)} min`
              : "—",
          team:
            result.team.averageDuration != null
              ? `${formatAverageDuration(result.team.averageDuration)} min`
              : "—",
          absolute: formatAbsoluteDiff(result.deviations.averageDuration.absoluteDifference, "duration"),
          percentage: formatPercentageDiff(result.deviations.averageDuration.percentageDifference),
          interpretation: result.deviations.averageDuration.interpretation,
        },
        {
          title: "Average Load",
          player:
            result.player.averageLoad != null
              ? `${formatAverageLoad(result.player.averageLoad)} AU`
              : "—",
          team:
            result.team.averageLoad != null
              ? `${formatAverageLoad(result.team.averageLoad)} AU`
              : "—",
          absolute: formatAbsoluteDiff(result.deviations.averageLoad.absoluteDifference, "load"),
          percentage: formatPercentageDiff(result.deviations.averageLoad.percentageDifference),
          interpretation: result.deviations.averageLoad.interpretation,
        },
        {
          title: "Total Load",
          player:
            result.player.sessionCount > 0
              ? `${formatTotalLoad(result.player.totalLoad)} AU`
              : "—",
          team:
            result.team.sessionCount > 0
              ? `${formatTotalLoad(result.team.totalLoad)} AU`
              : "—",
          absolute: null,
          percentage: null,
          interpretation: null as PlayerTeamDeviation["interpretation"] | null,
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
        <UsersRound className="h-4 w-4 shrink-0" aria-hidden />
        Player vs Team
      </h2>
      <p className={`text-sm ${isHighContrast ? "text-white/65" : "text-zinc-500"}`}>
        Compare one player with the rest of the team in the same period.
      </p>

      <div
        className={`space-y-4 rounded-xl border p-4 ${themeId === "neon" ? "neon-card-text border-white/20" : themeId === "matt" ? "matt-card-text border-white/15" : "border-zinc-800/90 bg-zinc-900/45"}`}
        style={themeId === "neon" || themeId === "matt" ? { borderRadius: CARD_RADIUS, ...cardStyle } : { borderRadius: CARD_RADIUS }}
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className={`flex flex-col gap-1 text-xs ${isHighContrast ? "text-white/80" : "text-zinc-500"}`}>
            Player
            <select
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              className={`${inputClass} min-w-[14rem]`}
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
            From
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className={`flex flex-col gap-1 text-xs ${isHighContrast ? "text-white/80" : "text-zinc-500"}`}>
            To
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <button
            type="button"
            onClick={handleApplyRange}
            className="h-10 rounded-lg border border-emerald-600/50 bg-emerald-950/30 px-3 text-xs font-medium text-emerald-400 hover:bg-emerald-900/40"
          >
            Apply range
          </button>

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

        {rangeError && (
          <p className="text-sm text-amber-400" role="alert">
            {rangeError}
          </p>
        )}
        {fetchError && (
          <p className="text-sm text-red-400" role="alert">
            {fetchError}
          </p>
        )}

        {!playerId && !loading && (
          <p className={`rounded-lg border border-zinc-800 bg-zinc-950/20 px-3 py-2 text-sm ${isHighContrast ? "text-white/70" : "text-zinc-400"}`}>
            Select a player to compare their values with the rest of the team.
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
          <>
            <p className={`rounded-lg border border-zinc-800 bg-zinc-950/20 px-3 py-2 text-xs ${isHighContrast ? "text-white/70" : "text-zinc-400"}`}>
              The selected player is excluded from the team comparison group.
            </p>
          </>
        )}

        {loading && (
          <div className={`flex items-center gap-2 text-sm ${isHighContrast ? "text-white/70" : "text-zinc-400"}`}>
            <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
            Loading sessions…
          </div>
        )}

        {playerId && !loading && result && !result.hasAnySessions && (
          <p className={`rounded-lg border border-zinc-800 bg-zinc-950/20 px-3 py-2 text-sm ${isHighContrast ? "text-white/70" : "text-zinc-400"}`}>
            No matching RPE sessions found for the selected player and team filters.
          </p>
        )}

        {playerId && !loading && result && result.hasAnySessions && (
          <>
            {result.limitedData && (
              <p className={`rounded-lg border border-zinc-800 bg-zinc-950/20 px-3 py-2 text-sm ${isHighContrast ? "text-white/70" : "text-zinc-400"}`} role="status">
                Limited data for a reliable comparison. Player: {result.player.sessionCount} sessions · Team:{" "}
                {result.team.sessionCount} sessions · {result.team.uniquePlayerCount} other players.
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
                  <p
                    className={`text-[11px] font-semibold uppercase tracking-wide ${isHighContrast ? "text-white/70" : "text-zinc-500"}`}
                  >
                    {card.title}
                  </p>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex justify-between gap-2">
                      <span className={isHighContrast ? "text-white/60" : "text-zinc-500"}>Player</span>
                      <span className="font-medium tabular-nums text-emerald-400">{card.player}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className={isHighContrast ? "text-white/60" : "text-zinc-500"}>Team</span>
                      <span className="tabular-nums">{card.team}</span>
                    </div>
                    {card.title === "Total Load" ? (
                      <p className={`pt-1 text-[10px] ${isHighContrast ? "text-white/50" : "text-zinc-500"}`}>
                        {result.player.sessionCount} player · {result.team.sessionCount} team sessions ·{" "}
                        {result.team.uniquePlayerCount} other players
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
                          <p
                            className={`pt-1 text-[11px] font-medium ${interpretationClass(card.interpretation, isHighContrast)}`}
                          >
                            {teamInterpretationLabel(card.interpretation)}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead
                  className={`border-b ${isHighContrast ? "border-white/20 bg-white/5 text-white/80" : "border-zinc-800 bg-zinc-800/80 text-zinc-400"}`}
                >
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Group</th>
                    <th className="px-3 py-2.5 font-medium">Sessions</th>
                    <th className="px-3 py-2.5 font-medium">Players</th>
                    <th className="px-3 py-2.5 font-medium">Avg RPE</th>
                    <th className="px-3 py-2.5 font-medium">Avg Duration</th>
                    <th className="px-3 py-2.5 font-medium">Avg Load</th>
                    <th className="px-3 py-2.5 font-medium">Total Load</th>
                  </tr>
                </thead>
                <tbody className={isHighContrast ? "text-white/90" : "text-zinc-300"}>
                  <tr className={`border-b ${isHighContrast ? "border-white/10" : "border-zinc-800"}`}>
                    <td className="px-3 py-2.5 font-medium text-emerald-400">
                      {selectedPlayerName ?? "Selected Player"}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums font-medium text-emerald-400">
                      {result.player.sessionCount}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {result.player.sessionCount > 0 ? result.player.uniquePlayerCount : "—"}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{formatAverageRpe(result.player.averageRpe)}</td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {result.player.averageDuration == null ? "—" : `${formatAverageDuration(result.player.averageDuration)} min`}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums font-medium text-emerald-400">
                      {result.player.averageLoad == null ? "—" : `${formatAverageLoad(result.player.averageLoad)} AU`}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {result.player.sessionCount > 0 ? `${formatTotalLoad(result.player.totalLoad)} AU` : "—"}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2.5 font-medium text-sky-400">Team Baseline</td>
                    <td className="px-3 py-2.5 tabular-nums">{result.team.sessionCount}</td>
                    <td className="px-3 py-2.5 tabular-nums">{result.team.uniquePlayerCount}</td>
                    <td className="px-3 py-2.5 tabular-nums">{formatAverageRpe(result.team.averageRpe)}</td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {result.team.averageDuration == null ? "—" : `${formatAverageDuration(result.team.averageDuration)} min`}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {result.team.averageLoad == null ? "—" : `${formatAverageLoad(result.team.averageLoad)} AU`}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {result.team.sessionCount > 0 ? `${formatTotalLoad(result.team.totalLoad)} AU` : "—"}
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
                  Comparison chart · {chartMetricTitle(chartMetric)}
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
                      className={`h-8 rounded-md px-2.5 text-[11px] font-medium transition ${
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
              <PlayerTeamBaselineChart
                result={result}
                metric={chartMetric}
                playerLabel={selectedPlayerName ?? "Player"}
                isHighContrast={isHighContrast}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
