"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const BG_PAGE = "#0b0f14";
const BG_CARD = "#11161c";
const CARD_RADIUS = "12px";

type AtRiskPlayer = {
  user_id: string;
  email: string;
  reason?: string;
  wellness?: number | null;
  fatigue?: number | null;
  load?: number;
};

type PlayerWithStatus = {
  id: string;
  email: string;
  full_name: string | null;
  status: string;
  avatar_url?: string | null;
};

type StaffDashboardProps = {
  metrics: {
    todayWellnessCount?: number;
    totalPlayers?: number;
    todayWellness?: number | null;
    totalTeamLoadToday?: number;
  };
  attentionToday: {
    missingWellness: { user_id: string; email: string }[];
    atRisk: AtRiskPlayer[];
  } | null;
  chart7: { date: string; load: number; wellness: number | null }[];
  playersWithStatus?: PlayerWithStatus[];
  isAdmin?: boolean;
};

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
}

const STATUS_OPTIONS = [
  { value: "available", label: "Available", pillClass: "bg-emerald-500/30", badgeClass: "bg-emerald-500/20 text-emerald-400" },
  { value: "limited", label: "Limited", pillClass: "bg-amber-500/30", badgeClass: "bg-amber-500/20 text-amber-400" },
  { value: "unavailable", label: "Unavailable", pillClass: "bg-red-500/30", badgeClass: "bg-red-500/20 text-red-400" },
] as const;

export function StaffDashboard({
  metrics,
  attentionToday,
  chart7,
  playersWithStatus = [],
  isAdmin = false,
}: StaffDashboardProps) {
  const router = useRouter();
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [savingPlayerId, setSavingPlayerId] = useState<string | null>(null);
  const [dropdownOpenId, setDropdownOpenId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [avatarOverrides, setAvatarOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setDropdownOpenId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const totalPlayers = metrics.totalPlayers ?? 0;
  const submitted = metrics.todayWellnessCount ?? 0;
  const avgWellness = metrics.todayWellness ?? null;
  const totalLoad = metrics.totalTeamLoadToday ?? 0;
  const atRisk = attentionToday?.atRisk ?? [];
  const highRiskCount = atRisk.length;

  const submissionPct = totalPlayers > 0 ? Math.round((submitted / totalPlayers) * 100) : 0;

  const wellnessColor =
    avgWellness == null
      ? "text-zinc-400"
      : avgWellness > 7
        ? "text-emerald-400"
        : avgWellness >= 5
          ? "text-amber-400"
          : "text-red-400";

  const chartDataWellness =
    chart7.length > 0
      ? chart7.map((p) => ({
          date: formatShortDate(p.date),
          wellness: p.wellness ?? 0,
        }))
      : [];
  const chartDataLoad =
    chart7.length > 0
      ? chart7.map((p) => ({
          date: formatShortDate(p.date),
          load: p.load,
        }))
      : [];
  const donutData = [
    { name: "Submitted", value: submitted, color: "#10b981" },
    { name: "Missing", value: Math.max(0, totalPlayers - submitted), color: "#3f3f46" },
  ].filter((d) => d.value > 0);

  async function setPlayerStatus(userId: string, status: string) {
    setStatusError(null);
    setSavingPlayerId(userId);
    const res = await fetch("/api/admin/player-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, status }),
    });
    setSavingPlayerId(null);
    if (res.ok) {
      setStatusOverrides((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setStatusOverrides((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      setStatusError((data.error as string) || "Failed to save status.");
    }
  }

  function onStatusSelect(p: PlayerWithStatus, value: string) {
    setDropdownOpenId(null);
    setStatusOverrides((prev) => ({ ...prev, [p.id]: value }));
    setPlayerStatus(p.id, value);
  }

  async function uploadAvatar(userId: string, file: File) {
    const formData = new FormData();
    formData.set("userId", userId);
    formData.set("file", file);
    const res = await fetch("/api/admin/upload-avatar", { method: "POST", body: formData });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.avatar_url) {
      setAvatarOverrides((prev) => ({ ...prev, [userId]: data.avatar_url }));
      router.refresh();
    }
  }

  function getStatusStyle(status: string) {
    const opt = STATUS_OPTIONS.find((o) => o.value === status) ?? STATUS_OPTIONS[0];
    return { pillClass: opt.pillClass, badgeClass: opt.badgeClass, label: opt.label };
  }

  return (
    <div
      className="min-h-screen px-4 py-8 sm:px-6 lg:px-8"
      style={{ backgroundColor: BG_PAGE }}
    >
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Performance Dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Elite football – today&apos;s overview
          </p>
        </div>

        {/* PLAYERS – ID cards */}
        {playersWithStatus.length > 0 && (
          <div ref={statusDropdownRef}>
            <h2 className="mb-4 text-lg font-semibold text-white">Players</h2>
            {statusError && (
              <p className="mb-2 text-sm text-red-400">{statusError}</p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {playersWithStatus.map((p) => {
                const effectiveStatus = statusOverrides[p.id] ?? p.status;
                const { pillClass, badgeClass, label } = getStatusStyle(effectiveStatus);
                const displayName = (p.full_name && p.full_name.trim()) || p.email;
                const avatarUrl = avatarOverrides[p.id] ?? p.avatar_url ?? null;
                const monogram = (displayName[0] ?? "?").toUpperCase();
                const isSaving = savingPlayerId === p.id;
                const isOpen = dropdownOpenId === p.id;
                return (
                  <div
                    key={p.id}
                    className="flex overflow-hidden rounded-xl border border-zinc-800 shadow-lg"
                    style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
                  >
                    <div className={`w-1.5 shrink-0 ${pillClass}`} aria-hidden />
                    <div className="flex min-w-0 flex-1 items-start gap-3 p-4">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-zinc-700 ring-2 ring-zinc-600">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-zinc-400">
                            {monogram}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-white">{displayName}</p>
                        <p className="mt-0.5 truncate text-xs text-zinc-400">{p.email}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
                            {label}
                          </span>
                          {isAdmin && (
                            <div className="relative inline-block">
                              <button
                                type="button"
                                onClick={() => {
                                  setStatusError(null);
                                  setDropdownOpenId(isOpen ? null : p.id);
                                }}
                                disabled={isSaving}
                                className="rounded border border-zinc-600 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                              >
                                {isSaving ? "Saving…" : "Change status ▾"}
                              </button>
                              {isOpen && (
                                <div className="absolute left-0 top-full z-20 mt-1 min-w-[140px] rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-lg">
                                  {STATUS_OPTIONS.map((opt) => (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      onClick={() => onStatusSelect(p, opt.value)}
                                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800"
                                    >
                                      {opt.label}
                                      {effectiveStatus === opt.value && (
                                        <span className="text-emerald-400" aria-hidden>✓</span>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {isAdmin && (
                          <div className="mt-2">
                            <label className="cursor-pointer text-xs text-zinc-400 hover:text-white">
                              <input
                                type="file"
                                accept="image/jpeg,image/png"
                                className="sr-only"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) uploadAvatar(p.id, f);
                                  e.target.value = "";
                                }}
                              />
                              {avatarUrl ? "Change photo" : "Upload photo"}
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION 1 – TOP KPI ROW */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            <p className="text-sm font-medium text-zinc-400">
              Players Submitted Today
            </p>
            <p className="mt-2 text-2xl font-bold text-white">
              {submitted} <span className="text-zinc-500">/ {totalPlayers}</span>
            </p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{
                  width: totalPlayers ? `${(submitted / totalPlayers) * 100}%` : "0%",
                }}
              />
            </div>
          </div>

          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            <p className="text-sm font-medium text-zinc-400">
              Average Wellness Score Today
            </p>
            <p className={`mt-2 text-3xl font-bold ${wellnessColor}`}>
              {avgWellness != null ? avgWellness.toFixed(1) : "—"}
            </p>
          </div>

          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            <p className="text-sm font-medium text-zinc-400">
              Total Team Load Today
            </p>
            <p className="mt-2 text-3xl font-bold text-white">{totalLoad}</p>
          </div>

          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            <p className="text-sm font-medium text-zinc-400">
              High Risk Players
            </p>
            <p className="mt-2 text-3xl font-bold text-white">
              {highRiskCount}
              {highRiskCount > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-red-500/20 px-2 py-0.5 text-sm font-medium text-red-400">
                  Alert
                </span>
              )}
            </p>
          </div>
        </div>

        {/* SECTION 2 – AT RISK PLAYERS PANEL */}
        <div
          className="rounded-xl p-5"
          style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
        >
          <h2 className="text-lg font-semibold text-white">
            ⚠ At Risk Players
          </h2>
          {atRisk.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {atRisk.map((p) => {
                const w = p.wellness ?? 0;
                const f = p.fatigue ?? 0;
                const critical = w < 5 || f > 7;
                const badge = critical ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400";
                return (
                  <li
                    key={p.user_id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-900/60 px-4 py-3"
                  >
                    <Link
                      href={`/players/${p.user_id}`}
                      className="font-medium text-white hover:text-emerald-400 hover:underline"
                    >
                      {p.email}
                    </Link>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-zinc-400">
                        Wellness: {p.wellness != null ? p.wellness.toFixed(1) : "—"}
                      </span>
                      <span className="text-zinc-400">
                        Fatigue: {p.fatigue ?? "—"}
                      </span>
                      <span className="text-zinc-400">Load: {p.load ?? 0}</span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${badge}`}
                      >
                        {critical ? "Critical" : "Warning"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 rounded-lg bg-emerald-500/10 px-4 py-3 text-emerald-400">
              All players within safe range
            </p>
          )}
        </div>

        {/* SECTION 3 – MINI CHARTS ROW */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            <h3 className="text-sm font-medium text-zinc-400">
              Last 7 days – Average wellness
            </h3>
            <div className="mt-3 h-40">
              {chartDataWellness.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartDataWellness} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#71717a" tick={{ fontSize: 10 }} domain={[0, 10]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: BG_CARD,
                        border: "1px solid #27272a",
                        borderRadius: "8px",
                      }}
                      formatter={(v: number) => [v.toFixed(1), "Wellness"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="wellness"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ fill: "#10b981" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                  No data
                </div>
              )}
            </div>
          </div>

          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            <h3 className="text-sm font-medium text-zinc-400">
              Last 7 days – Team load
            </h3>
            <div className="mt-3 h-40">
              {chartDataLoad.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDataLoad} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#71717a" tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: BG_CARD,
                        border: "1px solid #27272a",
                        borderRadius: "8px",
                      }}
                      formatter={(v: number) => [v, "Load"]}
                    />
                    <Bar dataKey="load" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                  No data
                </div>
              )}
            </div>
          </div>

          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            <h3 className="text-sm font-medium text-zinc-400">
              Submission compliance %
            </h3>
            <div className="mt-3 h-40">
              {donutData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                    >
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: BG_CARD,
                        border: "1px solid #27272a",
                        borderRadius: "8px",
                      }}
                      formatter={(v: number, name: string) => [
                        totalPlayers ? `${Math.round((v / totalPlayers) * 100)}%` : "0%",
                        name,
                      ]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                  No players
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/wellness"
            className="block rounded-xl p-4 transition opacity-90 hover:opacity-100"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            <span className="font-medium text-white">Wellness summary</span>
            <p className="mt-1 text-sm text-zinc-400">View all entries</p>
          </Link>
          <Link
            href="/rpe"
            className="block rounded-xl p-4 transition opacity-90 hover:opacity-100"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            <span className="font-medium text-white">RPE / sessions</span>
            <p className="mt-1 text-sm text-zinc-400">View all entries</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
