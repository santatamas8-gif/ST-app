"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Card } from "@/components/Card";
import type { AbsoluteMetrics } from "@/lib/gpsPlanner/calculations";
import {
  formatDailyReviewActualQuality,
  formatPlannerDisplayAbsoluteOrDash,
  formatPlannerDisplaySignedAbsolute,
  formatWeekOptionLabel,
  formatWeeklyReviewActualQuality,
  plannerErrorMessage,
  resolveReviewDayIdForWeekDays,
  resolveReviewThroughDateForWeek,
} from "@/lib/gpsPlanner/uiDisplay";
import {
  getPlannerDailyAnalysisAction,
  getPlannerWeeklyProgressAction,
  listPlannerWeekDaysAction,
  listPlannerWeeklyTargetsAction,
  listPlannerWeeksAction,
} from "@/app/actions/gpsPlanner";
import type {
  PlannerDailyAnalysisResult,
  PlannerWeekDayRow,
  PlannerWeekRow,
  PlannerWeeklyProgressResult,
  PlannerWeeklyTargetView,
} from "@/lib/gpsPlanner/types";

export type ReviewTab = "weekly" | "daily";

type MetricKey = "td" | "hsr" | "sprint" | "acc" | "dec";

const METRICS: { key: MetricKey; label: string; field: keyof AbsoluteMetrics }[] =
  [
    { key: "td", label: "TD", field: "totalDistance" },
    { key: "hsr", label: "HSR", field: "hsr" },
    { key: "sprint", label: "Sprint", field: "sprint" },
    { key: "acc", label: "Acc", field: "accelerations" },
    { key: "dec", label: "Dec", field: "decelerations" },
  ];

type Props = {
  initialWeeks: PlannerWeekRow[];
  /** Controlled Review navigation — owned by GpsLoadPlannerView shell. */
  tab: ReviewTab;
  onTabChange: (tab: ReviewTab) => void;
  weekId: string;
  onWeekIdChange: (weekId: string) => void;
  throughDate: string;
  onThroughDateChange: (date: string) => void;
  dayId: string;
  onDayIdChange: (dayId: string) => void;
};

function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDayOption(day: PlannerWeekDayRow): string {
  return `${day.mdTag} · ${day.date}`;
}

function MetricTriple({
  planned,
  actual,
  delta,
  deltaLabel,
}: {
  planned: number | null;
  actual: number | null;
  delta: number | null;
  deltaLabel: "TT" | "D";
}) {
  return (
    <div className="space-y-0.5 tabular-nums text-[11px] leading-tight sm:text-xs">
      <div className="flex justify-between gap-2">
        <span className="text-zinc-500">P</span>
        <span className="font-semibold text-zinc-100">
          {formatPlannerDisplayAbsoluteOrDash(planned)}
        </span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-zinc-500">A</span>
        <span className="font-semibold text-zinc-100">
          {formatPlannerDisplayAbsoluteOrDash(actual)}
        </span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-zinc-500">{deltaLabel}</span>
        <span className="font-semibold text-zinc-50">
          {formatPlannerDisplaySignedAbsolute(delta)}
        </span>
      </div>
    </div>
  );
}

/**
 * Review: Weekly Planned/Actual/To Target and Daily Planned/Actual/Difference.
 * Navigation state is controlled by the shell so Planning ↔ Review preserves it.
 */
export function PlannerReviewView({
  initialWeeks,
  tab,
  onTabChange,
  weekId,
  onWeekIdChange,
  throughDate,
  onThroughDateChange,
  dayId,
  onDayIdChange,
}: Props) {
  const [weeks, setWeeks] = useState(initialWeeks);
  const selectedWeek = weeks.find((w) => w.id === weekId) ?? null;

  const [days, setDays] = useState<PlannerWeekDayRow[]>([]);
  const selectedDay = days.find((d) => d.id === dayId) ?? null;

  const [targets, setTargets] = useState<PlannerWeeklyTargetView[]>([]);

  const [weeklyRows, setWeeklyRows] = useState<
    (PlannerWeeklyProgressResult | { playerId: string; error: string })[]
  >([]);
  const [dailyRows, setDailyRows] = useState<
    (PlannerDailyAnalysisResult | { playerId: string; error: string })[]
  >([]);

  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(() => {
      void (async () => {
        const res = await listPlannerWeeksAction();
        if (res.ok) setWeeks(res.data);
      })();
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!weekId) {
        setDays([]);
        setTargets([]);
        onDayIdChange("");
        return;
      }
      setLoadingMeta(true);
      setError(null);
      try {
        const [daysRes, targetsRes] = await Promise.all([
          listPlannerWeekDaysAction(weekId),
          listPlannerWeeklyTargetsAction(weekId),
        ]);
        if (cancelled) return;
        if (!daysRes.ok) {
          setError(
            plannerErrorMessage(daysRes.error.code, daysRes.error.message)
          );
          setDays([]);
          onDayIdChange("");
        } else {
          setDays(daysRes.data);
          // Preserve day if still in this week; else default first day.
          onDayIdChange(
            resolveReviewDayIdForWeekDays(
              dayId,
              daysRes.data.map((d) => d.id)
            )
          );
        }
        if (!targetsRes.ok) {
          setError(
            plannerErrorMessage(targetsRes.error.code, targetsRes.error.message)
          );
          setTargets([]);
        } else {
          setTargets(targetsRes.data);
        }
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only reload meta when Review Week changes — not when day/tab/through change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekId]);

  const loadWeekly = useCallback(async () => {
    if (!weekId || !throughDate || targets.length === 0) {
      setWeeklyRows([]);
      return;
    }
    setLoadingData(true);
    setError(null);
    const rows: (PlannerWeeklyProgressResult | { playerId: string; error: string })[] =
      [];
    // Sequential — preserve existing Power BI request strategy (V1 known characteristic).
    for (const t of targets) {
      const res = await getPlannerWeeklyProgressAction({
        weekId,
        playerId: t.playerId,
        throughDate,
      });
      if (res.ok) rows.push(res.data);
      else {
        rows.push({
          playerId: t.playerId,
          error: plannerErrorMessage(res.error.code, res.error.message),
        });
      }
    }
    setWeeklyRows(rows);
    setLoadingData(false);
  }, [weekId, throughDate, targets]);

  const loadDaily = useCallback(async () => {
    if (!dayId || targets.length === 0) {
      setDailyRows([]);
      return;
    }
    setLoadingData(true);
    setError(null);
    const rows: (PlannerDailyAnalysisResult | { playerId: string; error: string })[] =
      [];
    for (const t of targets) {
      const res = await getPlannerDailyAnalysisAction({
        weekDayId: dayId,
        playerId: t.playerId,
      });
      if (res.ok) rows.push(res.data);
      else {
        rows.push({
          playerId: t.playerId,
          error: plannerErrorMessage(res.error.code, res.error.message),
        });
      }
    }
    setDailyRows(rows);
    setLoadingData(false);
  }, [dayId, targets]);

  useEffect(() => {
    if (tab === "weekly") void loadWeekly();
  }, [tab, loadWeekly]);

  useEffect(() => {
    if (tab === "daily") void loadDaily();
  }, [tab, loadDaily]);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of targets) m.set(t.playerId, t.playerDisplayName);
    return m;
  }, [targets]);

  const throughMin = selectedWeek?.startDate ?? undefined;
  const throughMax = selectedWeek?.endDate ?? undefined;

  return (
    <div className="space-y-4">
      <div
        className="inline-flex rounded-lg border border-zinc-700 bg-zinc-950 p-1"
        role="tablist"
        aria-label="Review period"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "weekly"}
          onClick={() => onTabChange("weekly")}
          className={`min-h-[40px] rounded-md px-4 py-2 text-sm font-medium ${
            tab === "weekly"
              ? "bg-zinc-100 text-zinc-900"
              : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
          }`}
        >
          Weekly
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "daily"}
          onClick={() => onTabChange("daily")}
          className={`min-h-[40px] rounded-md px-4 py-2 text-sm font-medium ${
            tab === "daily"
              ? "bg-zinc-100 text-zinc-900"
              : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
          }`}
        >
          Daily
        </button>
      </div>

      <Card className="space-y-4 border-zinc-800 bg-zinc-900/60 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="block min-w-[220px] flex-1 space-y-1">
            <span className="text-xs font-medium text-zinc-400">Week</span>
            {weeks.length === 0 ? (
              <p className="text-sm text-zinc-400">No planner week available.</p>
            ) : (
              <select
                value={weekId}
                onChange={(e) => {
                  const nextWeekId = e.target.value;
                  const nextWeek = weeks.find((w) => w.id === nextWeekId);
                  if (nextWeek) {
                    onThroughDateChange(
                      resolveReviewThroughDateForWeek({
                        previousWeekId: weekId,
                        nextWeekId,
                        previousThroughDate: throughDate,
                        nextWeekStart: nextWeek.startDate,
                        nextWeekEnd: nextWeek.endDate,
                        todayIso: todayIsoLocal(),
                      })
                    );
                  }
                  onWeekIdChange(nextWeekId);
                }}
                className="w-full min-h-[44px] rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
              >
                {weeks.map((w) => (
                  <option key={w.id} value={w.id}>
                    {formatWeekOptionLabel(
                      w.powerbiWeekId,
                      w.startDate,
                      w.endDate
                    )}
                    {w.status === "closed" ? " · Closed" : ""}
                  </option>
                ))}
              </select>
            )}
          </label>

          {tab === "weekly" && selectedWeek ? (
            <label className="block space-y-1">
              <span className="text-xs font-medium text-zinc-400">
                Through date
              </span>
              <input
                type="date"
                value={throughDate}
                min={throughMin}
                max={throughMax}
                onChange={(e) => onThroughDateChange(e.target.value)}
                className="min-h-[44px] rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
              />
            </label>
          ) : null}

          {tab === "daily" ? (
            <label className="block min-w-[180px] space-y-1">
              <span className="text-xs font-medium text-zinc-400">Week day</span>
              {days.length === 0 ? (
                <p className="text-sm text-zinc-400">No week days saved.</p>
              ) : (
                <select
                  value={dayId}
                  onChange={(e) => onDayIdChange(e.target.value)}
                  className="w-full min-h-[44px] rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
                >
                  {days.map((d) => (
                    <option key={d.id} value={d.id}>
                      {formatDayOption(d)}
                    </option>
                  ))}
                </select>
              )}
            </label>
          ) : null}
        </div>

        <p className="text-[11px] text-zinc-500">
          TD · HSR · Sprint · Acc · Dec — Planned − Actual (
          {tab === "weekly" ? "To Target" : "Difference"}). Missing Actual is not
          zero.
        </p>

        {error ? (
          <p className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
            {error}
          </p>
        ) : null}

        {loadingMeta || loadingData || pending ? (
          <p className="text-sm text-zinc-400">Loading review…</p>
        ) : !weekId || weeks.length === 0 ? null : targets.length === 0 ? (
          <p className="text-sm text-zinc-400">
            No Weekly Targets saved for this week.
          </p>
        ) : tab === "weekly" ? (
          <WeeklyReviewTable
            rows={weeklyRows}
            nameById={nameById}
            throughDate={throughDate}
          />
        ) : (
          <DailyReviewTable
            rows={dailyRows}
            nameById={nameById}
            dayLabel={selectedDay ? formatDayOption(selectedDay) : ""}
          />
        )}
      </Card>
    </div>
  );
}

function WeeklyReviewTable({
  rows,
  nameById,
  throughDate,
}: {
  rows: (PlannerWeeklyProgressResult | { playerId: string; error: string })[];
  nameById: Map<string, string>;
  throughDate: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-400">No weekly review rows.</p>;
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500">Through {throughDate}</p>
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="min-w-[720px] w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-950/80 text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-3 py-2 font-medium">Player</th>
              {METRICS.map((m) => (
                <th key={m.key} className="px-2 py-2 font-medium">
                  {m.label}
                </th>
              ))}
              <th className="px-3 py-2 font-medium">Quality</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if ("error" in row) {
                return (
                  <tr key={row.playerId} className="border-b border-zinc-800/80">
                    <td className="px-3 py-2 text-zinc-200">
                      {nameById.get(row.playerId) ?? row.playerId}
                    </td>
                    <td
                      colSpan={METRICS.length + 1}
                      className="px-3 py-2 text-amber-200"
                    >
                      {row.error}
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={row.playerId} className="border-b border-zinc-800/80">
                  <td className="px-3 py-2 font-medium text-zinc-100">
                    {row.playerDisplayName}
                  </td>
                  {METRICS.map((m) => (
                    <td key={m.key} className="px-2 py-2 align-top">
                      <MetricTriple
                        planned={row.weeklyPlanned[m.field]}
                        actual={row.weeklyActual?.[m.field] ?? null}
                        delta={row.weeklyToTarget?.[m.field] ?? null}
                        deltaLabel="TT"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-xs text-zinc-400">
                    {formatWeeklyReviewActualQuality({
                      actualCompleteness: row.actualCompleteness,
                      includedDays: row.includedDays,
                      foundDays: row.foundDays,
                      notFoundDays: row.notFoundDays,
                      problematicDays: row.problematicDays,
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DailyReviewTable({
  rows,
  nameById,
  dayLabel,
}: {
  rows: (PlannerDailyAnalysisResult | { playerId: string; error: string })[];
  nameById: Map<string, string>;
  dayLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-400">No daily review rows.</p>;
  }
  return (
    <div className="space-y-2">
      {dayLabel ? (
        <p className="text-xs text-zinc-500">{dayLabel}</p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="min-w-[720px] w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-950/80 text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-3 py-2 font-medium">Player</th>
              {METRICS.map((m) => (
                <th key={m.key} className="px-2 py-2 font-medium">
                  {m.label}
                </th>
              ))}
              <th className="px-3 py-2 font-medium">Quality</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if ("error" in row) {
                return (
                  <tr key={row.playerId} className="border-b border-zinc-800/80">
                    <td className="px-3 py-2 text-zinc-200">
                      {nameById.get(row.playerId) ?? row.playerId}
                    </td>
                    <td
                      colSpan={METRICS.length + 1}
                      className="px-3 py-2 text-amber-200"
                    >
                      {row.error}
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={row.playerId} className="border-b border-zinc-800/80">
                  <td className="px-3 py-2 font-medium text-zinc-100">
                    {row.playerDisplayName}
                  </td>
                  {METRICS.map((m) => (
                    <td key={m.key} className="px-2 py-2 align-top">
                      <MetricTriple
                        planned={row.planned?.[m.field] ?? null}
                        actual={row.actual?.[m.field] ?? null}
                        delta={row.difference?.[m.field] ?? null}
                        deltaLabel="D"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-xs text-zinc-400">
                    {formatDailyReviewActualQuality(row.actualStatus)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
