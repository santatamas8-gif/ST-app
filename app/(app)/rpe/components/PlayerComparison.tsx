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
import {
  buildPlayerComparisonRows,
  comparisonChartMetricLabel,
  filterSessionsForPlayerComparison,
  MAX_COMPARISON_PLAYERS,
  MATCHDAY_FILTER_OPTIONS,
  MIN_COMPARISON_PLAYERS,
  playerHasComparisonData,
  type MatchdayFilterOption,
  type PlayerComparisonChartMetric,
} from "@/lib/kioskRpe/playerComparisonAnalytics";
import { PlayerComparisonChart } from "./PlayerComparisonChart";
import {
  EMPTY_ANALYTICS_DISPLAY_NAMES,
  EMPTY_ANALYTICS_PLAYERS,
  EMPTY_ANALYTICS_SESSIONS,
} from "@/lib/kioskRpe/analyticsData";
import { useRpeAnalyticsData } from "./RpeAnalyticsDataProvider";
import { RefreshCw, Users, X } from "lucide-react";

const CARD_RADIUS = "12px";

function playerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return "?";
}

export function PlayerComparison() {
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
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [addPlayerId, setAddPlayerId] = useState("");
  const [matchdayTag, setMatchdayTag] = useState<MatchdayFilterOption>("All matchday tags");
  const [sessionType, setSessionType] = useState<SessionTypeFilterOption>("All session types");
  const [chartMetric, setChartMetric] = useState<PlayerComparisonChartMetric>("averageLoad");
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

  const availableToAdd = useMemo(
    () => players.filter((p) => !selectedPlayerIds.includes(p.id)),
    [players, selectedPlayerIds]
  );

  const canAddMore = selectedPlayerIds.length < MAX_COMPARISON_PLAYERS;

  const handleAddPlayer = () => {
    if (!addPlayerId || !canAddMore) return;
    if (selectedPlayerIds.includes(addPlayerId)) return;
    setSelectedPlayerIds((prev) => [...prev, addPlayerId]);
    setAddPlayerId("");
  };

  const handleRemovePlayer = (playerId: string) => {
    setSelectedPlayerIds((prev) => prev.filter((id) => id !== playerId));
  };

  const hasEnoughPlayers = selectedPlayerIds.length >= MIN_COMPARISON_PLAYERS;

  const comparisonRows = useMemo(() => {
    if (!hasEnoughPlayers || !rangeIsValid) return [];
    const filtered = filterSessionsForPlayerComparison(sessions, {
      from: appliedFrom,
      to: appliedTo,
      playerIds: selectedPlayerIds,
      matchdayTag,
      sessionType,
    });
    return buildPlayerComparisonRows(filtered, selectedPlayerIds, nameByPlayerId);
  }, [
    sessions,
    appliedFrom,
    appliedTo,
    selectedPlayerIds,
    matchdayTag,
    sessionType,
    nameByPlayerId,
    hasEnoughPlayers,
    rangeIsValid,
  ]);

  const showComparison = hasEnoughPlayers && !loading && !fetchError && !rangeError && rangeIsValid;
  const showNoData = showComparison && !playerHasComparisonData(comparisonRows);

  const inputClass =
    "h-10 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

  return (
    <section className="space-y-4">
      <h2
        className={`flex items-center gap-2 border-b pb-2 text-sm font-bold uppercase tracking-wider ${
          isHighContrast ? "border-white/20 text-white/90" : "border-zinc-700 text-zinc-200"
        }`}
      >
        <Users className="h-4 w-4 shrink-0" aria-hidden />
        Compare Players
      </h2>
      <p className={`text-sm ${isHighContrast ? "text-white/65" : "text-zinc-500"}`}>
        Compare load and RPE values for 2–4 selected players.
      </p>

      <div
        className={`space-y-4 rounded-xl border p-4 ${themeId === "neon" ? "neon-card-text border-white/20" : themeId === "matt" ? "matt-card-text border-white/15" : "border-zinc-800/90 bg-zinc-900/45"}`}
        style={themeId === "neon" || themeId === "matt" ? { borderRadius: CARD_RADIUS, ...cardStyle } : { borderRadius: CARD_RADIUS }}
      >
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

        <div className="space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <label className={`flex flex-col gap-1 text-xs ${isHighContrast ? "text-white/80" : "text-zinc-500"}`}>
              Add player
              <div className="flex gap-2">
                <select
                  value={addPlayerId}
                  onChange={(e) => setAddPlayerId(e.target.value)}
                  disabled={!canAddMore || availableToAdd.length === 0}
                  className={`${inputClass} min-w-[12rem] disabled:opacity-50`}
                >
                  <option value="">
                    {canAddMore ? "Select player…" : "Maximum 4 players"}
                  </option>
                  {availableToAdd.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddPlayer}
                  disabled={!addPlayerId || !canAddMore}
                  className="h-10 rounded-lg border border-zinc-600 bg-zinc-800/80 px-3 text-xs font-medium text-zinc-300 hover:bg-zinc-700/80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </label>
          </div>

          {selectedPlayerIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedPlayerIds.map((id) => {
                const name = nameByPlayerId[id] ?? players.find((p) => p.id === id)?.name ?? "Player";
                return (
                  <span
                    key={id}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                      isHighContrast
                        ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-300"
                        : "border-emerald-600/30 bg-emerald-950/20 text-emerald-400"
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        isHighContrast ? "bg-white/10 text-white" : "bg-zinc-700 text-zinc-200"
                      }`}
                      aria-hidden
                    >
                      {playerInitials(name)}
                    </span>
                    <span className="max-w-[8rem] truncate sm:max-w-none">{name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemovePlayer(id)}
                      className={`rounded p-0.5 hover:bg-white/10 ${isHighContrast ? "text-white/80" : "text-zinc-400"}`}
                      aria-label={`Remove ${name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
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

        {!hasEnoughPlayers && !loading && (
          <p className={`rounded-lg border border-zinc-800 bg-zinc-950/20 px-3 py-2 text-sm ${isHighContrast ? "text-white/70" : "text-zinc-400"}`}>
            Select at least 2 players to compare. You can compare up to 4 players.
          </p>
        )}

        {hasEnoughPlayers && (
          <p className={`text-xs leading-relaxed ${isHighContrast ? "text-white/70" : "text-zinc-500"}`}>
            Comparison values are influenced by the number and type of submitted sessions. Always
            interpret averages together with session count.
          </p>
        )}

        {loading && (
          <div className={`flex items-center gap-2 text-sm ${isHighContrast ? "text-white/70" : "text-zinc-400"}`}>
            <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
            Loading sessions…
          </div>
        )}

        {showNoData && (
          <p className={`rounded-lg border border-zinc-800 bg-zinc-950/20 px-3 py-2 text-sm ${isHighContrast ? "text-white/70" : "text-zinc-400"}`}>
            No RPE data found for the selected players and filters.
          </p>
        )}

        {showComparison && comparisonRows.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead
                  className={`border-b ${isHighContrast ? "border-white/20 bg-white/5 text-white/80" : "border-zinc-800 bg-zinc-800/80 text-zinc-400"}`}
                >
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Player</th>
                    <th className="px-3 py-2.5 font-medium">Sessions</th>
                    <th className="px-3 py-2.5 font-medium">Avg RPE</th>
                    <th className="px-3 py-2.5 font-medium">Avg Duration</th>
                    <th className="px-3 py-2.5 font-medium">Avg Load</th>
                    <th className="px-3 py-2.5 font-medium">Total Load</th>
                  </tr>
                </thead>
                <tbody className={isHighContrast ? "text-white/90" : "text-zinc-300"}>
                  {comparisonRows.map((row) => (
                    <tr
                      key={row.playerId}
                      className={`border-b ${isHighContrast ? "border-white/10" : "border-zinc-800"}`}
                    >
                      <td className="px-3 py-2.5 font-medium">{row.playerName}</td>
                      <td className="px-3 py-2.5 tabular-nums font-medium text-emerald-400">
                        {row.sessionCount}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{formatAverageRpe(row.averageRpe)}</td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {row.averageDuration == null ? "—" : `${formatAverageDuration(row.averageDuration)} min`}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums font-medium text-emerald-400">
                        {row.averageLoad == null ? "—" : `${formatAverageLoad(row.averageLoad)} AU`}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-zinc-400">
                        {row.sessionCount > 0 ? `${formatTotalLoad(row.totalLoad)} AU` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {playerHasComparisonData(comparisonRows) && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3
                    className={`text-xs font-semibold uppercase tracking-wide ${isHighContrast ? "text-white/80" : "text-zinc-400"}`}
                  >
                    Comparison chart · {comparisonChartMetricLabel(chartMetric)}
                  </h3>
                  <div
                    className={`flex flex-wrap rounded-lg border p-0.5 ${isHighContrast ? "border-white/20" : "border-zinc-700"}`}
                  >
                    {(
                      [
                        ["averageLoad", "Avg Load"],
                        ["averageRpe", "Avg RPE"],
                        ["averageDuration", "Avg Duration"],
                        ["totalLoad", "Total Load"],
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
                <PlayerComparisonChart
                  rows={comparisonRows}
                  metric={chartMetric}
                  isHighContrast={isHighContrast}
                />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
