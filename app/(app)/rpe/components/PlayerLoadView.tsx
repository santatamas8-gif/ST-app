"use client";

import { useMemo, useState } from "react";
import type { SessionRow } from "@/lib/types";
import { LoadKpiCard } from "./LoadKpiCard";
import { TeamLoadBarChart } from "./LoadBarChart";
import { RpeForm } from "@/components/RpeForm";

const BG_PAGE = "#0b0f14";
const BG_CARD = "#11161c";
const CARD_RADIUS = "12px";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getLastNDates(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function getPrevNDates(n: number): string[] {
  const out: string[] = [];
  for (let i = n * 2 - 1; i >= n; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

interface PlayerLoadViewProps {
  list: SessionRow[];
  hasSubmittedToday: boolean;
}

export type PlayerPeriodDays = 7 | 14 | 28;

export function PlayerLoadView({ list, hasSubmittedToday }: PlayerLoadViewProps) {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [periodDays, setPeriodDays] = useState<PlayerPeriodDays>(7);

  const lastN = useMemo(() => getLastNDates(periodDays), [periodDays]);
  const prevN = useMemo(() => getPrevNDates(periodDays), [periodDays]);

  const { todayLoad, myLoadChartData, periodSum, trend } = useMemo(() => {
    const todayLoad = list
      .filter((s) => s.date === selectedDate)
      .reduce((a, s) => a + (s.load ?? 0), 0);
    const myLoadChartData = lastN.map((date) => ({
      date,
      load: list.filter((s) => s.date === date).reduce((a, s) => a + (s.load ?? 0), 0),
    }));
    const periodSum = myLoadChartData.reduce((a, d) => a + d.load, 0);
    const prevSum = list
      .filter((s) => prevN.includes(s.date))
      .reduce((a, s) => a + (s.load ?? 0), 0);
    const trend: "up" | "down" | "stable" =
      prevSum === 0 ? "stable" : periodSum > prevSum ? "up" : periodSum < prevSum ? "down" : "stable";
    return { todayLoad, myLoadChartData, periodSum, trend };
  }, [list, selectedDate, lastN, prevN]);

  return (
    <div
      className="min-h-screen px-4 py-8 sm:px-6 lg:px-8"
      style={{ backgroundColor: BG_PAGE }}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">RPE / Load</h1>
          <p className="mt-1 text-zinc-400">
            Your sessions and load. Log duration and RPE; load is calculated automatically.
          </p>
        </div>

        <RpeForm hasSubmittedToday={hasSubmittedToday} />

        {/* Date */}
        <div
          className="flex flex-wrap items-center gap-4 rounded-xl p-4"
          style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
        >
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            Date
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-9 rounded border border-zinc-700 bg-zinc-800/80 px-2 py-1 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </label>
          <button
            type="button"
            onClick={() => setSelectedDate(todayISO())}
            className="h-9 rounded border border-zinc-600 bg-zinc-800/80 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700/80"
          >
            Today
          </button>
        </div>

        {/* Overview – your load */}
        <section className="space-y-3">
          <h2 className="border-b border-zinc-700 pb-2 text-sm font-bold uppercase tracking-wider text-zinc-200">
            Overview
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
            <LoadKpiCard label="Today's load" value={todayLoad} status="normal" />
            <LoadKpiCard
              label={`Last ${periodDays} days total`}
              value={periodSum}
              status="normal"
            />
          </div>
        </section>

        {/* Charts – your load 7/14/28 days */}
        <section className="space-y-3">
          <h2 className="border-b border-zinc-700 pb-2 text-sm font-bold uppercase tracking-wider text-zinc-200">
            Charts
          </h2>
          <div className="flex flex-col gap-4">
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
            >
              <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div />
                <span className="text-center text-base font-bold uppercase tracking-wide text-zinc-200">
                  My load (7 / 14 / 28 days)
                </span>
                <div className="flex w-fit justify-end flex-nowrap items-center gap-0.5 rounded-lg border border-zinc-700 bg-zinc-800/50 p-1">
                  {([7, 14, 28] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPeriodDays(n)}
                      className={`h-8 w-9 rounded-md text-sm font-semibold transition shrink-0 ${
                        periodDays === n
                          ? "bg-emerald-600/30 text-emerald-400"
                          : "text-zinc-400 hover:bg-zinc-700/80 hover:text-white"
                      }`}
                    >
                      {n}d
                    </button>
                  ))}
                </div>
              </div>
              <TeamLoadBarChart
                data={myLoadChartData}
                trend={trend}
                periodDays={periodDays}
                titleOverride={`Last ${periodDays} days – My load`}
              />
            </div>
          </div>
        </section>

        {/* Recent sessions table */}
        <section className="space-y-2">
          <h2 className="border-b border-zinc-700 pb-2 text-sm font-bold uppercase tracking-wider text-zinc-200">
            Recent sessions
          </h2>
          <div
            className="overflow-hidden rounded-xl"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            {list.length === 0 ? (
              <p className="py-8 text-center text-zinc-400">No sessions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-900/95">
                    <tr className="border-b border-zinc-700 text-zinc-400">
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Duration (min)</th>
                      <th className="px-4 py-3 font-medium">RPE</th>
                      <th className="px-4 py-3 font-medium">Load</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-300">
                    {list.slice(0, 28).map((r) => (
                      <tr key={r.id} className="border-b border-zinc-800">
                        <td className="px-4 py-3">{r.date}</td>
                        <td className="px-4 py-3">{r.duration}</td>
                        <td className="px-4 py-3">{r.rpe ?? "—"}</td>
                        <td className="px-4 py-3 tabular-nums">{r.load ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
