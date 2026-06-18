"use client";

import { useMemo, useRef, useState, useEffect, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import type { SessionRow } from "@/lib/types";
import { useSearchShortcut } from "@/lib/useSearchShortcut";
import {
  buildDailyPlayerRows,
  calculateDailyOverviewMetrics,
  type DailyOverviewPlayer,
  type DailyPlayerRow,
} from "@/lib/rpe/dailyOverview";
import { parsePlayerAnalysisView } from "@/lib/rpe/playerAnalysisView";
import { parseStaffRpeViewFromLocation } from "@/lib/rpe/staffRpeView";
import { parseTeamTrendsView } from "@/lib/rpe/teamTrendsView";
import { formatMonthDay, formatDayShort } from "@/lib/formatDate";
import { TeamLoadBarChart, PlayerLoadBarChart, TwoWeekComparisonChart, type TwoWeekDataPoint } from "./LoadBarChart";
import { PlayerLoadModal } from "./PlayerLoadModal";
import { MatchdayAnalysis } from "./MatchdayAnalysis";
import { PlayerComparison } from "./PlayerComparison";
import { PlayerSelfBaseline } from "./PlayerSelfBaseline";
import { PlayerSessionHistory } from "./PlayerSessionHistory";
import { PlayerTeamBaseline } from "./PlayerTeamBaseline";
import { RpeAnalyticsDataProvider } from "./RpeAnalyticsDataProvider";
import { RecentKioskSessions } from "./RecentKioskSessions";
import { StaffRpeTabs } from "./StaffRpeTabs";
import { PlayerAnalysisTabs } from "./PlayerAnalysisTabs";
import { TeamTrendsTabs } from "./TeamTrendsTabs";
import { Activity, BarChart2, Calendar, LayoutDashboard, Search, User, X } from "lucide-react";
import type { RecentKioskSessionSummary } from "@/lib/kioskRpe/recentKioskSessions";

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
  return formatMonthDay(startDate);
}

function formatAverage(value: number | null, decimals = 1): string {
  if (value == null) return "—";
  return value.toFixed(decimals);
}

function formatDurationMinutes(value: number | null): string {
  if (value == null) return "—";
  return `${Math.round(value)} min`;
}

function formatLoadAu(value: number): string {
  return `${Math.round(value).toLocaleString("en-GB")} AU`;
}

function DailyKpiCard({
  label,
  value,
  sublabel,
  tone = "normal",
  isHighContrast,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  tone?: "normal" | "missing";
  isHighContrast: boolean;
}) {
  const valueClass = tone === "missing" ? "text-amber-400" : "text-emerald-400";
  return (
    <div
      className={`min-h-[112px] rounded-xl border p-4 ${
        isHighContrast ? "border-white/15 bg-white/[0.04]" : "border-zinc-800/90 bg-zinc-900/45"
      }`}
    >
      <p className={`text-xs font-semibold uppercase tracking-wide ${isHighContrast ? "text-white/70" : "text-zinc-500"}`}>
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${valueClass}`}>{value}</p>
      {sublabel != null && (
        <p className={`mt-1 text-xs ${isHighContrast ? "text-white/60" : "text-zinc-500"}`}>
          {sublabel}
        </p>
      )}
    </div>
  );
}

function CompactEmptyState({
  icon,
  title,
  isHighContrast,
}: {
  icon: ReactNode;
  title: string;
  isHighContrast: boolean;
}) {
  return (
    <div className="flex min-h-[112px] flex-col items-center justify-center gap-2 px-4 py-6 text-center">
      <div className={isHighContrast ? "text-white/45" : "text-zinc-500"}>{icon}</div>
      <p className={`text-sm ${isHighContrast ? "text-white/75" : "text-zinc-400"}`}>{title}</p>
    </div>
  );
}

function DailyPlayerTableRow({
  row,
  index,
  isHighContrast,
  onOpen,
}: {
  row: DailyPlayerRow;
  index: number;
  isHighContrast: boolean;
  onOpen: () => void;
}) {
  const rowBg = index % 2 === 1 ? (isHighContrast ? "bg-white/[0.03]" : "bg-zinc-800/30") : "";
  return (
    <tr
      className={`border-b ${isHighContrast ? "border-white/10 hover:bg-white/5" : "border-zinc-800/80 hover:bg-zinc-800/50"} ${rowBg}`}
    >
      <td className="px-3 py-3">
        <button
          type="button"
          onClick={onOpen}
          className="min-h-[36px] rounded text-left font-medium text-emerald-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          {row.playerName}
        </button>
      </td>
      <td className="px-3 py-3 tabular-nums">{row.sessionCount}</td>
      <td className="px-3 py-3 tabular-nums">{formatAverage(row.averageRpe)}</td>
      <td className="px-3 py-3 tabular-nums">{row.totalDuration} min</td>
      <td className="px-3 py-3 font-medium tabular-nums text-emerald-400">
        {formatLoadAu(row.totalLoad)}
      </td>
      <td className="px-3 py-3">
        <span className="inline-block rounded bg-zinc-800/80 px-2 py-1 text-[11px] font-medium text-zinc-300">
          {row.sessionTypeLabel}
        </span>
      </td>
      <td className="px-3 py-3">
        <span className="inline-block rounded bg-zinc-800/80 px-2 py-1 text-[11px] font-medium text-zinc-300">
          {row.matchdayTagLabel}
        </span>
      </td>
      <td className="px-3 py-3">
        <button
          type="button"
          onClick={onOpen}
          className="min-h-[34px] rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-zinc-700/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          View
        </button>
      </td>
    </tr>
  );
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
  playerRoster?: DailyOverviewPlayer[];
  recentKioskSessions?: RecentKioskSessionSummary[];
  recentKioskSessionsLoadError?: boolean;
}

export type PeriodDays = 7 | 14 | 28;

export function StaffLoadView({
  list,
  emailByUserId,
  displayNameByUserId = {},
  playerRoster = [],
  recentKioskSessions = [],
  recentKioskSessionsLoadError = false,
}: StaffLoadViewProps) {
  const { themeId } = useTheme();
  const searchParams = useSearchParams();
  const isHighContrast = themeId === "neon" || themeId === "matt";
  const [currentHash, setCurrentHash] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [periodDays, setPeriodDays] = useState<PeriodDays>(7);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalUserId, setModalUserId] = useState<string | null>(null);
  const [showAllPlayersSheet, setShowAllPlayersSheet] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  useSearchShortcut(searchInputRef);

  useEffect(() => {
    const updateHash = () => setCurrentHash(window.location.hash);
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const set = () => setIsMobile(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  useEffect(() => {
    if (!showAllPlayersSheet || !isMobile) return;
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
    };
  }, [showAllPlayersSheet, isMobile]);

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
  type DailyChartSortOrder = "asc" | "desc";
  const [dailyChartSortOrder, setDailyChartSortOrder] = useState<DailyChartSortOrder>("desc");

  const last7 = useMemo(() => getLast7Dates(), []);
  const prev7 = useMemo(() => getPrev7Dates(), []);
  const lastN = useMemo(() => getLastNDates(periodDays), [periodDays]);

  const {
    teamChartData,
    teamTrend,
    spikeByUser,
    sessionsByUser,
  } = useMemo(() => {
    const weeklyLoad = list
      .filter((s) => last7.includes(s.date))
      .reduce((a, s) => a + (s.load ?? 0), 0);

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

    const teamChartData = lastN.map((date) => ({
      date,
      load: list.filter((s) => s.date === date).reduce((a, s) => a + (s.load ?? 0), 0),
    }));
    const prev7Sum = list
      .filter((s) => prev7.includes(s.date))
      .reduce((a, s) => a + (s.load ?? 0), 0);
    const teamTrend =
      prev7Sum === 0 ? "stable" : weeklyLoad > prev7Sum ? "up" : weeklyLoad < prev7Sum ? "down" : "stable";

    return {
      teamChartData,
      teamTrend: teamTrend as "up" | "down" | "stable",
      spikeByUser,
      sessionsByUser,
    };
  }, [list, last7, prev7, lastN]);

  const { teamCompareData, playerCompareData, allPlayerIds } = useMemo(() => {
    const w1 = getWeekDates(week1Start);
    const w2 = getWeekDates(week2Start);
    const teamCompareData: TwoWeekDataPoint[] = w1.map((date, i) => ({
      day: date,
      label: formatDayShort(date as string),
      loadW1: list.filter((s) => s.date === date).reduce((a, s) => a + (s.load ?? 0), 0),
      loadW2: list.filter((s) => s.date === w2[i]).reduce((a, s) => a + (s.load ?? 0), 0),
    }));
    const playerCompareData: TwoWeekDataPoint[] =
      comparePlayerId == null
        ? []
        : w1.map((date, i) => ({
            day: date,
            label: formatDayShort(date as string),
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

  const dailyMetrics = useMemo(
    () => calculateDailyOverviewMetrics(list, selectedDate, playerRoster),
    [list, selectedDate, playerRoster]
  );

  const dailyRows = useMemo(
    () => buildDailyPlayerRows(list, selectedDate, playerRoster),
    [list, selectedDate, playerRoster]
  );

  const filteredDailyRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return dailyRows;
    return dailyRows.filter((row) =>
      `${row.playerName} ${emailByUserId[row.userId] ?? ""}`.toLowerCase().includes(query)
    );
  }, [dailyRows, emailByUserId, searchQuery]);

  const sortedPlayerChartData = useMemo(() => {
    return [...filteredDailyRows]
      .sort((a, b) =>
        dailyChartSortOrder === "asc" ? a.totalLoad - b.totalLoad : b.totalLoad - a.totalLoad
      )
      .map((row) => ({
        label: row.playerName.slice(0, 20),
        playerName: row.playerName,
        load: row.totalLoad,
        sessionCount: row.sessionCount,
      }));
  }, [filteredDailyRows, dailyChartSortOrder]);

  const sortedDailyRows = useMemo(() => {
    return [...filteredDailyRows].sort((a, b) =>
      dailyChartSortOrder === "asc" ? a.totalLoad - b.totalLoad : b.totalLoad - a.totalLoad
    );
  }, [filteredDailyRows, dailyChartSortOrder]);

  const modalUser = modalUserId
    ? displayNameByUserId[modalUserId] ?? emailByUserId[modalUserId] ?? modalUserId
    : null;
  const modalSessions = modalUserId ? sessionsByUser.get(modalUserId) ?? [] : [];
  const modalSpike = modalUserId ? spikeByUser.get(modalUserId) ?? null : null;
  const activeView = parseStaffRpeViewFromLocation(searchParams.get("view"), currentHash);
  const activePlayerAnalysisView = parsePlayerAnalysisView(searchParams.get("playerAnalysis"));
  const activeTeamTrendsView = parseTeamTrendsView(searchParams.get("analysis"));
  const hasTeamLoadData = teamChartData.some((point) => point.load > 0);

  useEffect(() => {
    if (activeView !== "kiosk" || currentHash !== "#recent-kiosk-sessions") return;
    requestAnimationFrame(() => {
      document.getElementById("recent-kiosk-sessions")?.scrollIntoView({ block: "start" });
    });
  }, [activeView, currentHash]);

  return (
    <div
      className="min-h-screen min-w-0 -mx-4 overflow-x-hidden px-3 py-8 sm:mx-0 sm:px-6 lg:px-8"
      style={{ backgroundColor: "var(--page-bg)" }}
    >
      <div className="mx-auto max-w-7xl min-w-0 space-y-6">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            {isMobile && (
              <Activity className="h-8 w-8 shrink-0 text-emerald-400" aria-hidden />
            )}
            <h1 className="text-base font-semibold tracking-tight text-white sm:text-lg md:text-xl lg:text-2xl">
              RPE / Load
            </h1>
          </div>
          <p className={`text-xs sm:text-sm ${isHighContrast ? "text-white/80" : "text-zinc-500"}`}>
            Monitor daily sessions, team trends and player load.
          </p>
        </div>

        <StaffRpeTabs activeView={activeView} />

        {activeView === "overview" && (
          <div className="space-y-6">
            <div
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${
                isHighContrast ? "border-white/15 bg-white/[0.04]" : "border-zinc-800/90 bg-zinc-900/45"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <label className={`flex items-center gap-2 text-xs ${isHighContrast ? "text-white/80" : "text-zinc-500"}`}>
                  Date
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="h-10 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayISO())}
                  className="h-10 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  Today
                </button>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
                <input
                  ref={searchInputRef}
                  type="search"
                  placeholder="Search players"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-800/80 py-2 pl-9 pr-16 text-sm text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  aria-label="Search players"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                  / or Ctrl+K
                </span>
              </div>
            </div>

            <section className="space-y-3">
              <h2 className={`flex items-center gap-2 border-b pb-2 text-sm font-bold uppercase tracking-wider ${isHighContrast ? "border-white/20 text-white/90" : "border-zinc-700 text-zinc-200"}`}>
                <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden />
                Daily Overview
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <DailyKpiCard
                  label="Players submitted"
                  value={dailyMetrics.submittedPlayers}
                  sublabel={`of ${dailyMetrics.totalPlayers} players`}
                  isHighContrast={isHighContrast}
                />
                <DailyKpiCard
                  label="Missing players"
                  value={dailyMetrics.missingPlayers}
                  sublabel="not submitted"
                  tone={dailyMetrics.missingPlayers > 0 ? "missing" : "normal"}
                  isHighContrast={isHighContrast}
                />
                <DailyKpiCard
                  label="Average RPE"
                  value={formatAverage(dailyMetrics.averageRpe)}
                  sublabel={`from ${dailyMetrics.sessionCount} sessions`}
                  isHighContrast={isHighContrast}
                />
                <DailyKpiCard
                  label="Average duration"
                  value={formatDurationMinutes(dailyMetrics.averageDuration)}
                  sublabel="per session"
                  isHighContrast={isHighContrast}
                />
                <DailyKpiCard
                  label="Total load"
                  value={formatLoadAu(dailyMetrics.totalLoad)}
                  sublabel="selected day"
                  isHighContrast={isHighContrast}
                />
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-700 pb-2">
                <div>
                  <h2 className={`flex items-center gap-2 text-sm font-bold uppercase tracking-wider ${isHighContrast ? "text-white/90" : "text-zinc-200"}`}>
                    <BarChart2 className="h-4 w-4 shrink-0" aria-hidden />
                    Today&apos;s Load by Player
                  </h2>
                  <p className={`mt-1 text-xs ${isHighContrast ? "text-white/60" : "text-zinc-500"}`}>
                    {formatMonthDay(selectedDate)} · Total daily load by player
                  </p>
                </div>
                <div className="flex gap-1 rounded-lg border border-zinc-700 bg-zinc-900/60 p-0.5">
                  <button
                    type="button"
                    onClick={() => setDailyChartSortOrder("asc")}
                    className={`h-8 rounded-md px-2.5 text-xs font-medium transition ${
                      dailyChartSortOrder === "asc"
                        ? "bg-emerald-600/30 text-emerald-400"
                        : "text-zinc-500 hover:bg-zinc-700/80 hover:text-white"
                    }`}
                    title="Ascending (low to high)"
                  >
                    Asc
                  </button>
                  <button
                    type="button"
                    onClick={() => setDailyChartSortOrder("desc")}
                    className={`h-8 rounded-md px-2.5 text-xs font-medium transition ${
                      dailyChartSortOrder === "desc"
                        ? "bg-emerald-600/30 text-emerald-400"
                        : "text-zinc-500 hover:bg-zinc-700/80 hover:text-white"
                    }`}
                    title="Descending (high to low)"
                  >
                    Desc
                  </button>
                </div>
              </div>
              <div
                className={`rounded-xl border p-4 ${isHighContrast ? "border-white/15 bg-white/[0.04]" : "border-zinc-800/90 bg-zinc-900/45"}`}
              >
                {dailyRows.length === 0 ? (
                  <CompactEmptyState
                    icon={<Calendar className="h-7 w-7" aria-hidden />}
                    title="No RPE sessions were submitted for this date."
                    isHighContrast={isHighContrast}
                  />
                ) : sortedPlayerChartData.length === 0 ? (
                  <CompactEmptyState
                    icon={<Search className="h-7 w-7" aria-hidden />}
                    title="No players match this search."
                    isHighContrast={isHighContrast}
                  />
                ) : (
                  <PlayerLoadBarChart data={isMobile ? sortedPlayerChartData.slice(0, 10) : sortedPlayerChartData} />
                )}
                {isMobile && sortedPlayerChartData.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllPlayersSheet(true)}
                    className="mt-3 w-full rounded-lg border border-zinc-600 bg-zinc-800/80 py-2.5 text-sm font-medium text-emerald-400 hover:bg-zinc-700/80"
                  >
                    {sortedPlayerChartData.length > 10
                      ? `View all (${sortedPlayerChartData.length}) players`
                      : "View list"}
                  </button>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <div className="border-b border-zinc-700 pb-2">
                <h2 className={`text-sm font-bold uppercase tracking-wider ${isHighContrast ? "text-white/90" : "text-zinc-200"}`}>
                  Player Daily Sessions
                </h2>
                <p className={`mt-1 text-xs ${isHighContrast ? "text-white/60" : "text-zinc-500"}`}>
                  {formatMonthDay(selectedDate)} · One row per submitted player
                </p>
              </div>
              <div
                className={`overflow-hidden rounded-xl border ${isHighContrast ? "border-white/15 bg-white/[0.04]" : "border-zinc-800/90 bg-zinc-900/45"}`}
              >
                {dailyRows.length === 0 ? (
                  <CompactEmptyState
                    icon={<Calendar className="h-7 w-7" aria-hidden />}
                    title="No player sessions were found for this date."
                    isHighContrast={isHighContrast}
                  />
                ) : sortedDailyRows.length === 0 ? (
                  <CompactEmptyState
                    icon={<Search className="h-7 w-7" aria-hidden />}
                    title="No players match this search."
                    isHighContrast={isHighContrast}
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left text-xs">
                      <thead className={isHighContrast ? "bg-white/8" : "bg-zinc-800/80"}>
                        <tr className={`border-b ${isHighContrast ? "border-white/20 text-white/80" : "border-zinc-700 text-zinc-400"}`}>
                          <th className="px-3 py-2.5 font-medium">Player</th>
                          <th className="px-3 py-2.5 font-medium">Sessions</th>
                          <th className="px-3 py-2.5 font-medium">Avg RPE</th>
                          <th className="px-3 py-2.5 font-medium">Total duration</th>
                          <th className="px-3 py-2.5 font-medium">Total load</th>
                          <th className="px-3 py-2.5 font-medium">Session type</th>
                          <th className="px-3 py-2.5 font-medium">Matchday</th>
                          <th className="px-3 py-2.5 font-medium">Details</th>
                        </tr>
                      </thead>
                      <tbody className={isHighContrast ? "text-white/90" : "text-zinc-300"}>
                        {sortedDailyRows.map((row, idx) => (
                          <DailyPlayerTableRow
                            key={row.userId}
                            row={row}
                            index={idx}
                            isHighContrast={isHighContrast}
                            onOpen={() => setModalUserId(row.userId)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {activeView === "kiosk" && (
          <div className="space-y-6">
            <RecentKioskSessions
              sessions={recentKioskSessions}
              loadError={recentKioskSessionsLoadError}
            />
          </div>
        )}

        {activeView === "team" && (
          <div className="space-y-6">
            <section className="space-y-4">
              <div className="space-y-3 border-b border-zinc-800 pb-4">
                <div>
                  <h2 className={`text-sm font-bold uppercase tracking-wider ${isHighContrast ? "text-white/90" : "text-zinc-200"}`}>
                    Team Trends
                  </h2>
                  <p className={`mt-1 text-sm ${isHighContrast ? "text-white/65" : "text-zinc-500"}`}>
                    Review team load progression, matchday patterns and weekly comparisons.
                  </p>
                </div>
                <TeamTrendsTabs activeView={activeTeamTrendsView} />
              </div>

              {activeTeamTrendsView === "load" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className={`text-base font-semibold ${isHighContrast ? "text-white/90" : "text-zinc-100"}`}>
                        Load Trend
                      </h3>
                      <p className={`mt-1 text-xs ${isHighContrast ? "text-white/60" : "text-zinc-500"}`}>
                        Team total load over the selected recent period.
                      </p>
                    </div>
                    <div
                      className="inline-flex h-10 rounded-[14px] border p-0.5"
                      style={{
                        backgroundColor: isHighContrast ? "rgba(255,255,255,0.06)" : "rgba(15,23,32,0.9)",
                        borderColor: isHighContrast ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.08)",
                      }}
                    >
                      {([7, 14, 28] as const).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setPeriodDays(n)}
                          className={`min-w-[72px] flex-1 rounded-[10px] text-sm font-medium transition-all duration-200 ${
                            periodDays === n
                              ? "bg-emerald-700/90 text-white"
                              : "bg-transparent text-gray-400 hover:bg-white/5 hover:text-gray-300 active:bg-white/10"
                          }`}
                        >
                          {n} days
                        </button>
                      ))}
                    </div>
                  </div>
                  <div
                    className={`rounded-xl border p-4 ${isHighContrast ? "border-white/15 bg-white/[0.04]" : "border-zinc-800/90 bg-zinc-900/45"}`}
                  >
                    {hasTeamLoadData ? (
                      <TeamLoadBarChart data={teamChartData} trend={teamTrend} periodDays={periodDays} />
                    ) : (
                      <CompactEmptyState
                        icon={<BarChart2 className="h-7 w-7" aria-hidden />}
                        title="No team load data is available for this period."
                        isHighContrast={isHighContrast}
                      />
                    )}
                  </div>
                </div>
              )}

              {activeTeamTrendsView === "matchday" && (
                <RpeAnalyticsDataProvider>
                  <MatchdayAnalysis />
                </RpeAnalyticsDataProvider>
              )}

              {activeTeamTrendsView === "weeks" && (
                <section
                  className={`space-y-4 rounded-xl border p-4 ${
                    isHighContrast ? "border-white/15 bg-white/[0.04]" : "border-zinc-800/90 bg-zinc-900/45"
                  }`}
                >
                  <div className="border-b border-zinc-800 pb-3">
                    <h3 className={`text-base font-semibold ${isHighContrast ? "text-white/90" : "text-zinc-100"}`}>
                      Compare Weeks
                    </h3>
                    <p className={`mt-1 text-xs ${isHighContrast ? "text-white/60" : "text-zinc-500"}`}>
                      Compare two selected weeks for the team and optionally one player.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <label className={`flex flex-col gap-1 text-xs ${isHighContrast ? "text-white/80" : "text-zinc-500"}`}>
                      Week 1
                      <input
                        type="date"
                        value={week1Start}
                        onChange={(e) => setWeek1Start(e.target.value)}
                        className="h-10 w-[152px] rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </label>
                    <label className={`flex flex-col gap-1 text-xs ${isHighContrast ? "text-white/80" : "text-zinc-500"}`}>
                      Week 2
                      <input
                        type="date"
                        value={week2Start}
                        onChange={(e) => setWeek2Start(e.target.value)}
                        className="h-10 w-[152px] rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </label>
                    <label className={`flex flex-col gap-1 text-xs ${isHighContrast ? "text-white/80" : "text-zinc-500"}`}>
                      Player
                      <select
                        value={comparePlayerId ?? ""}
                        onChange={(e) => setComparePlayerId(e.target.value || null)}
                        className="h-10 w-[180px] rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="">Team only</option>
                        {allPlayerIds.map((uid) => (
                          <option key={uid} value={uid}>
                            {(displayNameByUserId[uid] ?? emailByUserId[uid] ?? uid).slice(0, 40)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {!comparePlayerId && (
                      <p className={`pb-2 text-xs ${isHighContrast ? "text-white/60" : "text-zinc-500"}`}>
                        Select a player to add an individual comparison.
                      </p>
                    )}
                  </div>
                  <div className={`grid gap-4 ${comparePlayerId ? "xl:grid-cols-2" : ""}`}>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/20 p-3">
                      <TwoWeekComparisonChart
                        data={teamCompareData}
                        week1Label={`Week of ${formatWeekLabel(week1Start)}`}
                        week2Label={`Week of ${formatWeekLabel(week2Start)}`}
                        title="Team Load — Week 1 vs Week 2"
                      />
                    </div>
                    {comparePlayerId && (
                      <div className="rounded-lg border border-zinc-800 bg-zinc-950/20 p-3">
                        <TwoWeekComparisonChart
                          data={playerCompareData}
                          week1Label={`Week of ${formatWeekLabel(week1Start)}`}
                          week2Label={`Week of ${formatWeekLabel(week2Start)}`}
                          title={`${(displayNameByUserId[comparePlayerId] ?? emailByUserId[comparePlayerId] ?? comparePlayerId).slice(0, 20)} — Week 1 vs Week 2`}
                        />
                      </div>
                    )}
                  </div>
                </section>
              )}
            </section>
          </div>
        )}

        {activeView === "players" && (
          <div className="space-y-6">
            <section className="space-y-4">
              <div className="space-y-3 border-b border-zinc-800 pb-4">
                <div>
                  <h2 className={`text-sm font-bold uppercase tracking-wider ${isHighContrast ? "text-white/90" : "text-zinc-200"}`}>
                    Player Analysis
                  </h2>
                  <p className={`mt-1 text-sm ${isHighContrast ? "text-white/65" : "text-zinc-500"}`}>
                    Compare players and review individual load patterns.
                  </p>
                </div>
                <PlayerAnalysisTabs activeView={activePlayerAnalysisView} />
              </div>

              {activePlayerAnalysisView === "compare" && (
                <RpeAnalyticsDataProvider>
                  <PlayerComparison />
                </RpeAnalyticsDataProvider>
              )}

              {activePlayerAnalysisView === "self" && (
                <RpeAnalyticsDataProvider>
                  <PlayerSelfBaseline />
                </RpeAnalyticsDataProvider>
              )}

              {activePlayerAnalysisView === "team" && (
                <RpeAnalyticsDataProvider>
                  <PlayerTeamBaseline />
                </RpeAnalyticsDataProvider>
              )}

              {activePlayerAnalysisView === "history" && (
                <PlayerSessionHistory players={playerRoster} />
              )}
            </section>
          </div>
        )}

      </div>

      {modalUserId && modalUser && (
        <PlayerLoadModal
          playerName={modalUser}
          userId={modalUserId}
          sessions={modalSessions}
          spikePercent={modalSpike}
          highlightDate={selectedDate}
          onClose={() => setModalUserId(null)}
        />
      )}

      {showAllPlayersSheet && isMobile && (
        <div
          className="fixed inset-0 z-50 flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-zinc-900 via-zinc-900/98 to-zinc-950"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-emerald-500/25 bg-gradient-to-r from-zinc-800/90 to-zinc-800/70 px-4 py-4 shadow-lg shadow-black/20">
            <h3 className="text-lg font-bold tracking-tight text-white drop-shadow-sm">Today&apos;s load – all players</h3>
            <button
              type="button"
              onClick={() => setShowAllPlayersSheet(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-700/90 text-zinc-300 shadow-inner hover:bg-zinc-600 hover:text-white active:scale-95 transition-transform"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="shrink-0 px-4 py-3">
            <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-300 shadow-sm ring-1 ring-emerald-500/25">
              <Calendar className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              {formatMonthDay(selectedDate)}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-1">
            <div className="mb-3 rounded-xl border border-emerald-500/25 border-t-emerald-500/50 bg-emerald-500/10 px-4 py-2.5 shadow-inner">
              <div className="grid grid-cols-[1fr_auto] items-center gap-3 text-xs font-semibold uppercase tracking-wider text-emerald-200/90">
                <span>Player</span>
                <span className="text-right whitespace-nowrap">Sessions · Load</span>
              </div>
            </div>
            <ul className="space-y-2.5">
            {sortedDailyRows.map((row) => {
              const maxRpe = row.sessions.length
                ? Math.max(0, ...row.sessions.map((s) => s.rpe ?? 0))
                : 0;
              const zone = maxRpe >= 8 ? "red" : maxRpe >= 5 ? "yellow" : "green";
              const accentBg = zone === "red" ? "bg-red-500/60" : zone === "yellow" ? "bg-amber-500/60" : "bg-emerald-500/60";
              const iconBg = zone === "red" ? "bg-red-500/20 text-red-400" : zone === "yellow" ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400";
              return (
                <li
                  key={row.userId}
                  className="relative grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-emerald-500/20 bg-zinc-800/70 px-3.5 py-3.5 shadow-md shadow-black/10 ring-1 ring-emerald-500/10"
                >
                  <span className={`absolute left-0 top-1/2 h-9 w-1 -translate-y-1/2 rounded-r-full ${accentBg} shadow-sm`} aria-hidden />
                  <div className="flex min-w-0 items-center gap-2.5 pl-2">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconBg} ring-1 ring-white/5`}>
                      <User className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <span className="block min-w-0 break-words text-sm font-semibold leading-snug text-white">{row.playerName}</span>
                      <p className="mt-0.5 text-[10px] font-medium text-zinc-400">
                        {row.sessionTypeLabel} · {row.matchdayTagLabel} · Avg RPE {formatAverage(row.averageRpe)}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 rounded-lg bg-zinc-800/80 px-2.5 py-1.5 text-right text-xs tabular-nums ring-1 ring-emerald-500/20">
                    <span className="block text-zinc-400">{row.sessionCount} session{row.sessionCount === 1 ? "" : "s"}</span>
                    <span className="block font-semibold text-emerald-400">{formatLoadAu(row.totalLoad)}</span>
                  </div>
                </li>
              );
            })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
