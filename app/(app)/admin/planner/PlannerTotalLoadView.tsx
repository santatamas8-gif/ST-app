"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { getPlannerTotalLoadAction } from "@/app/actions/gpsPlanner";
import type {
  DailyPlanPctSummary,
  PlannerUiPlayer,
  PlannerWeekRow,
} from "@/lib/gpsPlanner/types";
import type {
  TotalLoadOfficialMatchItem,
  TotalLoadResult,
  TotalLoadTopValue,
} from "@/lib/gpsPlanner/totalLoadAggregation";
import {
  formatCompactDateRange,
  formatCompactIsoDate,
  formatMatchDurationSeconds,
  formatMatchTimeMinutes,
  formatTotalLoadMatchSourceStatus,
  formatTotalLoadMetricBreakdown,
  formatTotalLoadPercent,
  formatWeeklyPlanSharedPct,
  sortTotalLoadRowsByTotal,
  totalLoadCellPercent,
  totalLoadCellValue,
} from "@/lib/gpsPlanner/totalLoadDisplay";
import {
  formatPlannerDisplayAbsoluteOrDash,
  plannerErrorMessage,
} from "@/lib/gpsPlanner/uiDisplay";

type Props = {
  week: PlannerWeekRow;
  players: PlannerUiPlayer[];
  weekControl?: ReactNode;
};

type MetricCol = {
  key: "td" | "hsr" | "sprint" | "acc" | "dec";
  label: string;
  unit?: "m";
  field: "totalDistance" | "hsr" | "sprint" | "accelerations" | "decelerations";
};

const METRICS: MetricCol[] = [
  { key: "td", label: "TD", unit: "m", field: "totalDistance" },
  { key: "hsr", label: "HSR", unit: "m", field: "hsr" },
  { key: "sprint", label: "Sprint", unit: "m", field: "sprint" },
  { key: "acc", label: "Acc", field: "accelerations" },
  { key: "dec", label: "Dec", field: "decelerations" },
];

const TOP_CARDS: {
  key: MetricCol["field"];
  title: string;
}[] = [
  { key: "totalDistance", title: "TD" },
  { key: "hsr", title: "HSR" },
  { key: "sprint", title: "Sprint" },
  { key: "accelerations", title: "Acc" },
  { key: "decelerations", title: "Dec" },
];

const WEEKLY_PLAN_METRICS: {
  key: keyof DailyPlanPctSummary;
  label: string;
}[] = [
  { key: "td", label: "TD" },
  { key: "hsr", label: "HSR" },
  { key: "sprint", label: "Sprint" },
  { key: "acc", label: "Acc" },
  { key: "dec", label: "Dec" },
];

function WeeklyPlanStrip({ summary }: { summary: DailyPlanPctSummary }) {
  return (
    <span>
      <span className="mx-1.5 text-zinc-600">·</span>
      <span className="font-medium uppercase tracking-wide">Weekly Plan</span>
      {WEEKLY_PLAN_METRICS.map((metric) => (
        <span key={metric.key}>
          <span className="mx-1.5 text-zinc-600">·</span>
          {metric.label} {formatWeeklyPlanSharedPct(summary[metric.key])}
        </span>
      ))}
    </span>
  );
}

function TopValueCard({
  title,
  value,
  selected,
  onSelect,
}: {
  title: string;
  value: TotalLoadTopValue;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Sort table by ${title}`}
      className={`flex min-w-0 w-full flex-col overflow-hidden rounded-lg px-2.5 py-2 text-left ${
        selected
          ? "bg-[#2d6a50] text-white"
          : "bg-transparent text-zinc-300 hover:bg-[#245c45] hover:text-white"
      }`}
    >
      <p
        className={`truncate text-[10px] font-semibold uppercase tracking-normal ${
          selected ? "text-emerald-200/80" : "text-zinc-400"
        }`}
      >
        {title}
      </p>
      {value ? (
        <>
          <p
            className={`mt-0.5 truncate text-xs font-medium ${
              selected ? "text-zinc-100" : "text-zinc-200"
            }`}
          >
            {value.playerDisplayName}
          </p>
          <p className="mt-1 truncate text-lg font-semibold tabular-nums leading-none text-white">
            {formatPlannerDisplayAbsoluteOrDash(value.value)}
          </p>
        </>
      ) : (
        <p className="mt-1 text-lg font-semibold leading-none text-zinc-500">
          —
        </p>
      )}
    </button>
  );
}

function PlayerCell({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";
  return (
    <div className="flex min-w-0 items-center">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          className="size-8 shrink-0 rounded-full object-cover ring-1 ring-zinc-200"
        />
      ) : (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-medium text-zinc-500 ring-1 ring-zinc-200">
          {initial}
        </span>
      )}
      <span className="ml-2 truncate text-[15px] font-medium text-zinc-900">
        {name}
      </span>
    </div>
  );
}

function ConfiguredMatchStatus({ match }: { match: TotalLoadOfficialMatchItem }) {
  const gps = formatTotalLoadMatchSourceStatus(match.sourceStatus);
  return (
    <div className="min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        Match {match.matchOrder}
      </p>
      <p className="mt-0.5 font-medium text-zinc-900">
        {formatCompactIsoDate(match.gpsDate)}
      </p>
      <p className="text-zinc-600">{match.mdTag}</p>
      {match.opponent ? (
        <p className="text-zinc-500">vs {match.opponent}</p>
      ) : null}
      {gps ? <p className="mt-1 text-zinc-500">{gps}</p> : null}
    </div>
  );
}

export function PlannerTotalLoadView({ week, players, weekControl }: Props) {
  const [result, setResult] = useState<TotalLoadResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<MetricCol["field"] | null>(null);
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const avatarById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const p of players) m.set(p.id, p.avatarUrl);
    return m;
  }, [players]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setResult(null);
    setError(null);
    void (async () => {
      const totalRes = await getPlannerTotalLoadAction(week.id);
      if (cancelled) return;
      if (!totalRes.ok) {
        setError(
          plannerErrorMessage(totalRes.error.code, totalRes.error.message)
        );
        setResult(null);
      } else {
        setResult(totalRes.data);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [week.id]);

  function sortByMost(field: MetricCol["field"]) {
    setSortField(field);
    setSortDir("desc");
  }

  function toggleTotalSort(field: MetricCol["field"]) {
    if (sortField !== field) {
      setSortField(field);
      setSortDir("desc");
      return;
    }
    if (sortDir === "desc") {
      setSortDir("asc");
      return;
    }
    setSortField(null);
    setSortDir("desc");
  }

  const displayRows = useMemo(() => {
    if (!result) return [];
    if (!sortField) return result.rows;
    return sortTotalLoadRowsByTotal(result.rows, sortField, sortDir);
  }, [result, sortField, sortDir]);

  const officialMatches = result?.officialMatches ?? [];
  const matchSelected = officialMatches.length > 0;
  const showTotals = matchSelected && !loading && result != null;
  const emptyTargets = result != null && result.rows.length === 0;
  const matchUnavailable =
    showTotals &&
    result.rows.some((row) => row.match.quality === "match_query_error");
  const matchPending =
    showTotals &&
    result.rows.some((row) => row.quality === "match_data_pending");

  return (
    <div className="no-print space-y-3">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">{weekControl}</div>
        </div>
        {!loading && result ? (
          <p className="text-[11px] leading-relaxed text-zinc-500">
            Training: {formatCompactDateRange(week.startDate, week.endDate)}
            <WeeklyPlanStrip summary={result.weeklyPlanSummary} />
          </p>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading Total Load…</p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error}
        </p>
      ) : null}

      {!loading ? (
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Configured Matches
          </p>
          {officialMatches.length === 0 ? (
            <p className="rounded-lg border border-zinc-200 bg-white px-4 py-4 text-sm text-zinc-600 shadow-sm">
              No configured matches. Add them in Create/Edit Week. Total Load is
              unavailable until a Match is configured.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {officialMatches.map((match) => (
                <ConfiguredMatchStatus key={match.matchId} match={match} />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {matchPending ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
          Match GPS is not yet available for a configured match. Total Week is
          unavailable.
        </p>
      ) : null}

      {matchUnavailable ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
          Match GPS is unavailable for this week.
        </p>
      ) : null}

      {!loading && emptyTargets ? (
        <p className="text-sm text-zinc-500">
          No Weekly Targets saved for this week.
        </p>
      ) : null}

      {showTotals && !emptyTargets ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-[#245c45] bg-[#1b4332] p-1">
            <div className="grid w-full grid-cols-5 gap-1">
              {TOP_CARDS.map((card) => (
                <TopValueCard
                  key={card.key}
                  title={card.title}
                  value={result.topValues[card.key]}
                  selected={sortField === card.key && sortDir === "desc"}
                  onSelect={() => sortByMost(card.key)}
                />
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-[920px] w-full border-collapse text-[15px]">
              <thead>
                <tr className="bg-[#1b4332] text-xs uppercase tracking-wide text-white">
                  <th className="sticky left-0 z-10 bg-[#1b4332] px-3 py-3 text-left font-medium">
                    Player
                  </th>
                  {METRICS.map((m) => (
                    <Fragment key={m.key}>
                      <th className="border-l border-white/15 px-1 py-2 text-center font-medium">
                        <button
                          type="button"
                          onClick={() => toggleTotalSort(m.field)}
                          aria-label={`Sort by ${m.label}`}
                          aria-sort={
                            sortField === m.field
                              ? sortDir === "desc"
                                ? "descending"
                                : "ascending"
                              : "none"
                          }
                          className="inline-flex min-h-[36px] w-full items-center justify-center gap-1 rounded-md px-2 text-xs font-medium uppercase tracking-wide text-white hover:bg-white/10"
                        >
                          {m.label}
                          {m.unit ? (
                            <span className="normal-case text-[10px] font-normal tracking-normal text-zinc-400">
                              ({m.unit})
                            </span>
                          ) : null}
                          {sortField === m.field ? (
                            <span className="text-[10px] text-zinc-300" aria-hidden>
                              {sortDir === "desc" ? "▼" : "▲"}
                            </span>
                          ) : null}
                        </button>
                      </th>
                      <th className="px-2 py-3 text-center font-medium text-zinc-400">
                        {m.label} %
                      </th>
                    </Fragment>
                  ))}
                  <th className="border-l border-white/15 px-3 py-3 text-center font-medium">
                    Match Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, index) => {
                  const name = row.playerDisplayName;
                  const totalsUnavailable =
                    row.quality === "unsafe" ||
                    row.quality === "match_data_pending" ||
                    row.quality === "match_not_selected";
                  const stripe = index % 2 === 0 ? "bg-white" : "bg-zinc-100";
                  const matchMinutes = formatMatchTimeMinutes(
                    row.match.durationSeconds
                  );
                  return (
                    <tr
                      key={row.playerId}
                      className={`border-b border-zinc-300 text-zinc-800 ${stripe}`}
                    >
                      <td className={`sticky left-0 z-10 px-3 py-2.5 ${stripe}`}>
                        <PlayerCell
                          name={name}
                          avatarUrl={avatarById.get(row.playerId) ?? null}
                        />
                      </td>
                      {METRICS.map((m) => {
                        const total = totalsUnavailable
                          ? null
                          : totalLoadCellValue(row, m.field);
                        const pct = totalsUnavailable
                          ? null
                          : totalLoadCellPercent(row, m.field);
                        const title = formatTotalLoadMetricBreakdown({
                          quality: row.quality,
                          trainingValue: row.training.metrics?.[m.field] ?? null,
                          matchValue: row.match.metrics?.[m.field] ?? null,
                          totalValue: row.total.metrics?.[m.field] ?? null,
                          matchQuality: row.match.quality,
                        });
                        return (
                          <Fragment key={m.key}>
                            <td
                              title={title}
                              className="border-l border-zinc-200/80 px-3 py-2.5 text-center font-semibold tabular-nums"
                            >
                              {formatPlannerDisplayAbsoluteOrDash(total)}
                            </td>
                            <td
                              title={title}
                              className="px-2 py-2.5 text-center text-sm tabular-nums text-zinc-500"
                            >
                              {formatTotalLoadPercent(pct)}
                            </td>
                          </Fragment>
                        );
                      })}
                      <td
                        title={formatMatchDurationSeconds(row.match.durationSeconds)}
                        className="border-l border-zinc-200/80 px-3 py-2.5 text-center tabular-nums"
                      >
                        {matchMinutes === "—" ? (
                          matchMinutes
                        ) : (
                          <>
                            {matchMinutes}
                            <span className="ml-0.5 text-[11px] font-normal text-zinc-400">
                              min
                            </span>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
