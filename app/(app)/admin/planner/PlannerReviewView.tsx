"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Card } from "@/components/Card";
import type { AbsoluteMetrics } from "@/lib/gpsPlanner/calculations";
import {
  DAILY_COMPLIANCE_LEGEND,
  WEEKLY_COMPLIANCE_LEGEND,
  dailyComplianceTone,
  reviewComplianceToneClass,
  weeklyComplianceTone,
  type ReviewComplianceMetric,
  type ReviewComplianceTone,
} from "@/lib/gpsPlanner/reviewCompliance";
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
  getPlannerDailyReviewAnalysisAction,
  getPlannerWeeklyReviewProgressAction,
  listPlannerWeekDaysAction,
  listPlannerWeeklyTargetsAction,
  listPlannerWeeksAction,
} from "@/app/actions/gpsPlanner";
import type {
  PlannerDailyAnalysisResult,
  PlannerUiPlayer,
  PlannerWeekDayRow,
  PlannerWeekRow,
  PlannerWeeklyProgressResult,
  PlannerWeeklyTargetView,
} from "@/lib/gpsPlanner/types";
import { PlannerTotalLoadView } from "./PlannerTotalLoadView";

export type ReviewTab = "weekly" | "daily" | "total_load";

type MetricKey = ReviewComplianceMetric;

const METRICS: {
  key: MetricKey;
  label: string;
  field: keyof AbsoluteMetrics;
  bestField: "tdBest" | "hsrBest" | "sprintBest" | "accBest" | "decBest";
  pctField: "tdPct" | "hsrPct" | "sprintPct" | "accPct" | "decPct";
}[] = [
  {
    key: "td",
    label: "Total Distance",
    field: "totalDistance",
    bestField: "tdBest",
    pctField: "tdPct",
  },
  {
    key: "hsr",
    label: "HSR Distance",
    field: "hsr",
    bestField: "hsrBest",
    pctField: "hsrPct",
  },
  {
    key: "sprint",
    label: "Sprint Distance",
    field: "sprint",
    bestField: "sprintBest",
    pctField: "sprintPct",
  },
  {
    key: "acc",
    label: "Accelerations",
    field: "accelerations",
    bestField: "accBest",
    pctField: "accPct",
  },
  {
    key: "dec",
    label: "Decelerations",
    field: "decelerations",
    bestField: "decBest",
    pctField: "decPct",
  },
];

type Props = {
  initialWeeks: PlannerWeekRow[];
  players: PlannerUiPlayer[];
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

/** Presentation labels only — values stay Planned − Actual. */
const WEEKLY_SUB_COLS = ["Actual", "Planned", "To Target"] as const;
const DAILY_SUB_COLS = ["Actual", "Planned", "Difference"] as const;

function MetricValues({
  planned,
  actual,
  delta,
  tone,
}: {
  planned: number | null;
  actual: number | null;
  delta: number | null;
  tone: ReviewComplianceTone | null;
}) {
  return (
    <>
      <td className="border-l border-zinc-200/80 px-2 py-2 text-center tabular-nums text-sm font-normal text-zinc-700">
        {formatPlannerDisplayAbsoluteOrDash(actual)}
      </td>
      <td className="border-l border-zinc-100 px-2 py-2 text-center tabular-nums text-sm font-normal text-zinc-700">
        {formatPlannerDisplayAbsoluteOrDash(planned)}
      </td>
      <td
        className={`border-l border-zinc-100 px-2 py-2 text-center tabular-nums text-sm font-normal ${reviewComplianceToneClass(tone)}`}
      >
        {formatPlannerDisplaySignedAbsolute(delta)}
      </td>
    </>
  );
}

function ReviewComplianceLegend({
  title,
  items,
  thresholds,
  footnote,
}: {
  title: string;
  items: { tone: ReviewComplianceTone; label: string }[];
  thresholds?: string[];
  footnote: string;
}) {
  const swatch = (tone: ReviewComplianceTone) => {
    switch (tone) {
      case "green":
        return "bg-emerald-500";
      case "orange":
        return "bg-amber-500";
      case "red":
        return "bg-red-500";
    }
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-3 no-print">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
        {title}
      </p>
      <ul className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1.5">
        {items.map((item) => (
          <li
            key={item.tone}
            className="flex items-center gap-2 text-xs text-zinc-400"
          >
            <span
              className={`inline-block size-2.5 shrink-0 rounded-full ${swatch(item.tone)}`}
              aria-hidden
            />
            <span>
              <span className="font-medium capitalize text-zinc-300">
                {item.tone}
              </span>
              {" — "}
              {item.label}
            </span>
          </li>
        ))}
      </ul>
      {thresholds && thresholds.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-[11px] text-zinc-500">
          {thresholds.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-[11px] text-zinc-500">{footnote}</p>
    </div>
  );
}

function ReviewTableHead({
  subCols,
}: {
  subCols: readonly [string, string, string];
}) {
  return (
    <thead>
      <tr className="bg-[#4a1820] text-xs uppercase tracking-wide text-white">
        <th className="sticky left-0 z-10 bg-[#4a1820] px-3 py-2.5 font-medium">
          Player
        </th>
        {METRICS.map((m) => (
          <th
            key={m.key}
            colSpan={3}
            className="border-l border-white/15 px-2 py-2.5 text-center font-medium"
          >
            {m.label}
          </th>
        ))}
        <th className="border-l border-white/15 px-3 py-2.5 font-medium">
          Quality
        </th>
      </tr>
      <tr className="border-b border-zinc-200 text-[10px] font-medium uppercase tracking-wide text-[#6b3a42] sm:text-[11px]">
        <th className="sticky left-0 z-10 border-r border-zinc-200/80 bg-white px-3 py-1.5" />
        {METRICS.map((m) =>
          subCols.map((label, i) => (
            <th
              key={`${m.key}-${label}`}
              className={`bg-[#f3e9eb] px-2 py-1.5 text-center ${
                i === 0
                  ? "border-l border-zinc-200/80"
                  : "border-l border-zinc-200/60"
              }`}
            >
              {label}
            </th>
          ))
        )}
        <th className="border-l border-zinc-200/80 bg-[#f3e9eb] px-3 py-1.5" />
      </tr>
    </thead>
  );
}

function ReviewPlayerCell({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";
  return (
    <div className="flex min-w-0 items-center gap-2">
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
      <span className="truncate font-medium text-zinc-900">{name}</span>
    </div>
  );
}

/**
 * Review: Weekly Planned/Actual/To Target and Daily Planned/Actual/Difference.
 * Navigation state is controlled by the shell so Planning ↔ Review preserves it.
 */
export function PlannerReviewView({
  initialWeeks,
  players,
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
    // Day-batched server path — one Power BI call per included week day.
    const res = await getPlannerWeeklyReviewProgressAction({
      weekId,
      throughDate,
    });
    if (!res.ok) {
      setError(plannerErrorMessage(res.error.code, res.error.message));
      setWeeklyRows([]);
    } else {
      setWeeklyRows(res.data);
    }
    setLoadingData(false);
  }, [weekId, throughDate, targets]);

  const loadDaily = useCallback(async () => {
    if (!dayId || targets.length === 0) {
      setDailyRows([]);
      return;
    }
    setLoadingData(true);
    setError(null);
    // Day-batched server path — one Power BI call for the selected week day.
    const res = await getPlannerDailyReviewAnalysisAction({
      weekDayId: dayId,
    });
    if (!res.ok) {
      setError(plannerErrorMessage(res.error.code, res.error.message));
      setDailyRows([]);
    } else {
      setDailyRows(res.data);
    }
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
    for (const p of players) {
      if (!m.has(p.id)) m.set(p.id, p.name);
    }
    return m;
  }, [targets, players]);

  const avatarById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const p of players) m.set(p.id, p.avatarUrl);
    return m;
  }, [players]);

  const throughMin = selectedWeek?.startDate ?? undefined;
  const throughMax = selectedWeek?.endDate ?? undefined;

  const weekPrintLabel = selectedWeek
    ? formatWeekOptionLabel(
        selectedWeek.powerbiWeekId,
        selectedWeek.startDate,
        selectedWeek.endDate
      )
    : "";

  const canPrintWeekly =
    tab === "weekly" &&
    !loadingMeta &&
    !loadingData &&
    !pending &&
    weeklyRows.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex rounded-lg border border-zinc-700 bg-zinc-950 p-1 no-print"
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
          <button
            type="button"
            role="tab"
            aria-selected={tab === "total_load"}
            onClick={() => onTabChange("total_load")}
            className={`min-h-[40px] rounded-md px-4 py-2 text-sm font-medium ${
              tab === "total_load"
                ? "bg-zinc-100 text-zinc-900"
                : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
            }`}
          >
            Total Load
          </button>
        </div>

        {canPrintWeekly ? (
          <button
            type="button"
            onClick={() => window.print()}
            className="no-print inline-flex min-h-[44px] items-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Print
          </button>
        ) : null}
      </div>

      <Card className="space-y-4 border-zinc-800 bg-zinc-900/60 p-4 sm:p-5 review-print-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end no-print">
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

          {tab === "weekly" || tab === "daily" ? (
            <p className="text-[11px] text-zinc-500 no-print">
              Each metric shows Actual, Planned, and{" "}
              {tab === "weekly" ? "To Target" : "Difference"} side by side (Planned
              − Actual). Missing Actual is not zero.
            </p>
          ) : null}

        {error && tab !== "total_load" ? (
          <p className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-200 no-print">
            {error}
          </p>
        ) : null}

        {tab === "total_load" ? (
          !weekId || !selectedWeek ? null : (
            <PlannerTotalLoadView
              key={selectedWeek.id}
              week={selectedWeek}
              players={players}
            />
          )
        ) : loadingMeta || loadingData || pending ? (
          <p className="text-sm text-zinc-400 no-print">Loading review…</p>
        ) : !weekId || weeks.length === 0 ? null : targets.length === 0 ? (
          <p className="text-sm text-zinc-400 no-print">
            No Weekly Targets saved for this week.
          </p>
        ) : tab === "weekly" ? (
          <WeeklyReviewTable
            rows={weeklyRows}
            nameById={nameById}
            avatarById={avatarById}
            throughDate={throughDate}
            weekLabel={weekPrintLabel}
          />
        ) : (
          <DailyReviewTable
            rows={dailyRows}
            nameById={nameById}
            avatarById={avatarById}
            dayLabel={selectedDay ? formatDayOption(selectedDay) : ""}
          />
        )}
      </Card>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }

          html,
          body {
            background: #fff !important;
            color: #111 !important;
          }

          body * {
            visibility: hidden !important;
          }

          .review-print-root,
          .review-print-root * {
            visibility: visible !important;
          }

          .no-print {
            display: none !important;
            visibility: hidden !important;
          }

          .review-print-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: #fff !important;
            color: #111 !important;
            padding: 0;
          }

          .review-print-title {
            display: block !important;
            margin: 0 0 8px;
            text-align: center;
            font-size: 16px;
            font-weight: 700;
            color: #4a1820 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .review-print-meta {
            display: block !important;
            margin: 0 0 10px;
            text-align: center;
            font-size: 10px;
            color: #52525b !important;
          }

          .review-print-table-wrap {
            overflow: visible !important;
            border: 1px solid #e4e4e7 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          .review-print-table {
            min-width: 0 !important;
            width: 100% !important;
            font-size: 8px !important;
          }

          .review-print-table th,
          .review-print-table td {
            position: static !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .review-print-table thead tr:first-child th {
            background: #4a1820 !important;
            color: #fff !important;
          }

          .review-print-table thead tr:nth-child(2) th {
            background: #f3e9eb !important;
            color: #6b3a42 !important;
          }

          .review-print-table thead tr:nth-child(2) th:first-child {
            background: #fff !important;
          }

          .review-print-table .review-tone-green {
            background: #e2f8ec !important;
            color: #3f3f46 !important;
          }

          .review-print-table .review-tone-orange {
            background: #fef6d5 !important;
            color: #3f3f46 !important;
          }

          .review-print-table .review-tone-red {
            background: #fde8e8 !important;
            color: #3f3f46 !important;
          }
        }

        .review-print-title,
        .review-print-meta {
          display: none;
        }
      `}</style>
    </div>
  );
}

function WeeklyReviewTable({
  rows,
  nameById,
  avatarById,
  throughDate,
  weekLabel,
}: {
  rows: (PlannerWeeklyProgressResult | { playerId: string; error: string })[];
  nameById: Map<string, string>;
  avatarById: Map<string, string | null>;
  throughDate: string;
  weekLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-400 no-print">No weekly review rows.</p>;
  }
  const metricColSpan = METRICS.length * 3;
  return (
    <div className="review-print-root space-y-2">
      <h2 className="review-print-title">Weekly Review</h2>
      <p className="review-print-meta">
        {weekLabel}
        {throughDate ? ` · Through ${throughDate}` : ""}
      </p>
      <p className="text-xs text-zinc-500 no-print">Through {throughDate}</p>
      <div className="review-print-table-wrap overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="review-print-table min-w-[1100px] w-full border-collapse text-left text-sm">
          <ReviewTableHead subCols={WEEKLY_SUB_COLS} />
          <tbody>
            {rows.map((row, index) => {
              const stripe = index % 2 === 0 ? "bg-white" : "bg-zinc-50";
              if ("error" in row) {
                return (
                  <tr
                    key={row.playerId}
                    className={`border-b border-zinc-300 ${stripe}`}
                  >
                    <td className={`sticky left-0 z-10 px-3 py-2 ${stripe}`}>
                      <ReviewPlayerCell
                        name={nameById.get(row.playerId) ?? row.playerId}
                        avatarUrl={avatarById.get(row.playerId) ?? null}
                      />
                    </td>
                    <td
                      colSpan={metricColSpan + 1}
                      className="px-3 py-2 text-amber-700"
                    >
                      {row.error}
                    </td>
                  </tr>
                );
              }
              return (
                <tr
                  key={row.playerId}
                  className={`border-b border-zinc-300 ${stripe}`}
                >
                  <td className={`sticky left-0 z-10 px-3 py-2 ${stripe}`}>
                    <ReviewPlayerCell
                      name={row.playerDisplayName}
                      avatarUrl={avatarById.get(row.playerId) ?? null}
                    />
                  </td>
                  {METRICS.map((m) => (
                    <MetricValues
                      key={m.key}
                      planned={row.weeklyPlanned[m.field]}
                      actual={row.weeklyActual?.[m.field] ?? null}
                      delta={row.weeklyToTarget?.[m.field] ?? null}
                      tone={weeklyComplianceTone({
                        metric: m.key,
                        actual: row.weeklyActual?.[m.field] ?? null,
                        matchBest: row.frozen[m.bestField],
                        weeklyTargetPct: row.weeklyPct[m.pctField],
                        actualCompleteness: row.actualCompleteness,
                      })}
                    />
                  ))}
                  <td className="border-l border-zinc-100 px-3 py-2 text-xs text-zinc-500">
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
      <ReviewComplianceLegend
        title={WEEKLY_COMPLIANCE_LEGEND.title}
        items={WEEKLY_COMPLIANCE_LEGEND.items}
        footnote={WEEKLY_COMPLIANCE_LEGEND.footnote}
      />
    </div>
  );
}

function DailyReviewTable({
  rows,
  nameById,
  avatarById,
  dayLabel,
}: {
  rows: (PlannerDailyAnalysisResult | { playerId: string; error: string })[];
  nameById: Map<string, string>;
  avatarById: Map<string, string | null>;
  dayLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-400">No daily review rows.</p>;
  }
  const metricColSpan = METRICS.length * 3;
  return (
    <div className="space-y-2">
      {dayLabel ? (
        <p className="text-xs text-zinc-500">{dayLabel}</p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
          <ReviewTableHead subCols={DAILY_SUB_COLS} />
          <tbody>
            {rows.map((row, index) => {
              const stripe = index % 2 === 0 ? "bg-white" : "bg-zinc-50";
              if ("error" in row) {
                return (
                  <tr
                    key={row.playerId}
                    className={`border-b border-zinc-300 ${stripe}`}
                  >
                    <td className={`sticky left-0 z-10 px-3 py-2 ${stripe}`}>
                      <ReviewPlayerCell
                        name={nameById.get(row.playerId) ?? row.playerId}
                        avatarUrl={avatarById.get(row.playerId) ?? null}
                      />
                    </td>
                    <td
                      colSpan={metricColSpan + 1}
                      className="px-3 py-2 text-amber-700"
                    >
                      {row.error}
                    </td>
                  </tr>
                );
              }
              return (
                <tr
                  key={row.playerId}
                  className={`border-b border-zinc-300 ${stripe}`}
                >
                  <td className={`sticky left-0 z-10 px-3 py-2 ${stripe}`}>
                    <ReviewPlayerCell
                      name={row.playerDisplayName}
                      avatarUrl={avatarById.get(row.playerId) ?? null}
                    />
                  </td>
                  {METRICS.map((m) => (
                    <MetricValues
                      key={m.key}
                      planned={row.planned?.[m.field] ?? null}
                      actual={row.actual?.[m.field] ?? null}
                      delta={row.difference?.[m.field] ?? null}
                      tone={dailyComplianceTone({
                        metric: m.key,
                        difference: row.difference?.[m.field] ?? null,
                      })}
                    />
                  ))}
                  <td className="border-l border-zinc-100 px-3 py-2 text-xs text-zinc-500">
                    {formatDailyReviewActualQuality(row.actualStatus)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ReviewComplianceLegend
        title={DAILY_COMPLIANCE_LEGEND.title}
        items={DAILY_COMPLIANCE_LEGEND.items}
        thresholds={DAILY_COMPLIANCE_LEGEND.thresholds}
        footnote={DAILY_COMPLIANCE_LEGEND.footnote}
      />
    </div>
  );
}
