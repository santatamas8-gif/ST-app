"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  deletePlannerWeekOfficialMatchAction,
  getPlannerTotalLoadAction,
  listPlannerMatchCandidatesAction,
  setPlannerWeekOfficialMatchAction,
} from "@/app/actions/gpsPlanner";
import type {
  PlannerMatchCandidate,
  PlannerUiPlayer,
  PlannerWeekRow,
} from "@/lib/gpsPlanner/types";
import type {
  TotalLoadPlayerRow,
  TotalLoadResult,
  TotalLoadTopValue,
} from "@/lib/gpsPlanner/totalLoadAggregation";
import {
  formatCompactDateRange,
  formatCompactIsoDate,
  formatMatchDurationSeconds,
  formatTotalLoadMetricBreakdown,
  formatTotalLoadPercent,
  formatTotalLoadQualityBadge,
  formatWeeklyPlanSummaryLine,
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
};

type MetricCol = {
  key: "td" | "hsr" | "sprint" | "acc" | "dec";
  label: string;
  field: "totalDistance" | "hsr" | "sprint" | "accelerations" | "decelerations";
};

const METRICS: MetricCol[] = [
  { key: "td", label: "TD", field: "totalDistance" },
  { key: "hsr", label: "HSR", field: "hsr" },
  { key: "sprint", label: "Sprint", field: "sprint" },
  { key: "acc", label: "Acc", field: "accelerations" },
  { key: "dec", label: "Dec", field: "decelerations" },
];

const TOP_CARDS: {
  key: MetricCol["field"];
  title: string;
}[] = [
  { key: "totalDistance", title: "Most TD" },
  { key: "hsr", title: "Most HSR" },
  { key: "sprint", title: "Most Sprint" },
  { key: "accelerations", title: "Most Acc" },
  { key: "decelerations", title: "Most Dec" },
];

function ConfirmDialog({
  open,
  title,
  body,
  error,
  confirmLabel,
  onCancel,
  onConfirm,
  busy,
}: {
  open: boolean;
  title: string;
  body: string;
  error?: string | null;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{body}</p>
        {error ? (
          <p className="mt-3 text-sm text-zinc-200">{error}</p>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-[44px] rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="min-h-[44px] rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function QualityBadge({ row }: { row: TotalLoadPlayerRow }) {
  const label = formatTotalLoadQualityBadge(row.quality);
  if (!label) return null;
  if (label === "Complete") {
    return (
      <span className="ml-2 shrink-0 text-[11px] font-medium uppercase tracking-wide text-zinc-300">
        Complete
      </span>
    );
  }
  return (
    <span className="ml-2 inline-flex shrink-0 items-center rounded-md border border-zinc-600 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-zinc-300">
      {label}
    </span>
  );
}

function TopValueCard({
  title,
  value,
}: {
  title: string;
  value: TotalLoadTopValue;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
        {title}
      </p>
      {value ? (
        <>
          <p className="mt-1 truncate text-sm text-zinc-200">
            {value.playerDisplayName}
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-50">
            {formatPlannerDisplayAbsoluteOrDash(value.value)}
          </p>
        </>
      ) : (
        <p className="mt-2 text-lg font-semibold text-zinc-500">—</p>
      )}
    </div>
  );
}

function PlayerCell({
  name,
  avatarUrl,
  quality,
}: {
  name: string;
  avatarUrl: string | null;
  quality: TotalLoadPlayerRow;
}) {
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";
  return (
    <div className="flex min-w-0 items-center">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          className="size-8 shrink-0 rounded-full object-cover ring-1 ring-zinc-700"
        />
      ) : (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-zinc-300 ring-1 ring-zinc-700">
          {initial}
        </span>
      )}
      <span className="ml-2 truncate text-[15px] font-medium text-zinc-100">
        {name}
      </span>
      <QualityBadge row={quality} />
    </div>
  );
}

export function PlannerTotalLoadView({ week, players }: Props) {
  const [result, setResult] = useState<TotalLoadResult | null>(null);
  const [candidates, setCandidates] = useState<PlannerMatchCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [changing, setChanging] = useState(false);
  const [draftGpsDate, setDraftGpsDate] = useState("");
  const [opponent, setOpponent] = useState("");
  const [matchday, setMatchday] = useState("");
  const [competition, setCompetition] = useState("");

  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const avatarById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const p of players) m.set(p.id, p.avatarUrl);
    return m;
  }, [players]);

  async function loadWeekData() {
    setLoading(true);
    setError(null);
    setCandidateError(null);
    setResult(null);
    try {
      const [totalRes, candidateRes] = await Promise.all([
        getPlannerTotalLoadAction(week.id),
        listPlannerMatchCandidatesAction(week.id),
      ]);
      if (!totalRes.ok) {
        setError(
          plannerErrorMessage(totalRes.error.code, totalRes.error.message)
        );
        setResult(null);
      } else {
        setResult(totalRes.data);
        if (!totalRes.data.officialMatch.selected) {
          setChanging(true);
        } else {
          setChanging(false);
          setDraftGpsDate(totalRes.data.officialMatch.gpsDate ?? "");
          setOpponent(totalRes.data.officialMatch.opponent ?? "");
          setMatchday(totalRes.data.officialMatch.matchday ?? "");
          setCompetition(totalRes.data.officialMatch.competition ?? "");
        }
      }
      if (!candidateRes.ok) {
        setCandidateError(
          plannerErrorMessage(candidateRes.error.code, candidateRes.error.message)
        );
        setCandidates([]);
      } else {
        setCandidates(candidateRes.data);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setResult(null);
    setError(null);
    setSaveError(null);
    void (async () => {
      const [totalRes, candidateRes] = await Promise.all([
        getPlannerTotalLoadAction(week.id),
        listPlannerMatchCandidatesAction(week.id),
      ]);
      if (cancelled) return;
      if (!totalRes.ok) {
        setError(
          plannerErrorMessage(totalRes.error.code, totalRes.error.message)
        );
        setResult(null);
      } else {
        setResult(totalRes.data);
        if (!totalRes.data.officialMatch.selected) {
          setChanging(true);
          setDraftGpsDate("");
          setOpponent("");
          setMatchday("");
          setCompetition("");
        } else {
          setChanging(false);
          setDraftGpsDate(totalRes.data.officialMatch.gpsDate ?? "");
          setOpponent(totalRes.data.officialMatch.opponent ?? "");
          setMatchday(totalRes.data.officialMatch.matchday ?? "");
          setCompetition(totalRes.data.officialMatch.competition ?? "");
        }
      }
      if (!candidateRes.ok) {
        setCandidateError(
          plannerErrorMessage(candidateRes.error.code, candidateRes.error.message)
        );
        setCandidates([]);
      } else {
        setCandidateError(null);
        setCandidates(candidateRes.data);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [week.id]);

  function selectCandidate(gpsDate: string) {
    setDraftGpsDate(gpsDate);
    setSaveError(null);
  }

  async function saveOfficialMatch() {
    if (!draftGpsDate || !opponent.trim() || !matchday.trim()) {
      setSaveError("GPS date, opponent, and matchday are required.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    const res = await setPlannerWeekOfficialMatchAction({
      weekId: week.id,
      gpsDate: draftGpsDate,
      opponent: opponent.trim(),
      matchday: matchday.trim(),
      competition: competition.trim() || null,
    });
    setSaving(false);
    if (!res.ok) {
      setSaveError(plannerErrorMessage(res.error.code, res.error.message));
      return;
    }
    setChanging(false);
    await loadWeekData();
  }

  async function clearOfficialMatch() {
    setConfirmBusy(true);
    setSaveError(null);
    const res = await deletePlannerWeekOfficialMatchAction(week.id);
    setConfirmBusy(false);
    if (!res.ok) {
      setSaveError(plannerErrorMessage(res.error.code, res.error.message));
      return;
    }
    setConfirmClear(false);
    setDraftGpsDate("");
    setOpponent("");
    setMatchday("");
    setCompetition("");
    setChanging(true);
    await loadWeekData();
  }

  const official = result?.officialMatch;
  const matchSelected = official?.selected === true;
  const showTotals = matchSelected && !loading && result != null;
  const emptyTargets = result != null && result.rows.length === 0;
  const matchUnavailable =
    showTotals &&
    result.rows.some((row) => row.match.quality === "match_query_error");
  const canSave =
    draftGpsDate.length > 0 &&
    opponent.trim().length > 0 &&
    matchday.trim().length > 0 &&
    !saving;

  return (
    <div className="no-print space-y-4">
      {loading ? (
        <p className="text-sm text-zinc-400">Loading Total Load…</p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-200">
          {error}
        </p>
      ) : null}

      {!loading && matchSelected && official ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-xl font-semibold text-zinc-50">
                {week.powerbiWeekId}
              </p>
              <p className="text-sm text-zinc-300">
                Training: {formatCompactDateRange(week.startDate, week.endDate)}
              </p>
              <p className="text-sm text-zinc-300">
                Match: {formatCompactIsoDate(official.gpsDate ?? "")}
              </p>
              <p className="pt-1 text-base font-medium text-zinc-100">
                {official.opponent}
              </p>
              <p className="text-sm text-zinc-400">
                {official.matchday}
                {official.competition ? ` · ${official.competition}` : ""}
              </p>
              {result ? (
                <p className="pt-2 text-sm text-zinc-200">
                  <span className="font-medium text-zinc-400">Weekly Plan</span>
                  {"  "}
                  {formatWeeklyPlanSummaryLine(result.weeklyPlanSummary)}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setChanging(true);
                  setSaveError(null);
                }}
                className="min-h-[44px] rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                Change match
              </button>
              <button
                type="button"
                onClick={() => {
                  setSaveError(null);
                  setConfirmClear(true);
                }}
                className="min-h-[44px] rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                Clear match
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && !matchSelected ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-4">
          <p className="text-base font-medium text-zinc-100">
            Select the official match to calculate Total Load.
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            The match date is chosen by Admin. It does not have to fall inside
            the Training date range.
          </p>
        </div>
      ) : null}

      {!loading && changing ? (
        <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
          <p className="text-sm font-medium text-zinc-200">Official match</p>
          {candidateError ? (
            <p className="text-sm text-zinc-400">{candidateError}</p>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-zinc-400">
              No Team match GPS dates found for this Power BI week.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {candidates.map((c) => {
                const selected = draftGpsDate === c.gpsDate;
                return (
                  <button
                    key={c.gpsDate}
                    type="button"
                    onClick={() => selectCandidate(c.gpsDate)}
                    className={`min-h-[44px] rounded-lg border px-3 py-2 text-sm ${
                      selected
                        ? "border-zinc-200 bg-zinc-100 text-zinc-900"
                        : "border-zinc-700 bg-zinc-950 text-zinc-200 hover:bg-zinc-800"
                    }`}
                  >
                    <span className="font-medium">
                      {formatCompactIsoDate(c.gpsDate)}
                    </span>
                    <span className="ml-2 text-xs opacity-80">
                      {c.distinctPlayerCount} players · {c.rawRowCount} rows
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-zinc-400">Opponent</span>
              <input
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-zinc-400">Matchday</span>
              <input
                value={matchday}
                onChange={(e) => setMatchday(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-zinc-400">
                Competition
              </span>
              <input
                value={competition}
                onChange={(e) => setCompetition(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
              />
            </label>
          </div>
          {draftGpsDate ? (
            <p className="text-sm text-zinc-400">
              GPS date: {formatCompactIsoDate(draftGpsDate)}
            </p>
          ) : (
            <p className="text-sm text-zinc-500">Choose a GPS match date.</p>
          )}
          {saveError ? (
            <p className="text-sm text-zinc-300">{saveError}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void saveOfficialMatch()}
              disabled={!canSave}
              className="min-h-[44px] rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save official match"}
            </button>
            {matchSelected ? (
              <button
                type="button"
                onClick={() => {
                  setChanging(false);
                  setSaveError(null);
                  setDraftGpsDate(official?.gpsDate ?? "");
                  setOpponent(official?.opponent ?? "");
                  setMatchday(official?.matchday ?? "");
                  setCompetition(official?.competition ?? "");
                }}
                disabled={saving}
                className="min-h-[44px] rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {saveError && !changing && !confirmClear ? (
        <p className="text-sm text-zinc-200">{saveError}</p>
      ) : null}

      {matchUnavailable ? (
        <p className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-200">
          Match GPS is unavailable for this week.
        </p>
      ) : null}

      {!loading && emptyTargets ? (
        <p className="text-sm text-zinc-400">
          No Weekly Targets saved for this week.
        </p>
      ) : null}

      {showTotals && !emptyTargets ? (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {TOP_CARDS.map((card) => (
              <TopValueCard
                key={card.key}
                title={card.title}
                value={result.topValues[card.key]}
              />
            ))}
          </div>

          <div className="overflow-x-auto rounded-lg border border-zinc-800">
            <table className="min-w-[920px] w-full border-collapse text-[15px]">
              <thead>
                <tr className="bg-zinc-950 text-xs uppercase tracking-wide text-zinc-300">
                  <th className="sticky left-0 z-10 bg-zinc-950 px-3 py-3 text-left font-medium">
                    Player
                  </th>
                  <th className="px-3 py-3 text-center font-medium">
                    Match Time
                  </th>
                  {METRICS.map((m) => (
                    <Fragment key={m.key}>
                      <th className="border-l border-zinc-800 px-3 py-3 text-center font-medium">
                        {m.label} Total
                      </th>
                      <th className="px-3 py-3 text-center font-medium">
                        {m.label} %
                      </th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => {
                  const name = row.playerDisplayName;
                  const unsafe = row.quality === "unsafe";
                  return (
                    <tr
                      key={row.playerId}
                      className="border-t border-zinc-800 text-zinc-100"
                    >
                      <td className="sticky left-0 z-10 bg-zinc-900 px-3 py-2.5">
                        <PlayerCell
                          name={name}
                          avatarUrl={avatarById.get(row.playerId) ?? null}
                          quality={row}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums">
                        {formatMatchDurationSeconds(row.match.durationSeconds)}
                      </td>
                      {METRICS.map((m) => {
                        const total = unsafe
                          ? null
                          : totalLoadCellValue(row, m.field);
                        const pct = unsafe
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
                              className="border-l border-zinc-800 px-3 py-2.5 text-center tabular-nums"
                            >
                              {formatPlannerDisplayAbsoluteOrDash(total)}
                            </td>
                            <td
                              title={title}
                              className="px-3 py-2.5 text-center tabular-nums"
                            >
                              {formatTotalLoadPercent(pct)}
                            </td>
                          </Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <ConfirmDialog
        open={confirmClear}
        title="Clear official match?"
        body="This removes the official match for this planner week. Total Load will be unavailable until a match is selected again."
        error={saveError}
        confirmLabel="Clear match"
        busy={confirmBusy}
        onCancel={() => {
          if (!confirmBusy) {
            setConfirmClear(false);
            setSaveError(null);
          }
        }}
        onConfirm={() => {
          void clearOfficialMatch();
        }}
      />
    </div>
  );
}
