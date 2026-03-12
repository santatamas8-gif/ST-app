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
import type { LucideIcon } from "lucide-react";
import { Clock, Moon, BatteryLow, Activity, Brain, Smile, HeartPulse, Dumbbell } from "lucide-react";
import type { WellnessRow } from "@/lib/types";
import { getDateContextLabel } from "@/lib/dateContext";
import { wellnessAverageFromRow, averageWellness } from "@/utils/wellness";
import { formatSleepDuration } from "@/utils/sleep";
import { useTheme } from "@/components/ThemeProvider";
import { NEON_CARD_STYLE, MATT_CARD_STYLE } from "@/lib/themes";

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
  | "wellness"
  | "load";

const METRICS: { key: MetricKey; label: string; max?: number; Icon: LucideIcon }[] = [
  { key: "sleep_duration", label: "Sleep (h)", Icon: Clock },
  { key: "sleep_quality", label: "Sleep quality", max: 10, Icon: Moon },
  { key: "fatigue", label: "Fatigue", max: 10, Icon: BatteryLow },
  { key: "soreness", label: "Soreness", max: 10, Icon: Activity },
  { key: "stress", label: "Stress", max: 10, Icon: Brain },
  { key: "mood", label: "Mood", max: 10, Icon: Smile },
  { key: "wellness", label: "Wellness score", max: 10, Icon: HeartPulse },
  { key: "load", label: "Load", Icon: Dumbbell },
];

/** Bar colors: 1–4 red, 5–7 yellow, 8+ green. Wellness etc. are 1–10, higher = better. Load = intensity (1–10) × duration, so result is not 1–10 → no color bands. Sleep (h) uses hour bands. */
function getBarColor(key: MetricKey, value: number | string): string {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return BAR_GREEN;
  // Sleep duration (hours): 8+ green, 5–7 yellow, below 5 red
  if (key === "sleep_duration") {
    if (n >= 8) return BAR_GREEN;
    if (n >= 5) return BAR_YELLOW;
    return BAR_RED;
  }
  // Load = (1–10 intensity) × duration → value can be large; no good/bad bands, use single color
  if (key === "load") return BAR_GREEN;
  // 1–10 scale, higher = better (sleep_quality, fatigue, soreness, stress, mood, wellness): 1–4 red, 5–7 yellow, 8+ green
  if (n >= 8) return BAR_GREEN;
  if (n >= 5) return BAR_YELLOW;
  return BAR_RED;
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

function formatTooltipValue(key: MetricKey, value: number | string): string {
  const n = typeof value === "number" ? value : Number(value);
  return key === "sleep_duration" ? `${formatSleepDuration(n)}h` : String(value);
}

interface PlayerWellnessTrendProps {
  wellness: WellnessRow[];
  dates: string[];
  loadByDate: Record<string, number>;
}

export function PlayerWellnessTrend({ wellness, dates, loadByDate: loadByDateRecord }: PlayerWellnessTrendProps) {
  const { themeId } = useTheme();
  const isNeon = themeId === "neon";
  const isMatt = themeId === "matt";
  const cardStyle =
    isNeon ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS } as React.CSSProperties
    : isMatt ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS } as React.CSSProperties
    : { backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS, borderColor: "var(--card-border)" };
  const cardBorderClass = isNeon || isMatt ? "border border-transparent" : "border";
  const cardTextClass = isNeon ? "neon-card-text" : isMatt ? "matt-card-text" : "";
  const tickFill = "var(--foreground)";

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
  const last14Dates = useMemo(() => dates.slice(0, 14), [dates]);
  const last28Dates = useMemo(() => dates.slice(0, 28), [dates]);
  const last7Rows = useMemo(
    () => last7Dates.map((d) => wellnessByDate.get(d)).filter(Boolean) as WellnessRow[],
    [last7Dates, wellnessByDate]
  );
  const last14Rows = useMemo(
    () => last14Dates.map((d) => wellnessByDate.get(d)).filter(Boolean) as WellnessRow[],
    [last14Dates, wellnessByDate]
  );
  const last28Rows = useMemo(
    () => last28Dates.map((d) => wellnessByDate.get(d)).filter(Boolean) as WellnessRow[],
    [last28Dates, wellnessByDate]
  );

  const [selectedPeriod, setSelectedPeriod] = useState<"7" | "14" | "28">("7");
  const isHighContrast = isNeon || isMatt;

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
          wellness: wellnessScore,
          load: load != null && load > 0 ? load : null,
        };
      }),
    [sortedDatesAsc, wellnessByDate, loadByDate]
  );

  const chartDataByPeriod = useMemo(
    () =>
      selectedPeriod === "7"
        ? chartData.slice(-7)
        : selectedPeriod === "14"
          ? chartData.slice(-14)
          : chartData,
    [chartData, selectedPeriod]
  );

  return (
    <div className="space-y-8">
      {/* Top: select 7 / 14 / 28 – segmented control same style as RPE */}
      <div className={`rounded-xl border p-3 md:p-4 ${cardBorderClass} ${cardTextClass}`} style={cardStyle}>
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="flex justify-center w-full sm:w-auto">
            <div
              className="inline-flex rounded-[14px] border p-0.5 h-10"
              style={{
                backgroundColor: isHighContrast ? "rgba(255,255,255,0.06)" : "rgba(15,23,32,0.9)",
                borderColor: isHighContrast ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.08)",
              }}
            >
              {([7, 14, 28] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSelectedPeriod(String(n) as "7" | "14" | "28")}
                  className={`min-w-[72px] flex-1 rounded-[10px] text-sm font-medium transition-all duration-200 ${
                    selectedPeriod === String(n)
                      ? "bg-emerald-700/90 text-white"
                      : "bg-transparent text-gray-400 hover:text-gray-300 hover:bg-white/5 active:bg-white/10"
                  }`}
                >
                  {n} days
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Per-metric: 7/28 avg + bar chart; mobile: 1 col, sm+: 2 cols */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6">
      {METRICS.map(({ key, label, max = 10, Icon }) => {
        const values7 = last7Dates.map((d) =>
          getMetricValue(wellnessByDate.get(d), key, loadByDate, d)
        );
        const values14 = last14Dates.map((d) =>
          getMetricValue(wellnessByDate.get(d), key, loadByDate, d)
        );
        const values28 = last28Dates.map((d) =>
          getMetricValue(wellnessByDate.get(d), key, loadByDate, d)
        );
        const avg7 = key === "wellness" ? averageWellness(last7Rows) : avg(values7);
        const avg14 = key === "wellness" ? averageWellness(last14Rows) : avg(values14);
        const avg28 = key === "wellness" ? averageWellness(last28Rows) : avg(values28);
        const dataKey = key as keyof (typeof chartData)[0];
        const periodAvg = selectedPeriod === "7" ? avg7 : selectedPeriod === "14" ? avg14 : avg28;
        const hasAny = chartDataByPeriod.some((r) => r[dataKey] != null);
        const is7Day = selectedPeriod === "7";
        const is14Day = selectedPeriod === "14";
        const barSize = is7Day ? 48 : is14Day ? 32 : 24;
        const tickFontSize = is7Day ? 15 : is14Day ? 13 : 12;
        const yAxisWidth = is7Day ? 40 : is14Day ? 36 : 32;
        const tickStyle = { fontSize: tickFontSize, fontWeight: 600, fill: tickFill };

        return (
          <div
            key={key}
            className={`min-w-0 rounded-xl border p-3 md:p-4 ${cardBorderClass} ${cardTextClass}`}
            style={cardStyle}
          >
            <div className="mb-2">
              <h4 className="flex items-center gap-2.5 font-medium" style={{ color: "var(--foreground)" }}>
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/10"
                  style={{ backgroundColor: "var(--card-border)", color: "var(--foreground)" }}
                  aria-hidden
                >
                  <Icon className="h-6 w-6" strokeWidth={2} />
                </span>
                {label}
              </h4>
            </div>
            <div className={`w-full min-w-0 ${is7Day ? "h-40" : is14Day ? "h-36" : "h-32"}`}>
              {hasAny ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartDataByPeriod}
                    margin={{ top: 2, right: 88, left: is7Day ? -4 : is14Day ? -6 : -8, bottom: 8 }}
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
                            className="rounded-lg border px-3 py-2 text-sm shadow-lg"
                            style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--foreground)" }}
                          >
                            <p className="font-medium opacity-80">Date: {fullDate}{getDateContextLabel(fullDate)}</p>
                            <p className="mt-1 font-medium">{label}: {formatTooltipValue(key, value)}</p>
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
                        label={{
                          value: `${selectedPeriod === "7" ? "7d" : selectedPeriod === "14" ? "14d" : "28d"} avg ${key === "sleep_duration" ? `${formatSleepDuration(periodAvg)}h` : periodAvg.toFixed(1)}`,
                          position: "right",
                          fill: "var(--foreground)",
                          fontSize: 13,
                          fontWeight: 700,
                        }}
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
                <div className="flex h-full items-center justify-center text-sm opacity-60" style={{ color: "var(--foreground)" }}>
                  No data
                </div>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
