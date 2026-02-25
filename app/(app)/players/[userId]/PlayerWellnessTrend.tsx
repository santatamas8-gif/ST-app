"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import type { WellnessRow } from "@/lib/types";
import { wellnessAverageFromRow, averageWellness, averageSleepHours } from "@/utils/wellness";

const BG_CARD = "#11161c";
const CARD_RADIUS = "12px";

const BAR_GREEN = "#22c55e";
const BAR_YELLOW = "#eab308";
const BAR_RED = "#ef4444";

type MetricKey =
  | "sleep_duration"
  | "sleep_quality"
  | "fatigue"
  | "soreness"
  | "stress"
  | "mood"
  | "motivation"
  | "wellness"
  | "load";

const METRICS: { key: MetricKey; label: string; max?: number }[] = [
  { key: "sleep_duration", label: "Sleep (h)" },
  { key: "sleep_quality", label: "Sleep quality", max: 10 },
  { key: "fatigue", label: "Fatigue", max: 10 },
  { key: "soreness", label: "Soreness", max: 10 },
  { key: "stress", label: "Stress", max: 10 },
  { key: "mood", label: "Mood", max: 10 },
  { key: "motivation", label: "Motivation", max: 10 },
  { key: "wellness", label: "Wellness score", max: 10 },
  { key: "load", label: "Load" },
];

/** Returns green / yellow / red for bar color based on metric and value (higher is better for mood, quality, motivation, wellness, sleep_duration; lower is better for fatigue, soreness, stress). */
function getBarColor(key: MetricKey, value: number): string {
  if (key === "load") return BAR_GREEN;
  if (key === "sleep_duration") {
    if (value >= 8) return BAR_GREEN;
    if (value >= 6) return BAR_YELLOW;
    return BAR_RED;
  }
  const highGood = ["sleep_quality", "mood", "motivation", "wellness"].includes(key);
  if (highGood) {
    if (value >= 7) return BAR_GREEN;
    if (value >= 4) return BAR_YELLOW;
    return BAR_RED;
  }
  const lowGood = ["fatigue", "soreness", "stress"].includes(key);
  if (lowGood) {
    if (value <= 3) return BAR_GREEN;
    if (value <= 6) return BAR_YELLOW;
    return BAR_RED;
  }
  return BAR_GREEN;
}

function getMetricValue(row: WellnessRow | undefined, key: MetricKey, loadByDate: Map<string, number>, date: string): number | null {
  if (!row && key !== "load") return null;
  if (key === "load") return loadByDate.get(date) ?? null;
  if (key === "wellness") return row ? wellnessAverageFromRow(row) : null;
  const v = row ? (row[key] as number | null | undefined) : null;
  return v != null ? v : null;
}

function avg(values: (number | null)[]): number | null {
  const valid = values.filter((x): x is number => x != null && !Number.isNaN(x));
  if (valid.length === 0) return null;
  const sum = valid.reduce((a, b) => a + b, 0);
  return Math.round((sum / valid.length) * 100) / 100;
}

function formatTooltipValue(key: MetricKey, value: number): string {
  return key === "sleep_duration" ? `${value}h` : String(value);
}

interface PlayerWellnessTrendProps {
  wellness: WellnessRow[];
  dates: string[];
  loadByDate: Record<string, number>;
}

export function PlayerWellnessTrend({ wellness, dates, loadByDate: loadByDateRecord }: PlayerWellnessTrendProps) {
  const loadByDate = useMemo(
    () => new Map<string, number>(Object.entries(loadByDateRecord)),
    [loadByDateRecord]
  );
  const wellnessByDate = useMemo(() => {
    const m = new Map<string, WellnessRow>();
    wellness.forEach((r) => m.set(r.date, r));
    return m;
  }, [wellness]);

  const sortedDatesAsc = useMemo(() => [...dates].reverse(), [dates]);
  const last7Dates = useMemo(() => dates.slice(0, 7), [dates]);
  const last28Dates = useMemo(() => dates.slice(0, 28), [dates]);
  const last7Rows = useMemo(
    () => last7Dates.map((d) => wellnessByDate.get(d)).filter(Boolean) as WellnessRow[],
    [last7Dates, wellnessByDate]
  );
  const last28Rows = useMemo(
    () => last28Dates.map((d) => wellnessByDate.get(d)).filter(Boolean) as WellnessRow[],
    [last28Dates, wellnessByDate]
  );

  const summary7 = useMemo(() => ({
    wellness: averageWellness(last7Rows),
    sleep: averageSleepHours(last7Rows),
  }), [last7Rows]);
  const summary28 = useMemo(() => ({
    wellness: averageWellness(last28Rows),
    sleep: averageSleepHours(last28Rows),
  }), [last28Rows]);

  const [selectedPeriod, setSelectedPeriod] = useState<"7" | "28">("7");

  const chartData = useMemo(
    () =>
      sortedDatesAsc.map((date) => {
        const w = wellnessByDate.get(date);
        const wellnessScore = w ? wellnessAverageFromRow(w) : null;
        const load = loadByDate.get(date) ?? null;
        return {
          date: date.slice(5),
          fullDate: date,
          sleep_duration: w?.sleep_duration ?? null,
          sleep_quality: w?.sleep_quality ?? null,
          fatigue: w?.fatigue ?? null,
          soreness: w?.soreness ?? null,
          stress: w?.stress ?? null,
          mood: w?.mood ?? null,
          motivation: w?.motivation ?? null,
          wellness: wellnessScore,
          load: load != null && load > 0 ? load : null,
        };
      }),
    [sortedDatesAsc, wellnessByDate, loadByDate]
  );

  const chartDataByPeriod = useMemo(
    () => (selectedPeriod === "7" ? chartData.slice(-7) : chartData),
    [chartData, selectedPeriod]
  );

  return (
    <div className="space-y-8">
      {/* Top: select 7 or 28 – only that average is shown */}
      <div
        className="rounded-xl border border-zinc-700 p-4"
        style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
      >
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="flex gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setSelectedPeriod("7")}
              className={`rounded-lg px-5 py-3 text-base font-semibold transition-colors sm:px-6 sm:py-3.5 sm:text-lg ${
                selectedPeriod === "7"
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
              }`}
            >
              7-day average
            </button>
            <button
              type="button"
              onClick={() => setSelectedPeriod("28")}
              className={`rounded-lg px-5 py-3 text-base font-semibold transition-colors sm:px-6 sm:py-3.5 sm:text-lg ${
                selectedPeriod === "28"
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
              }`}
            >
              28-day average
            </button>
          </div>
          <p className="text-center text-sm text-white sm:text-base">
            {selectedPeriod === "7" ? (
              <>
                Wellness: <span className="font-semibold text-emerald-400">{summary7.wellness != null ? summary7.wellness.toFixed(1) : "—"}</span>
                {" · "}
                Sleep: <span className="font-semibold text-white">{summary7.sleep != null ? `${summary7.sleep.toFixed(1)}h` : "—"}</span>
              </>
            ) : (
              <>
                Wellness: <span className="font-semibold text-emerald-400">{summary28.wellness != null ? summary28.wellness.toFixed(1) : "—"}</span>
                {" · "}
                Sleep: <span className="font-semibold text-white">{summary28.sleep != null ? `${summary28.sleep.toFixed(1)}h` : "—"}</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Per-metric: 7/28 avg + bar chart (only selected period days; tooltip = date + value; faint avg line) */}
      {METRICS.map(({ key, label, max = 10 }) => {
        const values7 = last7Dates.map((d) =>
          getMetricValue(wellnessByDate.get(d), key, loadByDate, d)
        );
        const values28 = last28Dates.map((d) =>
          getMetricValue(wellnessByDate.get(d), key, loadByDate, d)
        );
        const avg7 = key === "wellness" ? averageWellness(last7Rows) : avg(values7);
        const avg28 = key === "wellness" ? averageWellness(last28Rows) : avg(values28);
        const dataKey = key as keyof (typeof chartData)[0];
        const periodAvg = selectedPeriod === "7" ? avg7 : avg28;
        const hasAny = chartDataByPeriod.some((r) => r[dataKey] != null);
        const is7Day = selectedPeriod === "7";
        const barSize = is7Day ? 48 : 24;
        const tickFontSize = is7Day ? 15 : 12;
        const yAxisWidth = is7Day ? 40 : 32;
        const tickStyle = { fontSize: tickFontSize, fontWeight: 600, fill: "#e4e4e7" };

        return (
          <div
            key={key}
            className="rounded-xl border border-zinc-700 p-4"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-medium text-white">{label}</h4>
              <p className="text-sm text-zinc-400">
                7d avg: <span className="font-medium text-zinc-300">{avg7 != null ? (key === "sleep_duration" ? `${avg7.toFixed(1)}h` : avg7.toFixed(1)) : "—"}</span>
                {" · "}
                28d avg: <span className="font-medium text-zinc-300">{avg28 != null ? (key === "sleep_duration" ? `${avg28.toFixed(1)}h` : avg28.toFixed(1)) : "—"}</span>
              </p>
            </div>
            <div className={`w-full min-w-0 ${is7Day ? "h-40" : "h-32"}`}>
              {hasAny ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartDataByPeriod}
                    margin={{ top: 4, right: 4, left: is7Day ? -4 : -8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis
                      dataKey="date"
                      stroke="#71717a"
                      tick={tickStyle}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      stroke="#71717a"
                      tick={tickStyle}
                      domain={key === "load" || key === "sleep_duration" ? [0, "auto"] : [0, max]}
                      width={yAxisWidth}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0].payload as (typeof chartDataByPeriod)[0];
                        const fullDate = row.fullDate;
                        const value = row[dataKey];
                        if (value == null) return null;
                        return (
                          <div
                            className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm shadow-lg"
                            style={{ borderColor: "#27272a", backgroundColor: BG_CARD }}
                          >
                            <p className="font-medium text-zinc-300">Date: {fullDate}</p>
                            <p className="mt-1 font-medium text-white">{label}: {formatTooltipValue(key, value)}</p>
                          </div>
                        );
                      }}
                    />
                    {periodAvg != null && (
                      <ReferenceLine
                        y={periodAvg}
                        stroke="#71717a"
                        strokeWidth={1}
                        strokeDasharray="4 4"
                        strokeOpacity={0.7}
                      />
                    )}
                    <Bar dataKey={dataKey} radius={[2, 2, 0, 0]} maxBarSize={barSize}>
                      {chartDataByPeriod.map((entry, i) => {
                        const val = entry[dataKey];
                        const fill = val != null ? getBarColor(key, val) : "transparent";
                        return (
                          <Cell
                            key={i}
                            fill={fill}
                            stroke={val != null ? undefined : "#27272a"}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                  No data
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
