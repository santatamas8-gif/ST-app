"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ScheduleIcon } from "@/components/ScheduleIcon";
import { updateTeamSettings } from "@/app/actions/teamSettings";
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

function LocationPinIcon({ className, ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

type AtRiskPlayer = {
  user_id: string;
  email: string;
  full_name?: string | null;
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
  status_notes?: string | null;
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
  todayScheduleItems?: { id: string; activity_type: string; sort_order: number; start_time: string | null; end_time: string | null; notes?: string | null; opponent?: string | null; team_a?: string | null; team_b?: string | null }[];
  onRefreshData?: () => Promise<void>;
  userDisplayName?: string;
  teamSettings?: { team_name: string | null; team_logo_url: string | null };
};

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
}

const STATUS_OPTIONS = [
  { value: "available", label: "Available", pillClass: "bg-emerald-500/30", badgeClass: "bg-emerald-500/20 text-emerald-400", ringClass: "ring-2 ring-emerald-500/60 shadow-[0_0_24px_rgba(16,185,129,0.2)]", tintClass: "bg-emerald-500/15", borderLClass: "border-l-emerald-500" },
  { value: "limited", label: "Limited", pillClass: "bg-amber-500/30", badgeClass: "bg-amber-500/20 text-amber-400", ringClass: "ring-2 ring-amber-500/60 shadow-[0_0_24px_rgba(245,158,11,0.2)]", tintClass: "bg-amber-500/15", borderLClass: "border-l-amber-500" },
  { value: "unavailable", label: "Unavailable", pillClass: "bg-orange-500/30", badgeClass: "bg-orange-500/20 text-orange-400", ringClass: "ring-2 ring-orange-500/60 shadow-[0_0_24px_rgba(249,115,22,0.2)]", tintClass: "bg-orange-500/15", borderLClass: "border-l-orange-500" },
  { value: "injured", label: "Injured", pillClass: "bg-red-500/30", badgeClass: "bg-red-500/20 text-red-400", ringClass: "ring-2 ring-red-500/60 shadow-[0_0_24px_rgba(239,68,68,0.2)]", tintClass: "bg-red-500/15", borderLClass: "border-l-red-500" },
  { value: "rehab", label: "Rehab", pillClass: "bg-sky-500/30", badgeClass: "bg-sky-500/20 text-sky-400", ringClass: "ring-2 ring-sky-500/60 shadow-[0_0_24px_rgba(14,165,233,0.2)]", tintClass: "bg-sky-500/15", borderLClass: "border-l-sky-500" },
] as const;

export function StaffDashboard({
  metrics,
  attentionToday,
  chart7,
  playersWithStatus = [],
  isAdmin = false,
  todayScheduleItems = [],
  onRefreshData,
  userDisplayName,
  teamSettings,
}: StaffDashboardProps) {
  const router = useRouter();
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [savingPlayerId, setSavingPlayerId] = useState<string | null>(null);
  const [dropdownOpenId, setDropdownOpenId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [avatarOverrides, setAvatarOverrides] = useState<Record<string, string>>({});
  const [deletingAvatarId, setDeletingAvatarId] = useState<string | null>(null);
  const [avatarMenuOpenId, setAvatarMenuOpenId] = useState<string | null>(null);
  const [pendingStatusPlayerId, setPendingStatusPlayerId] = useState<string | null>(null);
  const [pendingStatusValue, setPendingStatusValue] = useState<string>("");
  const [pendingNotes, setPendingNotes] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetPlayerIdRef = useRef<string | null>(null);
  const [editingTeam, setEditingTeam] = useState(false);
  const [teamNameInput, setTeamNameInput] = useState("");
  const [teamLogoInput, setTeamLogoInput] = useState("");
  const [savingTeam, setSavingTeam] = useState(false);
  const [teamSaveError, setTeamSaveError] = useState<string | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setDropdownOpenId(null);
        setAvatarMenuOpenId(null);
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
  const missingWellness = attentionToday?.missingWellness ?? [];
  const missingCount = missingWellness.length;
  const atRiskCount = atRisk.length;
  const highRiskCount = atRiskCount;

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

  async function setPlayerStatus(userId: string, status: string, notes?: string | null) {
    setStatusError(null);
    setSavingPlayerId(userId);
    const res = await fetch("/api/admin/player-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, status, notes: notes ?? null }),
    });
    setSavingPlayerId(null);
    if (res.ok) {
      setStatusOverrides((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      await onRefreshData?.();
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
    setPendingStatusPlayerId(p.id);
    setPendingStatusValue(value);
    setPendingNotes(p.status_notes ?? "");
  }

  async function onStatusSave(p: PlayerWithStatus) {
    setDropdownOpenId(null);
    setStatusOverrides((prev) => ({ ...prev, [p.id]: pendingStatusValue }));
    setPendingStatusPlayerId(null);
    setPendingStatusValue("");
    setPendingNotes("");
    await setPlayerStatus(p.id, pendingStatusValue, pendingNotes.trim() || null);
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

  async function deleteAvatar(userId: string) {
    setDeletingAvatarId(userId);
    const res = await fetch("/api/admin/delete-avatar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setDeletingAvatarId(null);
    if (res.ok) {
      setAvatarOverrides((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      router.refresh();
    }
  }

  function getStatusStyle(status: string) {
    const opt = STATUS_OPTIONS.find((o) => o.value === status) ?? STATUS_OPTIONS[0];
    return { pillClass: opt.pillClass, badgeClass: opt.badgeClass, label: opt.label, ringClass: opt.ringClass, tintClass: opt.tintClass, borderLClass: opt.borderLClass };
  }

  return (
    <div
      className="min-h-screen px-4 py-8 sm:px-6 lg:px-8"
      style={{ backgroundColor: BG_PAGE }}
    >
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <p className="text-2xl font-bold tracking-tight text-white">
            Welcome, {userDisplayName ?? "User"}!
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {editingTeam && isAdmin ? (
              <>
                <input
                  type="text"
                  value={teamNameInput}
                  onChange={(e) => setTeamNameInput(e.target.value)}
                  placeholder="Team name"
                  maxLength={200}
                  className="rounded border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm text-white placeholder-zinc-500 w-48"
                />
                <input
                  type="url"
                  value={teamLogoInput}
                  onChange={(e) => setTeamLogoInput(e.target.value)}
                  placeholder="Logo image URL"
                  maxLength={500}
                  className="rounded border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm text-white placeholder-zinc-500 w-64"
                />
                <button
                  type="button"
                  onClick={async () => {
                    setTeamSaveError(null);
                    setSavingTeam(true);
                    const err = await updateTeamSettings(teamNameInput.trim() || null, teamLogoInput.trim() || null);
                    setSavingTeam(false);
                    if (err?.error) setTeamSaveError(err.error);
                    else {
                      setEditingTeam(false);
                      await onRefreshData?.();
                    }
                  }}
                  disabled={savingTeam}
                  className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {savingTeam ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTeam(false);
                    setTeamNameInput(teamSettings?.team_name ?? "");
                    setTeamLogoInput(teamSettings?.team_logo_url ?? "");
                    setTeamSaveError(null);
                  }}
                  className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-600"
                >
                  Cancel
                </button>
                {teamSaveError && <span className="text-sm text-red-400">{teamSaveError}</span>}
              </>
            ) : (
              <>
                {teamSettings?.team_name && (
                  <span className="text-lg font-bold text-white">{teamSettings.team_name}</span>
                )}
                {teamSettings?.team_logo_url && (
                  <img
                    src={teamSettings.team_logo_url}
                    alt="Team logo"
                    className="h-10 w-auto object-contain"
                  />
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTeam(true);
                      setTeamNameInput(teamSettings?.team_name ?? "");
                      setTeamLogoInput(teamSettings?.team_logo_url ?? "");
                    }}
                    className="text-sm text-amber-400 hover:text-amber-300"
                  >
                    Edit team
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Today's Schedule – horizontal timeline strip */}
        <section>
          <h2 className="mb-4 border-b border-zinc-700/80 pb-2 text-xl font-semibold text-white">Today&apos;s Schedule</h2>
          <div
            className="overflow-hidden rounded-xl border border-zinc-800"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            {todayScheduleItems.length === 0 ? (
              <p className="rounded-lg bg-zinc-800/50 px-5 py-6 text-center text-zinc-400">No schedule items today.</p>
            ) : (
              <div className="overflow-x-auto p-4">
                <div className="flex gap-4" style={{ minWidth: "min-content" }}>
                  {todayScheduleItems.map((item) => {
                    const SCHEDULE_LABELS: Record<string, string> = {
                      breakfast: "Breakfast",
                      lunch: "Lunch",
                      dinner: "Dinner",
                      training: "Training",
                      gym: "Gym",
                      recovery: "Recovery",
                      pre_activation: "Pre-activation",
                      video_analysis: "Video analysis",
                      meeting: "Meeting",
                      traveling: "Traveling",
                      physio: "Physio",
                      medical: "Medical",
                      media: "Media",
                      rest_off: "Rest/Off",
                      match: "Match",
                      team_building: "Team building",
                      individual: "Individual",
                    };
                    const baseLabel = SCHEDULE_LABELS[item.activity_type] ?? item.activity_type;
                    const label = item.activity_type === "match" && item.team_a?.trim() && item.team_b?.trim()
                      ? `${item.team_a.trim()} vs. ${item.team_b.trim()}`
                      : item.activity_type === "match" && item.opponent?.trim()
                        ? `${baseLabel} vs. ${item.opponent.trim()}`
                        : baseLabel;
                    const timeStr =
                      item.start_time != null
                        ? item.end_time != null
                          ? `${item.start_time}–${item.end_time}`
                          : item.start_time
                        : "—";
                    const notes = item.notes?.trim();
                    const isMatch = item.activity_type === "match";
                    return (
                      <div
                        key={item.id}
                        className={`flex shrink-0 rounded-lg border border-zinc-700/80 shadow-lg shadow-black/25 transition-all duration-200 ${
                          isMatch
                            ? "w-48 border-l-[6px] border-l-amber-500/70 bg-amber-500/10 hover:border-l-amber-500/90"
                            : "w-40 border-l-4 border-l-emerald-500/60 bg-zinc-800/80 hover:border-l-emerald-500/90"
                        }`}
                      >
                        <div className="min-w-0 flex-1 px-3 py-2.5">
                          <p
                            className={`tabular-nums font-semibold ${
                              isMatch
                                ? "text-base text-amber-400"
                                : "text-sm text-emerald-400"
                            }`}
                          >
                            {timeStr}
                          </p>
                          <p
                            className={`mt-1 flex items-center gap-2 font-medium text-zinc-300 ${
                              isMatch ? "text-sm" : "text-xs"
                            }`}
                          >
                            {!isMatch && <ScheduleIcon type={item.activity_type} className="shrink-0" />}
                            <span>{label}</span>
                          </p>
                          {notes ? (
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                              <LocationPinIcon className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
                              {notes}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* PLAYERS – ID cards */}
        {playersWithStatus.length > 0 && (
          <div ref={statusDropdownRef}>
            <h2 className="mb-4 border-b border-zinc-700/80 pb-2 text-xl font-semibold text-white">Players</h2>
            {statusError && (
              <p className="mb-2 text-sm text-red-400">{statusError}</p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {playersWithStatus.map((p) => {
                const effectiveStatus = statusOverrides[p.id] ?? p.status;
                const { pillClass, badgeClass, label, ringClass, tintClass, borderLClass } = getStatusStyle(effectiveStatus);
                const displayName = (p.full_name && p.full_name.trim()) || p.email;
                const avatarUrl = avatarOverrides[p.id] ?? p.avatar_url ?? null;
                const monogram = (displayName[0] ?? "?").toUpperCase();
                const isSaving = savingPlayerId === p.id;
                const isOpen = dropdownOpenId === p.id;
                const isAvatarMenuOpen = avatarMenuOpenId === p.id;
                return (
                  <div
                    key={p.id}
                    className={`relative flex overflow-visible rounded-xl border-l-4 border border-zinc-800 ${borderLClass} ${ringClass} ${isOpen || isAvatarMenuOpen ? "z-30" : ""}`}
                    style={{
                      backgroundColor: BG_CARD,
                      borderRadius: CARD_RADIUS,
                      boxShadow: "0 4px 20px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.04) inset",
                    }}
                  >
                    <div className="absolute inset-0 overflow-hidden rounded-xl" aria-hidden>
                      <div className={`pointer-events-none absolute inset-0 rounded-xl ${tintClass}`} />
                      <div
                        className="pointer-events-none absolute inset-0 rounded-xl opacity-60"
                        style={{
                          background: "linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 50%)",
                        }}
                      />
                    </div>
                    <div className="relative z-10 flex min-w-0 flex-1 items-start gap-3 overflow-visible p-4">
                      <div className="relative shrink-0">
                        {isAdmin ? (
                          <>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/jpeg,image/png"
                              className="sr-only"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                const targetId = uploadTargetPlayerIdRef.current;
                                if (f && targetId) {
                                  uploadAvatar(targetId, f);
                                  uploadTargetPlayerIdRef.current = null;
                                  setAvatarMenuOpenId(null);
                                }
                                e.target.value = "";
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setDropdownOpenId(null);
                                setAvatarMenuOpenId(isAvatarMenuOpen ? null : p.id);
                              }}
                              disabled={deletingAvatarId === p.id}
                              className={`relative block h-12 w-12 overflow-hidden rounded-full bg-zinc-700 ring-2 ring-zinc-600 transition-shadow hover:ring-emerald-500/50 ${deletingAvatarId === p.id ? "opacity-70" : ""}`}
                              title="Photo options"
                            >
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
                            </button>
                            {isAvatarMenuOpen && (
                              <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
                                <button
                                  type="button"
                                  onClick={() => {
                                    uploadTargetPlayerIdRef.current = p.id;
                                    fileInputRef.current?.click();
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800"
                                >
                                  {avatarUrl ? "Change photo" : "Upload photo"}
                                </button>
                                {avatarUrl && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      deleteAvatar(p.id);
                                      setAvatarMenuOpenId(null);
                                    }}
                                    disabled={deletingAvatarId === p.id}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-400 hover:bg-zinc-800 disabled:opacity-50"
                                  >
                                    {deletingAvatarId === p.id ? "Deleting…" : "Delete photo"}
                                  </button>
                                )}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="relative h-12 w-12 overflow-hidden rounded-full bg-zinc-700 ring-2 ring-zinc-600">
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
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-white">{displayName}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
                            {label}
                          </span>
                          {isAdmin && (
                            <div className="relative z-20 inline-block">
                              <button
                                type="button"
                                onClick={() => {
                                  setAvatarMenuOpenId(null);
                                  setStatusError(null);
                                  setPendingStatusPlayerId(null);
                                  setDropdownOpenId(isOpen ? null : p.id);
                                }}
                                disabled={isSaving}
                                className="rounded border border-zinc-600 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                              >
                                {isSaving ? "Saving…" : "Change status ▾"}
                              </button>
                              {isOpen && (
                                <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-zinc-700 bg-zinc-900 p-2 shadow-xl">
                                  {pendingStatusPlayerId === p.id ? (
                                    <>
                                      <p className="mb-2 text-xs text-zinc-400">
                                        Status: <span className="font-medium text-white">{STATUS_OPTIONS.find((o) => o.value === pendingStatusValue)?.label ?? pendingStatusValue}</span>
                                      </p>
                                      <label className="mb-2 block text-xs text-zinc-400">
                                        Description (optional)
                                      </label>
                                      <textarea
                                        value={pendingNotes}
                                        onChange={(e) => setPendingNotes(e.target.value)}
                                        placeholder="e.g. ankle strain, recovery expected 2 weeks"
                                        rows={2}
                                        className="mb-2 w-full resize-none rounded border border-zinc-600 bg-zinc-800 px-2 py-1.5 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
                                      />
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setPendingStatusPlayerId(null);
                                            setPendingStatusValue("");
                                            setPendingNotes("");
                                          }}
                                          className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800"
                                        >
                                          Back
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => onStatusSave(p)}
                                          className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500"
                                        >
                                          Save
                                        </button>
                                      </div>
                                    </>
                                  ) : (
                                    <>
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
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {(p.status_notes && p.status_notes.trim()) ? (
                          <p className="mt-1.5 line-clamp-2 text-xs text-zinc-500" title={p.status_notes}>
                            {p.status_notes}
                          </p>
                        ) : null}
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
            <p className="flex items-center gap-2 text-sm font-medium text-zinc-400">
              <span className="text-emerald-400" aria-hidden>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              </span>
              Players Submitted Today
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-white">
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
            <p className="flex items-center gap-2 text-sm font-medium text-zinc-400">
              <span className="text-emerald-400" aria-hidden>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
              </span>
              Average Wellness Score Today
            </p>
            <p className={`mt-2 text-3xl font-bold tabular-nums ${wellnessColor}`}>
              {avgWellness != null ? avgWellness.toFixed(1) : "—"}
            </p>
          </div>

          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            <p className="flex items-center gap-2 text-sm font-medium text-zinc-400">
              <span className="text-emerald-400" aria-hidden>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
              </span>
              Total Team Load Today
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-white">{totalLoad}</p>
          </div>

          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            <p className="flex items-center gap-2 text-sm font-medium text-zinc-400">
              <span className="text-red-400" aria-hidden>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              </span>
              High Risk Players
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-white">
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
          <h2 className="mb-4 border-b border-zinc-700/80 pb-2 text-xl font-semibold text-white">
            At risk players
          </h2>
          {atRisk.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {atRisk.map((p) => {
                const w = p.wellness ?? 0;
                const f = p.fatigue ?? 0;
                const critical = w < 5 || f > 7;
                const badge = critical ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400";
                const leftBorder = critical ? "border-l-red-500" : "border-l-amber-500";
                return (
                  <li
                    key={p.user_id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border-l-4 bg-zinc-900/60 px-4 py-3 ${leftBorder}`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">At risk player</p>
                      <Link
                        href={`/players/${p.user_id}`}
                        className="font-semibold text-white hover:text-emerald-400 hover:underline"
                      >
                        {(p.full_name && p.full_name.trim()) || p.email}
                      </Link>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <span className="rounded bg-zinc-800/80 px-2 py-1 tabular-nums text-zinc-300">
                        <span className="text-zinc-500">Wellness:</span> {p.wellness != null ? p.wellness.toFixed(1) : "—"}
                      </span>
                      <span className="rounded bg-zinc-800/80 px-2 py-1 tabular-nums text-zinc-300">
                        <span className="text-zinc-500">Fatigue:</span> {p.fatigue ?? "—"}
                      </span>
                      <span className="rounded bg-zinc-800/80 px-2 py-1 tabular-nums text-zinc-300">
                        <span className="text-zinc-500">Load:</span> {p.load ?? 0}
                      </span>
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
            <h3 className="border-b border-zinc-700/50 pb-2 text-base font-semibold text-white">
              Last 7 days – Average wellness
            </h3>
            <p className="mt-1 text-xs text-zinc-500">Team average</p>
            <div className="mt-3 h-40 min-h-[160px]">
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
            <h3 className="border-b border-zinc-700/50 pb-2 text-base font-semibold text-white">
              Last 7 days – Team load
            </h3>
            <p className="mt-1 text-xs text-zinc-500">Team total</p>
            <div className="mt-3 h-40 min-h-[160px]">
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
            <h3 className="border-b border-zinc-700/50 pb-2 text-base font-semibold text-white">
              Submission compliance %
            </h3>
            <p className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
              <span className="text-lg font-bold tabular-nums text-emerald-400">{submissionPct}%</span>
              submitted today
            </p>
            <div className="mt-3 h-40 min-h-[160px]">
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
            className="flex items-start gap-3 rounded-xl p-4 transition opacity-90 hover:opacity-100"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            <span className="text-emerald-400" aria-hidden>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
            </span>
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-white">Wellness summary</span>
              <p className="mt-1 text-sm text-zinc-400">View and manage all wellness entries</p>
            </div>
          </Link>
          <Link
            href="/rpe"
            className="flex items-start gap-3 rounded-xl p-4 transition opacity-90 hover:opacity-100"
            style={{ backgroundColor: BG_CARD, borderRadius: CARD_RADIUS }}
          >
            <span className="text-emerald-400" aria-hidden>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
            </span>
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-white">RPE / sessions</span>
              <p className="mt-1 text-sm text-zinc-400">View and manage RPE sessions</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
