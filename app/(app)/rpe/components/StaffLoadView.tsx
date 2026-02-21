"use client";

import { useMemo, useState } from "react";
import type { SessionRow } from "@/lib/types";
import { LoadKpiCard } from "./LoadKpiCard";
import { RiskBadge, spikeToRiskLevel } from "./RiskBadge";
import { TeamLoadBarChart, PlayerLoadBarChart } from "./LoadBarChart";
import { PlayerLoadModal } from "./PlayerLoadModal";

const BG_PAGE = "#0b0f14";
const BG_CARD = "#11161c";
const CARD_RADIUS = "12px";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getLast7Dates(): string[] {
  const today = new Date();
  const out: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
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
  const out: string[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
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
}

export function StaffLoadView({ list, emailByUserId }: StaffLoadViewProps) {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyAtRisk, setOnlyAtRisk] = useState(false);
  const [modalUserId, setModalUserId] = useState<string | null>(null);

  const last7 = useMemo(() => getLast7Dates(), []);
  const prev7 = useMemo(() => getPrev7Dates(), []);
  const last28 = useMemo(() => getLast28Dates(), []);

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

    const teamChartData = last7.map((date) => ({
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
        return email.includes(query);
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
      label: (emailByUserId[uid] ?? uid).slice(0, 20),
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
  }, [list, last7, prev7, last28, selectedDate, searchQuery, onlyAtRisk, emailByUserId]);

  const atRiskStatus = atRiskCount > 0 ? (atRiskCount >= 3 ? "danger" : "warning") : "normal";

  const modalUser = modalUserId ? emailByUserId[modalUserId] ?? modalUserId : null;
  const modalSessions = modalUserId ? sessionsByUser.get(modalUserId) ?? [] : [];
  const modalSpike = modalUserId ? spikeByUser.get(modalUserId) ?? null : null;

  return (
    <div
      className="min-h-screen px-4 py-8 sm:px-6 lg:px-8"
      style={{ backgroundColor: BG_PAGE }}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">RPE / Load</h1>
          <p className="mt-1 text-zinc-400">
            Terhelés monitoring – napi és heti load, acute/chronic, kockázat.
          </p>
        </div>

        {/* Filter bar */}
        <div
          className="flex flex-wrap items-center gap-4 rounded-xl p-4"
          style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
        >
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            Dátum
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </label>
          <input
            type="search"
            placeholder="Játékos keresés"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:w-48"
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={onlyAtRisk}
              onChange={(e) => setOnlyAtRisk(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500"
            />
            Csak rizikós játékosok
          </label>
        </div>

        {/* KPI row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <LoadKpiCard
            label="Mai csapatterhelés"
            value={totalTeamLoadToday}
            status="normal"
          />
          <LoadKpiCard label="Heti terhelés (7 nap)" value={weeklyLoad} status="normal" />
          <LoadKpiCard label="Acute load (7 nap)" value={acuteLoad} status="normal" />
          <LoadKpiCard
            label="Chronic load (28 nap átlag)"
            value={chronicHasEnoughData && chronicLoad != null ? Math.round(chronicLoad) : "—"}
            status="normal"
            sublabel={!chronicHasEnoughData ? "Legalább 28 nap adat kell" : undefined}
          />
          <LoadKpiCard
            label="At-risk játékosok"
            value={atRiskCount}
            status={atRiskStatus}
          />
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            <TeamLoadBarChart data={teamChartData} trend={teamTrend} />
          </div>
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            <PlayerLoadBarChart data={playerChartData} />
          </div>
        </div>

        {/* Table */}
        <div
          className="overflow-hidden rounded-xl"
          style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
        >
          {tableRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-zinc-400">Nincs session a kiválasztott napon.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-zinc-900/95">
                  <tr className="border-b border-zinc-700 text-zinc-400">
                    <th className="px-4 py-3 font-medium">Játékos</th>
                    <th className="px-4 py-3 font-medium">Dátum</th>
                    <th className="px-4 py-3 font-medium">Load</th>
                    <th className="px-4 py-3 font-medium">Spike</th>
                    <th className="px-4 py-3 font-medium">Státusz</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-300">
                  {tableRows.map(({ userId, load, spike }) => {
                    const risk = spikeToRiskLevel(spike);
                    const isRisk = risk === "danger" || risk === "warning";
                    return (
                      <tr
                        key={userId}
                        className={`border-b border-zinc-800 hover:bg-zinc-800/50 ${
                          isRisk ? "bg-red-500/5" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setModalUserId(userId)}
                            className="font-medium text-emerald-400 hover:underline"
                          >
                            {emailByUserId[userId] ?? userId}
                          </button>
                        </td>
                        <td className="px-4 py-3">{selectedDate}</td>
                        <td className="px-4 py-3 tabular-nums">{load}</td>
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
