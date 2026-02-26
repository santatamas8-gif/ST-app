"use client";

import { useMemo, useRef, useState } from "react";
import type { SessionRow } from "@/lib/types";
import { useSearchShortcut } from "@/lib/useSearchShortcut";
import { getDateContextLabel } from "@/lib/dateContext";
import { LoadKpiCard } from "./LoadKpiCard";
import { RiskBadge, spikeToRiskLevel } from "./RiskBadge";
import { TeamLoadBarChart, PlayerLoadBarChart, TwoWeekComparisonChart, type TwoWeekDataPoint } from "./LoadBarChart";
import { PlayerLoadModal } from "./PlayerLoadModal";

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

function getLast7Dates(): string[] {
  return getLastNDates(7);
}

function getPrev7Dates(): string[] {
  const out: string[] = [];
  for (let i = 13; i >= 7; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function getLast28Dates(): string[] {
  return getLastNDates(28);
}

/** Returns 7 consecutive dates starting from startDate (YYYY-MM-DD), local date. */
function getWeekDates(startDate: string): string[] {
  const [y, m, d] = startDate.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const out: string[] = [];
  const pad = (n: number) => n.toString().padStart(2, "0");
  for (let i = 0; i < 7; i++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    out.push(`${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`);
  }
  return out;
}

function formatWeekLabel(startDate: string): string {
  const [y, m, d] = startDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Spike = (current 7-day load - previous 7-day load) / previous 7-day load. Returns null if prev7 is 0. */
function computeSpike(
  sessions: SessionRow[],
  userId: string,
  last7: string[],
  prev7: string[]
): number | null {
  const curSum = sessions
    .filter((s) => s.user_id === userId && last7.includes(s.date))
    .reduce((a, s) => a + (s.load ?? 0), 0);
  const prevSum = sessions
    .filter((s) => s.user_id === userId && prev7.includes(s.date))
    .reduce((a, s) => a + (s.load ?? 0), 0);
  if (prevSum <= 0) return null;
  return (curSum - prevSum) / prevSum;
}

interface StaffLoadViewProps {
  list: SessionRow[];
  emailByUserId: Record<string, string>;
  displayNameByUserId?: Record<string, string>;
}

/** Build load breakdown string: "90(d) × 7 = 630" or "(60×5 + 30×7) = 510" */
function formatLoadBreakdown(
  sessions: SessionRow[],
  totalLoad: number
): string {
  if (sessions.length === 0) return "—";
  const parts = sessions.map((s) => {
    const d = s.duration ?? 0;
    const r = s.rpe ?? null;
    if (r != null) return `${d}×${r}`;
    return `${d}(d)`;
  });
  if (parts.length === 1) {
    const s = sessions[0];
    if (s.rpe != null) return `${s.duration}(d) × ${s.rpe} = ${totalLoad}`;
    return `${s.duration}(d) = ${totalLoad}`;
  }
  return `(${parts.join(" + ")}) = ${totalLoad}`;
}

export type PeriodDays = 7 | 14 | 28;

export function StaffLoadView({ list, emailByUserId, displayNameByUserId = {} }: StaffLoadViewProps) {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [periodDays, setPeriodDays] = useState<PeriodDays>(7);
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyAtRisk, setOnlyAtRisk] = useState(false);
  const [modalUserId, setModalUserId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  useSearchShortcut(searchInputRef);

  const [week1Start, setWeek1Start] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().slice(0, 10);
  });
  const [week2Start, setWeek2Start] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [comparePlayerId, setComparePlayerId] = useState<string | null>(null);
  type LoadSortOrder = "asc" | "desc" | null;
  const [loadSortOrder, setLoadSortOrder] = useState<LoadSortOrder>(null);
  type DailyChartSortOrder = "asc" | "desc";
  const [dailyChartSortOrder, setDailyChartSortOrder] = useState<DailyChartSortOrder>("desc");

  const last7 = useMemo(() => getLast7Dates(), []);
  const prev7 = useMemo(() => getPrev7Dates(), []);
  const last28 = useMemo(() => getLast28Dates(), []);
  const lastN = useMemo(() => getLastNDates(periodDays), [periodDays]);

  const {
    totalTeamLoadToday,
    weeklyLoad,
    acuteLoad,
    chronicLoad,
    chronicHasEnoughData,
    atRiskCount,
    teamChartData,
    teamTrend,
    playerChartData,
    tableRows,
    spikeByUser,
    sessionsByUser,
  } = useMemo(() => {
    const today = todayISO();
    const totalTeamLoadToday = list
      .filter((s) => s.date === today)
      .reduce((a, s) => a + (s.load ?? 0), 0);
    const weeklyLoad = list
      .filter((s) => last7.includes(s.date))
      .reduce((a, s) => a + (s.load ?? 0), 0);
    const acuteLoad = weeklyLoad; // same as 7-day sum
    const last28LoadSum = list
      .filter((s) => last28.includes(s.date))
      .reduce((a, s) => a + (s.load ?? 0), 0);
    const chronicHasEnoughData = last28.length >= 28;
    const chronicLoad = chronicHasEnoughData ? last28LoadSum / 28 : null;

    const userIds = [...new Set(list.map((s) => s.user_id))];
    const spikeByUser = new Map<string, number | null>();
    const sessionsByUser = new Map<string, SessionRow[]>();
    for (const uid of userIds) {
      spikeByUser.set(uid, computeSpike(list, uid, last7, prev7));
      sessionsByUser.set(
        uid,
        list.filter((s) => s.user_id === uid).sort((a, b) => (b.date > a.date ? 1 : -1))
      );
    }
    let atRiskCount = 0;
    for (const [, spike] of spikeByUser) {
      if (spike != null && spike >= 0.3) atRiskCount++;
    }

    const teamChartData = lastN.map((date) => ({
      date,
      load: list.filter((s) => s.date === date).reduce((a, s) => a + (s.load ?? 0), 0),
    }));
    const prev7Sum = list
      .filter((s) => prev7.includes(s.date))
      .reduce((a, s) => a + (s.load ?? 0), 0);
    const teamTrend =
      prev7Sum === 0 ? "stable" : weeklyLoad > prev7Sum ? "up" : weeklyLoad < prev7Sum ? "down" : "stable";

    const query = searchQuery.trim().toLowerCase();
    let rows = list.filter((s) => s.date === selectedDate);
    if (query) {
      rows = rows.filter((s) => {
        const email = (emailByUserId[s.user_id] ?? "").toLowerCase();
        const name = (displayNameByUserId[s.user_id] ?? "").toLowerCase();
        return name.includes(query) || email.includes(query);
      });
    }
    if (onlyAtRisk) {
      rows = rows.filter((s) => {
        const sp = spikeByUser.get(s.user_id);
        return sp != null && sp >= 0.2;
      });
    }
    const uniqueUsers = [...new Set(rows.map((s) => s.user_id))];
    const tableRows = uniqueUsers.map((uid) => {
      const dayLoad = rows.filter((s) => s.user_id === uid).reduce((a, s) => a + (s.load ?? 0), 0);
      return { userId: uid, load: dayLoad, spike: spikeByUser.get(uid) ?? null };
    });

    const playerChartData = uniqueUsers.map((uid) => ({
      label: (displayNameByUserId[uid] ?? emailByUserId[uid] ?? uid).slice(0, 20),
      load: rows.filter((s) => s.user_id === uid).reduce((a, s) => a + (s.load ?? 0), 0),
      spikePercent: spikeByUser.get(uid) ?? undefined,
    }));

    return {
      totalTeamLoadToday,
      weeklyLoad,
      acuteLoad,
      chronicLoad,
      chronicHasEnoughData,
      atRiskCount,
      teamChartData,
      teamTrend: teamTrend as "up" | "down" | "stable",
      playerChartData,
      tableRows,
      spikeByUser,
      sessionsByUser,
    };
  }, [list, last7, prev7, last28, lastN, selectedDate, searchQuery, onlyAtRisk, emailByUserId, displayNameByUserId, periodDays]);

  const formatDayShort = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
  };

  const { teamCompareData, playerCompareData, allPlayerIds } = useMemo(() => {
    const w1 = getWeekDates(week1Start);
    const w2 = getWeekDates(week2Start);
    const teamCompareData: TwoWeekDataPoint[] = w1.map((date, i) => ({
      day: date,
      label: formatDayShort(date),
      loadW1: list.filter((s) => s.date === date).reduce((a, s) => a + (s.load ?? 0), 0),
      loadW2: list.filter((s) => s.date === w2[i]).reduce((a, s) => a + (s.load ?? 0), 0),
    }));
    const playerCompareData: TwoWeekDataPoint[] =
      comparePlayerId == null
        ? []
        : w1.map((date, i) => ({
            day: date,
            label: formatDayShort(date),
            loadW1: list
              .filter((s) => s.user_id === comparePlayerId && s.date === date)
              .reduce((a, s) => a + (s.load ?? 0), 0),
            loadW2: list
              .filter((s) => s.user_id === comparePlayerId && s.date === w2[i])
              .reduce((a, s) => a + (s.load ?? 0), 0),
          }));
    const allPlayerIds = [...new Set(list.map((s) => s.user_id))];
    return { teamCompareData, playerCompareData, allPlayerIds };
  }, [list, week1Start, week2Start, comparePlayerId]);

  const atRiskStatus = atRiskCount > 0 ? (atRiskCount >= 3 ? "danger" : "warning") : "normal";

  const sortedTableRows = useMemo(() => {
    if (loadSortOrder == null) return tableRows;
    return [...tableRows].sort((a, b) =>
      loadSortOrder === "asc" ? a.load - b.load : b.load - a.load
    );
  }, [tableRows, loadSortOrder]);

  const sortedPlayerChartData = useMemo(() => {
    return [...playerChartData].sort((a, b) =>
      dailyChartSortOrder === "asc" ? a.load - b.load : b.load - a.load
    );
  }, [playerChartData, dailyChartSortOrder]);

  const modalUser = modalUserId
    ? displayNameByUserId[modalUserId] ?? emailByUserId[modalUserId] ?? modalUserId
    : null;
  const modalSessions = modalUserId ? sessionsByUser.get(modalUserId) ?? [] : [];
  const modalSpike = modalUserId ? spikeByUser.get(modalUserId) ?? null : null;

  return (
    <div
      className="min-h-screen px-4 py-8 sm:px-6 lg:px-8"
      style={{ backgroundColor: "var(--page-bg)" }}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">RPE / Load</h1>
          <p className="mt-1 text-zinc-400">
            Load monitoring – daily and weekly load, acute/chronic, risk.
          </p>
        </div>

        {/* Date + Search */}
        <div
          className="flex flex-wrap items-center justify-between gap-4 rounded-xl p-4"
          style={{ backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS }}
        >
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-zinc-500">
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
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="search"
                placeholder="Search players"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="min-h-[40px] w-36 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 pr-16 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:w-44"
                aria-label="Search players"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                / or Ctrl+K
              </span>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={onlyAtRisk}
                onChange={(e) => setOnlyAtRisk(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500"
              />
              Only at-risk
            </label>
          </div>
        </div>

        {/* Overview – KPI */}
        <section className="space-y-3">
          <h2 className="border-b border-zinc-700 pb-2 text-sm font-bold uppercase tracking-wider text-zinc-200">Overview</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
            <LoadKpiCard
              label="Today's team load"
              value={totalTeamLoadToday}
              status="normal"
            />
            <LoadKpiCard label="Weekly load (7 days)" value={weeklyLoad} status="normal" />
            <LoadKpiCard label="Acute load (7 days)" value={acuteLoad} status="normal" />
            <LoadKpiCard
              label="Chronic load (28-day avg)"
              value={chronicHasEnoughData && chronicLoad != null ? Math.round(chronicLoad) : "—"}
              status="normal"
              sublabel={!chronicHasEnoughData ? "At least 28 days of data required" : undefined}
            />
            <LoadKpiCard
              label="At-risk players"
              value={atRiskCount}
              status={atRiskStatus}
              className={atRiskStatus === "danger" ? "ring-1 ring-inset ring-red-500/40" : atRiskStatus === "warning" ? "ring-1 ring-inset ring-amber-500/40" : ""}
            />
          </div>
        </section>

        {/* Charts – daily first, then weekly */}
        <section className="space-y-3">
          <h2 className="border-b border-zinc-700 pb-2 text-sm font-bold uppercase tracking-wider text-zinc-200">Charts</h2>
          <div className="flex flex-col gap-4">
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS }}
            >
              <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div />
                <span className="text-center text-base font-bold uppercase tracking-wide text-zinc-200">Today&apos;s load (by player)</span>
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setDailyChartSortOrder("asc")}
                    className={`rounded px-2 py-1 text-xs font-medium transition ${
                      dailyChartSortOrder === "asc"
                        ? "bg-emerald-600/30 text-emerald-400"
                        : "text-zinc-500 hover:bg-zinc-700/80 hover:text-white"
                    }`}
                    title="Ascending (low to high)"
                  >
                    ↑ Asc
                  </button>
                  <button
                    type="button"
                    onClick={() => setDailyChartSortOrder("desc")}
                    className={`rounded px-2 py-1 text-xs font-medium transition ${
                      dailyChartSortOrder === "desc"
                        ? "bg-emerald-600/30 text-emerald-400"
                        : "text-zinc-500 hover:bg-zinc-700/80 hover:text-white"
                    }`}
                    title="Descending (high to low)"
                  >
                    ↓ Desc
                  </button>
                </div>
              </div>
              <PlayerLoadBarChart data={sortedPlayerChartData} />
            </div>
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS }}
            >
              <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div />
                <span className="text-center text-base font-bold uppercase tracking-wide text-zinc-200">Team load (7 / 14 / 28 days)</span>
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
              <TeamLoadBarChart data={teamChartData} trend={teamTrend} periodDays={periodDays} />
            </div>
          </div>
        </section>

        {/* Compare two weeks – compact controls, paired charts */}
        <section
          className="space-y-4 rounded-xl border border-zinc-700/80 p-4"
          style={{ backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS }}
        >
          <h2 className="border-b border-zinc-700 pb-2 text-sm font-bold uppercase tracking-wider text-zinc-200">Compare two weeks</h2>
          <div className="flex flex-wrap items-center gap-3 gap-y-2">
            <label className="flex items-center gap-1.5 text-xs text-zinc-400">
              <span className="w-16 shrink-0">Week 1</span>
              <input
                type="date"
                value={week1Start}
                onChange={(e) => setWeek1Start(e.target.value)}
                className="h-9 w-36 rounded border border-zinc-700 bg-zinc-800/80 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-zinc-400">
              <span className="w-16 shrink-0">Week 2</span>
              <input
                type="date"
                value={week2Start}
                onChange={(e) => setWeek2Start(e.target.value)}
                className="h-9 w-36 rounded border border-zinc-700 bg-zinc-800/80 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-zinc-400">
              <span className="shrink-0">Player</span>
              <select
                value={comparePlayerId ?? ""}
                onChange={(e) => setComparePlayerId(e.target.value || null)}
                className="h-9 min-w-[140px] rounded border border-zinc-700 bg-zinc-800/80 px-2 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">Team only</option>
                {allPlayerIds.map((uid) => (
                  <option key={uid} value={uid}>
                    {(displayNameByUserId[uid] ?? emailByUserId[uid] ?? uid).slice(0, 40)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-4 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 lg:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 p-3">
              <TwoWeekComparisonChart
                data={teamCompareData}
                week1Label={`Week of ${formatWeekLabel(week1Start)}`}
                week2Label={`Week of ${formatWeekLabel(week2Start)}`}
                title="Team – Week 1 vs Week 2"
              />
            </div>
            {comparePlayerId ? (
              <div className="rounded-lg border border-zinc-800 p-3">
                <TwoWeekComparisonChart
                  data={playerCompareData}
                  week1Label={`Week of ${formatWeekLabel(week1Start)}`}
                  week2Label={`Week of ${formatWeekLabel(week2Start)}`}
                  title={`${(displayNameByUserId[comparePlayerId] ?? emailByUserId[comparePlayerId] ?? comparePlayerId).slice(0, 20)} – W1 vs W2`}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-lg border border-dashed border-zinc-700 p-8 text-sm text-zinc-500">
                Select a player to compare.
              </div>
            )}
          </div>
        </section>

        {/* Daily table */}
        <section className="space-y-3">
          <h2 className="border-b border-zinc-700 pb-2 text-sm font-bold uppercase tracking-wider text-zinc-200">
            Sessions by player – {selectedDate}
          </h2>
          <div
            className="overflow-hidden rounded-xl"
            style={{ backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS }}
          >
          {sortedTableRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-zinc-400">No sessions for the selected date.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-zinc-900/95">
                  <tr className="border-b border-zinc-700 text-zinc-400">
                    <th className="px-4 py-3 font-medium">Player</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">
                      <button
                        type="button"
                        onClick={() =>
                          setLoadSortOrder((prev) =>
                            prev == null ? "desc" : prev === "desc" ? "asc" : null
                          )
                        }
                        className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-zinc-700/80 hover:text-white"
                        title="Sort by load (click to cycle: descending → ascending → no sort)"
                      >
                        Load
                        {loadSortOrder === "desc" && <span className="text-emerald-400" aria-hidden>↓</span>}
                        {loadSortOrder === "asc" && <span className="text-emerald-400" aria-hidden>↑</span>}
                      </button>
                    </th>
                    <th className="px-4 py-3 font-medium">Spike</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-300">
                  {sortedTableRows.map(({ userId, load, spike }) => {
                    const risk = spikeToRiskLevel(spike);
                    const daySessions = list.filter(
                      (s) => s.user_id === userId && s.date === selectedDate
                    );
                    const loadBreakdown = formatLoadBreakdown(daySessions, load);
                    const displayName = displayNameByUserId[userId] ?? emailByUserId[userId] ?? userId;
                    return (
                      <tr
                        key={userId}
                        className={`border-b border-zinc-800 hover:bg-zinc-800/50 ${
                          risk === "danger" ? "bg-red-500/5" : risk === "warning" ? "bg-amber-500/5" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setModalUserId(userId)}
                            className="min-h-[44px] rounded font-medium text-emerald-400 hover:underline"
                          >
                            {displayName}
                          </button>
                        </td>
                        <td className="px-4 py-3">{selectedDate}<span className="text-zinc-500">{getDateContextLabel(selectedDate)}</span></td>
                        <td className="px-4 py-3 tabular-nums text-zinc-300">
                          <span className="text-zinc-500">{loadBreakdown}</span>
                        </td>
                        <td className="px-4 py-3 tabular-nums">
                          {spike != null ? `${(spike * 100).toFixed(0)}%` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <RiskBadge level={risk} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </section>

      </div>

      {modalUserId && modalUser && (
        <PlayerLoadModal
          playerName={modalUser}
          userId={modalUserId}
          sessions={modalSessions}
          spikePercent={modalSpike}
          onClose={() => setModalUserId(null)}
        />
      )}
    </div>
  );
}
