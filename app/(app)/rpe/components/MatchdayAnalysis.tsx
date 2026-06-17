"use client";

import { useMemo, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { NEON_CARD_STYLE, MATT_CARD_STYLE } from "@/lib/themes";
import {
  buildMatchdayAnalytics,
  filterSessionsForMatchdayAnalysis,
  formatAverageDuration,
  formatAverageLoad,
  formatAverageRpe,
  formatTotalLoad,
  getDefaultDateRange,
  type MatchdayAnalysisMode,
  type MatchdayChartMetric,
  SESSION_TYPE_FILTER_OPTIONS,
  sortMatchdayAnalyticsRows,
  type SessionTypeFilterOption,
  validateDateRange,
} from "@/lib/kioskRpe/matchdayAnalytics";
import { MatchdayAnalysisChart } from "./MatchdayAnalysisChart";
import {
  EMPTY_ANALYTICS_PLAYERS,
  EMPTY_ANALYTICS_SESSIONS,
} from "@/lib/kioskRpe/analyticsData";
import { useRpeAnalyticsData } from "./RpeAnalyticsDataProvider";
import { BarChart2, RefreshCw } from "lucide-react";

const CARD_RADIUS = "12px";

export function MatchdayAnalysis() {
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
  const [mode, setMode] = useState<MatchdayAnalysisMode>("team");
  const [playerId, setPlayerId] = useState("");
  const [sessionType, setSessionType] = useState<SessionTypeFilterOption>("All session types");
  const [chartMetric, setChartMetric] = useState<MatchdayChartMetric>("averageLoad");
  const [rangeError, setRangeError] = useState<string | null>(null);

  const rangeIsValid = validateDateRange(appliedFrom, appliedTo).valid;
  const { data, loading, error: fetchError } = useRpeAnalyticsData(
    appliedFrom,
    appliedTo,
    rangeIsValid
  );
  const sessions = data?.sessions ?? EMPTY_ANALYTICS_SESSIONS;
  const players = data?.players ?? EMPTY_ANALYTICS_PLAYERS;

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

  const filteredSessions = useMemo(
    () =>
      filterSessionsForMatchdayAnalysis(sessions, {
        from: appliedFrom,
        to: appliedTo,
        mode,
        playerId: mode === "individual" ? playerId : null,
        sessionType,
      }),
    [sessions, appliedFrom, appliedTo, mode, playerId, sessionType]
  );

  const analyticsRows = useMemo(
    () => sortMatchdayAnalyticsRows(buildMatchdayAnalytics(filteredSessions)),
    [filteredSessions]
  );

  const selectedPlayerName =
    mode === "individual" && playerId
      ? players.find((p) => p.id === playerId)?.name ?? "Selected player"
      : null;

  const showEmpty =
    !loading &&
    !fetchError &&
    !rangeError &&
    (mode === "individual" && !playerId
      ? false
      : filteredSessions.length === 0);

  const inputClass =
    "h-9 rounded border border-zinc-700 bg-zinc-800/80 px-2 py-1 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  return (
    <section className="space-y-4">
      <h2
        className={`flex items-center gap-2 border-b pb-2 text-sm font-bold uppercase tracking-wider ${
          isHighContrast ? "border-white/20 text-white/90" : "border-zinc-700 text-zinc-200"
        }`}
      >
        <BarChart2 className="h-4 w-4 shrink-0" aria-hidden />
        Matchday Analysis
      </h2>

      <div
        className={`rounded-xl p-4 space-y-4 ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
        style={{ borderRadius: CARD_RADIUS, ...cardStyle }}
      >
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
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
            className="h-9 rounded border border-emerald-600/50 bg-emerald-950/30 px-3 text-xs font-medium text-emerald-400 hover:bg-emerald-900/40"
          >
            Apply range
          </button>

          <div className={`flex rounded-lg border p-0.5 ${isHighContrast ? "border-white/20" : "border-zinc-700"}`}>
            {(["team", "individual"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  mode === value
                    ? "bg-emerald-600/30 text-emerald-400"
                    : isHighContrast
                      ? "text-white/70 hover:text-white"
                      : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {value === "team" ? "Team" : "Individual player"}
              </button>
            ))}
          </div>

          {mode === "individual" && (
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
          )}

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

        {mode === "team" && (
          <p className={`text-xs leading-relaxed ${isHighContrast ? "text-white/70" : "text-zinc-500"}`}>
            Average values are calculated from individual session entries. Total load is influenced by
            the number of submitted players and sessions.
          </p>
        )}

        {mode === "individual" && selectedPlayerName && (
          <p className={`text-sm font-medium ${isHighContrast ? "text-white/90" : "text-zinc-300"}`}>
            {selectedPlayerName}
          </p>
        )}

        {mode === "individual" && !playerId && !loading && (
          <p className={`text-sm ${isHighContrast ? "text-white/70" : "text-zinc-400"}`}>
            Select a player to view their matchday history.
          </p>
        )}

        {loading && (
          <div className={`flex items-center gap-2 text-sm ${isHighContrast ? "text-white/70" : "text-zinc-400"}`}>
            <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
            Loading sessions…
          </div>
        )}

        {!loading && showEmpty && (
          <p className={`text-sm ${isHighContrast ? "text-white/70" : "text-zinc-400"}`}>
            No Matchday RPE data found for the selected filters.
          </p>
        )}

        {!loading && analyticsRows.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-lg border border-zinc-700/80">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead
                  className={`border-b ${isHighContrast ? "border-white/20 bg-white/5 text-white/80" : "border-zinc-700 bg-zinc-800/80 text-zinc-400"}`}
                >
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Matchday</th>
                    <th className="px-3 py-2.5 font-medium">Sessions</th>
                    {mode === "team" && <th className="px-3 py-2.5 font-medium">Players</th>}
                    <th className="px-3 py-2.5 font-medium">Avg RPE</th>
                    <th className="px-3 py-2.5 font-medium">Avg Duration</th>
                    <th className="px-3 py-2.5 font-medium">Avg Load</th>
                    <th className="px-3 py-2.5 font-medium">Total Load</th>
                  </tr>
                </thead>
                <tbody className={isHighContrast ? "text-white/90" : "text-zinc-300"}>
                  {analyticsRows.map((row) => (
                    <tr
                      key={row.tag}
                      className={`border-b ${isHighContrast ? "border-white/10" : "border-zinc-800"}`}
                    >
                      <td className="px-3 py-2.5 font-medium">
                        <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-950/20 px-2 py-0.5 text-[11px] text-emerald-400">
                          {row.tag}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{row.sessionCount}</td>
                      {mode === "team" && (
                        <td className="px-3 py-2.5 tabular-nums">{row.uniquePlayerCount}</td>
                      )}
                      <td className="px-3 py-2.5 tabular-nums">{formatAverageRpe(row.averageRpe)}</td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {formatAverageDuration(row.averageDuration)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums font-medium text-emerald-400">
                        {formatAverageLoad(row.averageLoad)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-zinc-400">
                        {formatTotalLoad(row.totalLoad)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className={`text-xs font-semibold uppercase tracking-wide ${isHighContrast ? "text-white/80" : "text-zinc-400"}`}>
                  Comparison chart
                </h3>
                <div className={`flex rounded-lg border p-0.5 ${isHighContrast ? "border-white/20" : "border-zinc-700"}`}>
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
              <MatchdayAnalysisChart
                rows={analyticsRows}
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
