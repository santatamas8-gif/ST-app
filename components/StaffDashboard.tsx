"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Activity, Calendar, CheckCircle, ChevronDown, ChevronUp, Flag, HeartPulse, Pause, Play, Users, X } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { NEON_CARD_STYLE, MATT_CARD_STYLE, getNeonCardStyleForStatus, getStatusCardStyle } from "@/lib/themes";
import { ScheduleBottomSheet, useIsMobile } from "@/components/ScheduleBottomSheet";
import { ScheduleIcon } from "@/components/ScheduleIcon";
import { getScheduleActivityBg } from "@/components/scheduleColors";
import { updateTeamSettings } from "@/app/actions/teamSettings";
import { formatDayShort } from "@/lib/formatDate";
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

const CARD_RADIUS = "12px";

function dashboardIconBgClass(type: string) {
  return getScheduleActivityBg(type);
}

function dashboardNeonCardStyle(type: string, isMatch: boolean) {
  // Match továbbra is külön, erősebb arany fókusz
  if (isMatch || type === "match") {
    return {
      backgroundImage:
        "radial-gradient(circle at left, rgba(251, 191, 36, 0.26) 0, transparent 55%), linear-gradient(135deg, #141006, #0a0502)",
      boxShadow:
        "0 0 0 1px rgba(255,255,255,0.05), 0 0 0 1px rgba(251, 191, 36, 0.2), 0 5px 16px rgba(180, 83, 9, 0.08)",
    };
  }

  // A többi típusnál csak a bal oldali "glow" színe változik,
  // illeszkedve az ikon hátterének Tailwind színéhez.
  const glowByType: Record<string, string> = {
    breakfast: "rgba(16, 185, 129, 0.26)", // emerald
    lunch: "rgba(16, 185, 129, 0.26)",
    dinner: "rgba(16, 185, 129, 0.26)",
    arrival: "rgba(249, 115, 22, 0.30)", // orange
    training: "rgba(16, 185, 129, 0.30)", // emerald
    gym: "rgba(132, 204, 22, 0.28)", // lime
    recovery: "rgba(45, 212, 191, 0.30)", // teal
    pre_activation: "rgba(6, 182, 212, 0.30)", // cyan
    video_analysis: "rgba(139, 92, 246, 0.30)", // violet
    traveling: "rgba(245, 158, 11, 0.30)", // amber
    physio: "rgba(56, 189, 248, 0.30)", // sky
    medical: "rgba(244, 63, 94, 0.30)", // rose
    meeting: "rgba(79, 70, 229, 0.30)", // indigo
    media: "rgba(217, 70, 239, 0.30)", // fuchsia
    team_building: "rgba(147, 51, 234, 0.30)", // purple
    rest_off: "rgba(59, 130, 246, 0.26)", // blue
    individual: "rgba(52, 211, 153, 0.30)", // emerald lighter
  };

  const glow = glowByType[type] ?? "rgba(16, 185, 129, 0.26)";

  return {
    backgroundImage: `radial-gradient(circle at left, ${glow} 0, transparent 55%), linear-gradient(135deg, #041311, #020617)`,
    boxShadow:
      "0 0 0 1px rgba(255,255,255,0.05), 0 0 0 1px rgba(16, 185, 129, 0.2), 0 5px 16px rgba(6, 95, 70, 0.08)",
  };
}

function DonutTooltipContent({
  active,
  payload,
  totalPlayers,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number }>;
  totalPlayers: number;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const val = item.value ?? 0;
  const pct = totalPlayers ? Math.round((val / totalPlayers) * 100) : 0;
  return (
    <div
      style={{
        backgroundColor: "#181d24",
        border: "1px solid #52525b",
        borderRadius: 8,
        padding: "8px 12px",
        color: "#fafafa",
        fontSize: 13,
      }}
    >
      {item.name ?? ""} : {pct}%
    </div>
  );
}

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
  { value: "available", label: "Available", pillClass: "bg-emerald-500/30", badgeClass: "bg-emerald-500/20 text-emerald-400", ringClass: "ring-2 ring-emerald-500/45 shadow-[0_0_14px_rgba(16,185,129,0.08)]", tintClass: "bg-emerald-500/15", borderLClass: "border-l-emerald-500" },
  { value: "limited", label: "Limited", pillClass: "bg-amber-500/30", badgeClass: "bg-amber-500/20 text-amber-400", ringClass: "ring-2 ring-amber-500/45 shadow-[0_0_14px_rgba(245,158,11,0.08)]", tintClass: "bg-amber-500/15", borderLClass: "border-l-amber-500" },
  { value: "unavailable", label: "Unavailable", pillClass: "bg-orange-500/30", badgeClass: "bg-orange-500/20 text-orange-400", ringClass: "ring-2 ring-orange-500/45 shadow-[0_0_14px_rgba(249,115,22,0.08)]", tintClass: "bg-orange-500/15", borderLClass: "border-l-orange-500" },
  { value: "injured", label: "Injured", pillClass: "bg-red-500/30", badgeClass: "bg-red-500/20 text-red-400", ringClass: "ring-2 ring-red-500/45 shadow-[0_0_14px_rgba(239,68,68,0.08)]", tintClass: "bg-red-500/15", borderLClass: "border-l-red-500" },
  { value: "rehab", label: "Rehab", pillClass: "bg-sky-500/30", badgeClass: "bg-sky-500/20 text-sky-400", ringClass: "ring-2 ring-sky-500/45 shadow-[0_0_14px_rgba(14,165,233,0.08)]", tintClass: "bg-sky-500/15", borderLClass: "border-l-sky-500" },
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
  const { themeId } = useTheme();
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
  const scheduleFirstPartRef = useRef<HTMLDivElement>(null);
  const [scheduleSegmentWidth, setScheduleSegmentWidth] = useState(0);
  const [scheduleAutoPaused, setScheduleAutoPaused] = useState(false);
  const [scheduleSheetOpen, setScheduleSheetOpen] = useState(false);
  const [playersSheetOpen, setPlayersSheetOpen] = useState(false);
  const [dropdownSheetButtonRect, setDropdownSheetButtonRect] = useState<{ top: number; left: number; bottom: number } | null>(null);
  const [mobileKpiSheet, setMobileKpiSheet] = useState<null | "submitted" | "highrisk">(null);
  const [playersGridExpanded, setPlayersGridExpanded] = useState(false);
  const playersSectionRef = useRef<HTMLDivElement>(null);
  const expandScrollLockRef = useRef<number | null>(null);
  const playersSheetDropdownRef = useRef<HTMLDivElement>(null);
  const dropdownOpenIdRef = useRef<string | null>(null);
  dropdownOpenIdRef.current = dropdownOpenId;
  const isMobile = useIsMobile();

  const [visualViewportBox, setVisualViewportBox] = useState<{ height: number; offsetTop: number }>(() =>
    typeof window !== "undefined" && window.visualViewport
      ? { height: window.visualViewport.height, offsetTop: window.visualViewport.offsetTop }
      : { height: 400, offsetTop: 0 }
  );
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const update = () => setVisualViewportBox({ height: vv.height, offsetTop: vv.offsetTop });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  const playersStatusSummaryItems = useMemo(() => {
    const counts: Record<string, number> = {};
    STATUS_OPTIONS.forEach((o) => { counts[o.value] = 0; });
    playersWithStatus.forEach((p) => {
      const s = statusOverrides[p.id] ?? p.status;
      if (counts[s] !== undefined) counts[s]++;
      else counts[s] = 1;
    });
    return STATUS_OPTIONS.filter((o) => (counts[o.value] ?? 0) > 0).map((o) => ({ label: o.label, count: counts[o.value] ?? 0, badgeClass: o.badgeClass }));
  }, [playersWithStatus, statusOverrides]);

  const playersAvailableCount = useMemo(() => {
    return playersWithStatus.filter((p) => (statusOverrides[p.id] ?? p.status) === "available").length;
  }, [playersWithStatus, statusOverrides]);

  const STATUS_ORDER = ["available", "limited", "unavailable", "injured", "rehab"] as const;
  const playersSortedByStatus = useMemo(() => {
    return [...playersWithStatus].sort((a, b) => {
      const statusA = statusOverrides[a.id] ?? a.status;
      const statusB = statusOverrides[b.id] ?? b.status;
      const iA = STATUS_ORDER.indexOf(statusA as (typeof STATUS_ORDER)[number]);
      const iB = STATUS_ORDER.indexOf(statusB as (typeof STATUS_ORDER)[number]);
      const orderA = iA === -1 ? 999 : iA;
      const orderB = iB === -1 ? 999 : iB;
      if (orderA !== orderB) return orderA - orderB;
      const nameA = (a.full_name && a.full_name.trim()) || a.email;
      const nameB = (b.full_name && b.full_name.trim()) || b.email;
      return nameA.localeCompare(nameB);
    });
  }, [playersWithStatus, statusOverrides]);

  const DESKTOP_PLAYERS_INITIAL = 16;
  const desktopPlayersToShow = useMemo(() => {
    if (playersSortedByStatus.length <= DESKTOP_PLAYERS_INITIAL) return playersSortedByStatus;
    return playersGridExpanded ? playersSortedByStatus : playersSortedByStatus.slice(0, DESKTOP_PLAYERS_INITIAL);
  }, [playersSortedByStatus, playersGridExpanded]);

  useLayoutEffect(() => {
    if (!playersGridExpanded || expandScrollLockRef.current === null) return;
    const saved = expandScrollLockRef.current;
    expandScrollLockRef.current = null;
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: saved, left: window.scrollX, behavior: "auto" });
      });
    });
    return () => cancelAnimationFrame(raf1);
  }, [playersGridExpanded]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const inRef = statusDropdownRef.current?.contains(target);
      const inSheetDropdown = playersSheetDropdownRef.current?.contains(target);
      if (inSheetDropdown) return;
      // Only close when click is OUTSIDE the ref; inside (option, Save, Change status) let button handlers run
      if (!inRef) {
        setDropdownOpenId(null);
        setAvatarMenuOpenId(null);
        setDropdownSheetButtonRect(null);
        setPlayersSheetOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!playersSheetOpen) return;
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
    };
  }, [playersSheetOpen]);

  useEffect(() => {
    if (!mobileKpiSheet) return;
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
    };
  }, [mobileKpiSheet]);

  useEffect(() => {
    if (!dropdownOpenId) return;
    const preventTouch = (e: TouchEvent) => {
      if (playersSheetDropdownRef.current && e.target instanceof Node && playersSheetDropdownRef.current.contains(e.target)) return;
      e.preventDefault();
    };
    document.addEventListener("touchmove", preventTouch, { passive: false });
    return () => document.removeEventListener("touchmove", preventTouch);
  }, [dropdownOpenId]);

  useEffect(() => {
    const el = scheduleFirstPartRef.current;
    if (!el) return;
    let ro: ResizeObserver | null = null;
    const updateWidth = () => {
      const w = el.getBoundingClientRect().width;
      if (w <= 0) return;
      const rounded = Math.round(w);
      setScheduleSegmentWidth((prev) => (prev !== rounded ? rounded : prev));
    };
    const rafId = requestAnimationFrame(() => {
      updateWidth();
      ro = new ResizeObserver(updateWidth);
      ro.observe(el);
    });
    return () => {
      cancelAnimationFrame(rafId);
      ro?.disconnect();
    };
  }, [todayScheduleItems]);

  const totalPlayers = metrics.totalPlayers ?? 0;
  const submitted = metrics.todayWellnessCount ?? 0;
  const avgWellness = metrics.todayWellness ?? null;
  const totalLoad = metrics.totalTeamLoadToday ?? 0;
  const atRisk = attentionToday?.atRisk ?? [];
  const missingWellness = attentionToday?.missingWellness ?? [];
  const missingCount = missingWellness.length;
  const atRiskCount = atRisk.length;
  const highRiskCount = atRiskCount;
  const missingIds = new Set((attentionToday?.missingWellness ?? []).map((m) => m.user_id));
  const submittedNames = (playersWithStatus ?? []).filter((p) => !missingIds.has(p.id)).map((p) => (p.full_name?.trim() || p.email) ?? "");

  const submissionPct = totalPlayers > 0 ? Math.round((submitted / totalPlayers) * 100) : 0;

  const wellnessColor =
    avgWellness == null
      ? "text-zinc-400"
      : avgWellness > 7
        ? "text-emerald-400"
        : avgWellness >= 5
          ? "text-amber-400"
          : "text-red-400";

  const isMatt = themeId === "matt";
  const isHighContrast = themeId === "neon" || themeId === "matt";

  const chartDataWellness =
    chart7.length > 0
      ? chart7.map((p) => ({
          date: formatDayShort(p.date),
          wellness: p.wellness ?? 0,
        }))
      : [];
  const chartDataLoad =
    chart7.length > 0
      ? chart7.map((p) => ({
          date: formatDayShort(p.date),
          load: p.load,
        }))
      : [];
  const donutData = [
    { name: "Submitted", value: submitted, color: "#10b981" },
    { name: "Missing", value: Math.max(0, totalPlayers - submitted), color: (themeId === "neon" || themeId === "matt") ? "#6b7280" : "#3f3f46" },
  ].filter((d) => d.value > 0);

  const chartGridStroke = isHighContrast ? "#4b5563" : "#27272a";
  const chartAxisStroke = isHighContrast ? "#9ca3af" : "#71717a";
  const chartTickStyle = isHighContrast ? { fill: "#e5e7eb", fontSize: 10 } : { fontSize: 10 };

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
      // Refetch later so override stays and card keeps showing new status (laptop)
      setTimeout(() => {
        onRefreshData?.();
        router.refresh();
      }, 100);
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
    setPendingNotes("");
    // Laptop: card switches to selected status immediately (preview)
    setStatusOverrides((prev) => ({ ...prev, [p.id]: value }));
  }

  async function onStatusSave(p: PlayerWithStatus, valueOverride?: string) {
    const valueToSave = valueOverride ?? pendingStatusValue;
    const notesTrimmed = pendingNotes.trim();
    const notesToSave =
      valueToSave !== p.status && !notesTrimmed ? null : (notesTrimmed || null);
    setDropdownOpenId(null);
    setDropdownSheetButtonRect(null);
    setStatusOverrides((prev) => ({ ...prev, [p.id]: valueToSave }));
    setPendingStatusPlayerId(null);
    setPendingStatusValue("");
    setPendingNotes("");
    await setPlayerStatus(p.id, valueToSave, notesToSave);
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
      className="min-h-screen min-w-0 -mx-4 overflow-x-hidden px-3 py-6 sm:mx-0 sm:px-6 sm:py-8 lg:px-8"
      style={{ backgroundColor: "var(--page-bg)" }}
    >
      <div className="mx-auto max-w-7xl space-y-4 md:space-y-8">
        <div
          className={
            isHighContrast
              ? "relative w-full overflow-hidden rounded-2xl border border-transparent px-4 py-3 flex flex-nowrap items-center justify-between gap-2 sm:px-6 sm:py-4 md:overflow-visible md:flex-wrap md:gap-4"
              : "w-full overflow-hidden rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 flex flex-nowrap items-center justify-between gap-2 md:overflow-visible md:flex-wrap md:gap-4"
          }
          style={
            themeId === "neon"
              ? {
                  backgroundImage:
                    "radial-gradient(circle at left, rgba(16, 185, 129, 0.26) 0, transparent 55%), linear-gradient(135deg, #041311, #020617)",
                  boxShadow:
                    "0 0 0 1px rgba(255,255,255,0.05), 0 0 0 1px rgba(16, 185, 129, 0.2), 0 5px 16px rgba(6, 95, 70, 0.08)",
                }
              : themeId === "matt"
                ? { ...MATT_CARD_STYLE, border: "1px solid rgba(255,255,255,0.2)", borderRadius: 16 }
                : undefined
          }
        >
          <p className="flex min-w-0 flex-1 items-center gap-2 truncate text-base font-bold tracking-tight text-white md:flex-initial md:text-2xl">
            <span className="truncate">Welcome, {userDisplayName ?? "User"}!</span>
            <span aria-hidden className="shrink-0">👋</span>
          </p>
          <div
            className="group relative ml-auto flex shrink-0 flex-col items-end md:-mr-2 lg:-mr-3"
            style={isHighContrast ? { textShadow: "0 1px 3px rgba(0,0,0,0.5)" } : undefined}
          >
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
            ) : (teamSettings?.team_name || teamSettings?.team_logo_url) ? (
              <>
                <div className="flex items-center justify-end gap-2 text-white">
                  {teamSettings?.team_name && (
                    <span className="hidden text-lg font-bold text-white md:inline">{teamSettings.team_name}</span>
                  )}
                  {teamSettings?.team_logo_url && (
                    <img
                      src={teamSettings?.team_logo_url}
                      alt="Team logo"
                      className="mt-0.5 h-8 w-auto object-contain md:h-10"
                    />
                  )}
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTeam(true);
                      setTeamNameInput(teamSettings?.team_name ?? "");
                      setTeamLogoInput(teamSettings?.team_logo_url ?? "");
                    }}
                    className="absolute top-full right-0 z-10 mt-0.5 rounded text-xs text-amber-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-amber-300 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-transparent"
                  >
                    Edit team
                  </button>
                )}
              </>
            ) : null}
          </div>
        </div>

        {/* Today's Schedule – horizontal timeline strip */}
        <section>
          <h2 className="mb-4 flex flex-wrap items-center gap-2 border-b border-zinc-700/80 pb-2 text-xl font-semibold text-white">
            <Calendar className="h-6 w-6 shrink-0 text-zinc-400 sm:h-7 sm:w-7" aria-hidden />
            <span>Today&apos;s Schedule</span>
            {todayScheduleItems.length > 0 && (
              <button
                type="button"
                onClick={() => setScheduleAutoPaused((p) => !p)}
                className={`ml-auto flex items-center justify-center rounded-lg p-1.5 transition-colors ${isHighContrast ? "text-white/90 hover:bg-white/10" : "text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"}`}
                aria-label={scheduleAutoPaused ? "Start auto-scroll" : "Stop auto-scroll"}
              >
                {scheduleAutoPaused ? <Play className="h-5 w-5 sm:h-6 sm:w-6" /> : <Pause className="h-5 w-5 sm:h-6 sm:w-6" />}
              </button>
            )}
          </h2>
          <div
            className="overflow-hidden rounded-xl border"
            style={{ backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS, borderColor: "var(--card-border)", contain: "layout paint" }}
          >
            {todayScheduleItems.length === 0 ? (
              <p className="rounded-lg bg-zinc-800/50 px-5 py-6 text-center text-zinc-400">No schedule items today.</p>
            ) : (
              <div
                className="schedule-strip-scroll cursor-pointer overflow-hidden px-6 py-4 sm:px-8"
                style={{ contain: "layout paint" }}
                role="button"
                tabIndex={0}
                onClick={() => setScheduleSheetOpen(true)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setScheduleSheetOpen(true)}
              >
                <div
                  className="schedule-ticker-track flex min-w-min flex-row"
                  style={{
                    ["--ticker-segment-width" as string]: scheduleSegmentWidth > 0 ? `${scheduleSegmentWidth}px` : "600px",
                    animationName: "schedule-ticker-scroll",
                    animationDuration: scheduleSegmentWidth > 0 ? `${scheduleSegmentWidth / 21}s` : "5s",
                    animationTimingFunction: "linear",
                    animationIterationCount: "infinite",
                    animationPlayState: scheduleAutoPaused ? "paused" : "running",
                    willChange: "transform",
                    backfaceVisibility: "hidden",
                  }}
                >
                  <div ref={scheduleFirstPartRef} className={`flex shrink-0 flex-row ${isHighContrast ? "gap-3 sm:gap-5" : "gap-3 sm:gap-4"}`}>
                    <div className="flex shrink-0 items-center justify-center px-8 py-2 sm:px-10" aria-hidden>
                      <div
                        className="relative h-20 w-px shrink-0"
                        style={{
                          background: "linear-gradient(to bottom, rgba(255,255,255,0.55) 0%, rgba(16,185,129,0.45) 35%, rgba(16,185,129,0.45) 65%, rgba(255,255,255,0.55) 100%)",
                          boxShadow: "0 0 12px rgba(16,185,129,0.4), 0 0 6px rgba(16,185,129,0.3)",
                        }}
                      >
                        <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/50" aria-hidden />
                      </div>
                    </div>
                    {todayScheduleItems.map((item, idx) => {
                    const SCHEDULE_LABELS: Record<string, string> = {
                      arrival: "Arrival",
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
                          ? `${item.start_time} – ${item.end_time}`
                          : item.start_time
                        : "—";
                    const notes = item.notes?.trim();
                    const isMatch = item.activity_type === "match";
                    if (themeId === "neon") {
                      return (
                        <div
                          key={`${item.id}-${idx}`}
                          className={`flex shrink-0 rounded-xl border border-transparent shadow-[var(--card-shadow)] transition-all duration-200 hover:translate-y-[-1px] hover:shadow-[var(--card-shadow-hover)] ${isMatch ? "w-44 sm:w-52" : "w-40 sm:w-44"}`}
                          style={dashboardNeonCardStyle(item.activity_type, isMatch)}
                        >
                          <div className="schedule-card-text min-w-0 flex-1 space-y-1 px-3 py-2.5 sm:space-y-1.5">
                            <p
                              className={`tabular-nums font-bold text-sm sm:text-base tracking-[0.03em] ${isMatch ? "text-amber-700" : "text-emerald-300"}`}
                            >
                              {item.start_time}
                              {item.end_time != null ? <span className="inline-block px-1.5">–</span> : null}
                              {item.end_time != null ? item.end_time : null}
                            </p>
                            <p className="flex items-center gap-2 text-sm font-medium text-white">
                              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 ${dashboardIconBgClass(item.activity_type)}`}>
                                <ScheduleIcon type={item.activity_type} size={22} className="shrink-0 text-white/90" />
                              </span>
                              <span>{label}</span>
                            </p>
                            {notes ? (
                              <p className="flex items-center gap-2 text-[11px] text-white/60">
                                <LocationPinIcon className="h-4 w-4 shrink-0 text-white/60" aria-hidden />
                                {notes}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      );
                    }
                    if (themeId === "matt") {
                      return (
                        <div
                          key={`${item.id}-${idx}`}
                          className={`flex shrink-0 rounded-xl border border-transparent transition-all duration-200 hover:translate-y-[-1px] ${isMatch ? "w-44 sm:w-52" : "w-40 sm:w-44"}`}
                          style={
                            isMatch
                              ? {
                                  backgroundImage:
                                    "radial-gradient(circle at left, rgba(251, 191, 36, 0.28) 0, transparent 55%), linear-gradient(135deg, #141006, #0a0802)",
                                  boxShadow:
                                    "0 0 0 1px rgba(255,255,255,0.2), 0 0 0 1px rgba(251, 191, 36, 0.2), 0 5px 16px rgba(180, 83, 9, 0.08)",
                                  borderRadius: 12,
                                }
                              : { ...MATT_CARD_STYLE, borderRadius: 12 }
                          }
                        >
                          <div className="matt-card-text min-w-0 flex-1 space-y-1 px-3 py-2.5 sm:space-y-1.5">
                            <p
                              className={`tabular-nums font-bold text-sm sm:text-base ${isMatch ? "text-amber-700" : "text-emerald-300"}`}
                            >
                              {timeStr}
                            </p>
                            <p className="flex items-center gap-2 text-sm font-medium text-white">
                              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 ${dashboardIconBgClass(item.activity_type)}`}>
                                <ScheduleIcon type={item.activity_type} size={22} className="shrink-0 text-white/90" />
                              </span>
                              <span>{label}</span>
                            </p>
                            {notes ? (
                              <p className="flex items-center gap-2 text-[11px] text-white/60">
                                <LocationPinIcon className="h-4 w-4 shrink-0 text-white/60" aria-hidden />
                                {notes}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={`${item.id}-${idx}`}
                        className={`flex shrink-0 rounded-lg border border-zinc-700/80 shadow-[var(--card-shadow)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[var(--card-shadow-hover)] ${
                          isMatch
                            ? "w-40 border-l-[6px] border-l-amber-500/70 bg-amber-500/10 hover:border-l-amber-500/90 sm:w-48"
                            : "w-36 border-l-4 border-l-emerald-500/60 bg-zinc-800/80 hover:border-l-emerald-500/90 sm:w-40"
                        }`}
                      >
                        <div className="min-w-0 flex-1 px-3 py-2.5">
                          <p
                            className={`tabular-nums font-bold text-sm sm:text-base ${isMatch ? "text-amber-700" : "text-emerald-300"}`}
                          >
                            {timeStr}
                          </p>
                          <p className={`mt-1 flex items-center gap-2 font-medium text-zinc-300 ${isMatch ? "text-sm" : "text-xs"}`}>
                            <span className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 ${dashboardIconBgClass(item.activity_type)}`}>
                              <ScheduleIcon type={item.activity_type} size={22} className="shrink-0" />
                            </span>
                            <span>{label}</span>
                          </p>
{notes ? (
                              <p className="mt-1 flex items-center gap-2 text-[11px] text-zinc-600">
                                <LocationPinIcon className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
                                {notes}
                              </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  </div>
                  <div className={`flex shrink-0 flex-row ${isHighContrast ? "gap-3 sm:gap-5" : "gap-3 sm:gap-4"}`} aria-hidden>
                    <div className="flex shrink-0 items-center justify-center px-8 py-2 sm:px-10">
                      <div className="relative h-20 w-px shrink-0" style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.55) 0%, rgba(16,185,129,0.45) 35%, rgba(16,185,129,0.45) 65%, rgba(255,255,255,0.55) 100%)", boxShadow: "0 0 12px rgba(16,185,129,0.4), 0 0 6px rgba(16,185,129,0.3)" }}>
                        <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/50" aria-hidden />
                      </div>
                    </div>
                    {todayScheduleItems.map((item, idx) => {
                      const SCHEDULE_LABELS_DUP: Record<string, string> = { arrival: "Arrival", breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", training: "Training", gym: "Gym", recovery: "Recovery", pre_activation: "Pre-activation", video_analysis: "Video analysis", meeting: "Meeting", traveling: "Traveling", physio: "Physio", medical: "Medical", media: "Media", rest_off: "Rest/Off", match: "Match", team_building: "Team building", individual: "Individual" };
                      const baseLabel = SCHEDULE_LABELS_DUP[item.activity_type] ?? item.activity_type;
                      const label = item.activity_type === "match" && item.team_a?.trim() && item.team_b?.trim() ? `${item.team_a.trim()} vs. ${item.team_b.trim()}` : item.activity_type === "match" && item.opponent?.trim() ? `${baseLabel} vs. ${item.opponent.trim()}` : baseLabel;
                      const timeStr = item.start_time != null ? (item.end_time != null ? `${item.start_time} – ${item.end_time}` : item.start_time) : "—";
                      const notes = item.notes?.trim();
                      const isMatch = item.activity_type === "match";
                      if (themeId === "neon") return (
                        <div
                          key={`dup-${item.id}-${idx}`}
                          className={`flex shrink-0 rounded-xl border border-transparent shadow-[var(--card-shadow)] ${isMatch ? "w-44 sm:w-52" : "w-40 sm:w-44"}`}
                          style={dashboardNeonCardStyle(item.activity_type, isMatch)}
                        >
                          <div className="schedule-card-text min-w-0 flex-1 space-y-1 px-3 py-2.5 sm:space-y-1.5">
                            <p className={`tabular-nums font-bold text-sm sm:text-base tracking-[0.03em] ${isMatch ? "text-amber-700" : "text-emerald-300"}`}>{item.start_time}{item.end_time != null ? <span className="inline-block px-1.5">–</span> : null}{item.end_time != null ? item.end_time : null}</p>
                            <p className="flex items-center gap-2 text-sm font-medium text-white">
                              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 ${dashboardIconBgClass(item.activity_type)}`}>
                                <ScheduleIcon type={item.activity_type} size={22} className="shrink-0 text-white/90" />
                              </span>
                              <span>{label}</span>
                            </p>
                            {notes ? <p className="flex items-center gap-2 text-[11px] text-white/60"><LocationPinIcon className="h-4 w-4 shrink-0 text-white/60" aria-hidden />{notes}</p> : null}
                          </div>
                        </div>
                      );
                      if (themeId === "matt") return (
                        <div key={`dup-${item.id}-${idx}`} className={`flex shrink-0 rounded-xl border border-transparent ${isMatch ? "w-44 sm:w-52" : "w-40 sm:w-44"}`} style={isMatch ? { backgroundImage: "radial-gradient(circle at left, rgba(251, 191, 36, 0.28) 0, transparent 55%), linear-gradient(135deg, #141006, #0a0802)", boxShadow: "0 0 0 1px rgba(255,255,255,0.2), 0 0 0 1px rgba(251, 191, 36, 0.2), 0 5px 16px rgba(180, 83, 9, 0.08)", borderRadius: 12 } : { ...MATT_CARD_STYLE, borderRadius: 12 }}>
                          <div className="matt-card-text min-w-0 flex-1 space-y-1 px-3 py-2.5 sm:space-y-1.5">
                            <p className={`tabular-nums font-bold text-sm sm:text-base ${isMatch ? "text-amber-700" : "text-emerald-300"}`}>{timeStr}</p>
                            <p className="flex items-center gap-2 text-sm font-medium text-white">
                              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 ${dashboardIconBgClass(item.activity_type)}`}>
                                <ScheduleIcon type={item.activity_type} size={22} className="shrink-0 text-white/90" />
                              </span>
                              <span>{label}</span>
                            </p>
                            {notes ? <p className="flex items-center gap-2 text-[11px] text-white/60"><LocationPinIcon className="h-4 w-4 shrink-0 text-white/60" aria-hidden />{notes}</p> : null}
                          </div>
                        </div>
                      );
                      return (
                        <div key={`dup-${item.id}-${idx}`} className={`flex shrink-0 rounded-lg border border-zinc-700/80 shadow-[var(--card-shadow)] ${isMatch ? "w-40 border-l-[6px] border-l-amber-500/70 bg-amber-500/10 sm:w-48" : "w-36 border-l-4 border-l-emerald-500/60 bg-zinc-800/80 sm:w-40"}`}>
                          <div className="min-w-0 flex-1 px-3 py-2.5">
                            <p className={`tabular-nums font-bold text-sm sm:text-base ${isMatch ? "text-amber-700" : "text-emerald-300"}`}>{timeStr}</p>
                            <p className={`mt-1 flex items-center gap-2 font-medium text-zinc-300 ${isMatch ? "text-sm" : "text-xs"}`}><ScheduleIcon type={item.activity_type} size={28} className="shrink-0" /><span>{label}</span></p>
                            {notes ? <p className="mt-1 flex items-center gap-2 text-[11px] text-zinc-600"><LocationPinIcon className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden />{notes}</p> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <ScheduleBottomSheet
          open={scheduleSheetOpen}
          onClose={() => setScheduleSheetOpen(false)}
          items={todayScheduleItems}
          themeId={themeId ?? "dark"}
        />

        {/* PLAYERS – ID cards (desktop) / summary + sheet (mobile) */}
        {playersWithStatus.length > 0 && (
          <div
            ref={(el) => {
              statusDropdownRef.current = el;
              playersSectionRef.current = el;
            }}
          >
            <h2 className="relative mb-3 flex items-center gap-2 border-b border-zinc-700/80 pb-2 text-xl font-semibold text-white md:mb-4">
              <Users className="h-5 w-5 shrink-0 text-zinc-400" aria-hidden />
              <span>Players</span>
              <span
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 rounded-full border border-emerald-500/25 bg-gradient-to-r from-emerald-500/10 to-zinc-800/90 px-2.5 py-1 text-xs font-medium shadow-[0_1px_2px_rgba(0,0,0,0.2)] ring-1 ring-emerald-400/10 md:gap-1.5 md:px-4 md:py-2 md:text-sm"
              >
                <span className="tabular-nums font-semibold text-emerald-400">{playersAvailableCount}</span>
                <span className="text-zinc-500">/</span>
                <span className="tabular-nums text-zinc-300">{playersWithStatus.length}</span>
                <span className="ml-0.5 text-zinc-500">available</span>
              </span>
            </h2>
            {statusError && (
              <p className="mb-2 text-sm text-red-400">{statusError}</p>
            )}
            {/* Mobile only: summary (themed) + open sheet */}
            <div className="md:hidden">
              <div className="mb-3 flex flex-wrap items-center gap-1.5 text-sm">
                {playersStatusSummaryItems.map((item) => (
                  <span key={item.label} className={`rounded px-2 py-0.5 text-xs font-medium ${item.badgeClass}`}>
                    {item.count} {item.label}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPlayersSheetOpen(true)}
                className={`w-full rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                  themeId === "neon"
                    ? "border border-emerald-500/30 bg-emerald-500/10 text-white hover:bg-emerald-500/15"
                    : themeId === "matt"
                      ? "border border-white/20 bg-white/5 text-white hover:bg-white/10"
                      : themeId === "red"
                          ? "border border-red-500/30 bg-red-500/10 text-white hover:bg-red-500/15"
                          : themeId === "blue"
                            ? "border border-blue-500/30 bg-blue-500/10 text-white hover:bg-blue-500/15"
                            : "border border-zinc-600 bg-zinc-800/80 text-white hover:bg-zinc-700"
                }`}
              >
                All players
              </button>
            </div>
            {/* Desktop: full grid – first 16 visible, rest expandable; shadow on card bottoms only */}
            <div className="relative hidden md:block [overflow-anchor:none]">
              <div
                className={`relative overflow-hidden transition-[max-height] duration-300 ease-out motion-reduce:duration-0 ${
                  playersSortedByStatus.length > DESKTOP_PLAYERS_INITIAL
                    ? playersGridExpanded
                      ? "max-h-[2000px]"
                      : "max-h-[560px]"
                    : "max-h-none"
                }`}
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
                  {desktopPlayersToShow.map((p) => {
                const effectiveStatus = statusOverrides[p.id] ?? p.status;
                const { pillClass, badgeClass, label, ringClass, tintClass, borderLClass } = getStatusStyle(effectiveStatus);
                const displayName = (p.full_name && p.full_name.trim()) || p.email;
                const avatarUrl = avatarOverrides[p.id] ?? p.avatar_url ?? null;
                const monogram = (displayName[0] ?? "?").toUpperCase();
                const isSaving = savingPlayerId === p.id;
                const isOpen = dropdownOpenId === p.id;
                const isAvatarMenuOpen = avatarMenuOpenId === p.id;
                const statusCardStyle = isHighContrast ? getStatusCardStyle(themeId, effectiveStatus) : null;
                return (
                  <div
                    key={p.id}
                    className={`relative flex min-w-0 overflow-hidden rounded-xl border-l-4 border transition-all duration-200 hover:scale-[1.02] hover:shadow-[var(--card-shadow-hover)] sm:overflow-visible ${borderLClass} ${ringClass} ${isOpen || isAvatarMenuOpen ? "z-30" : ""}`}
                    style={
                      statusCardStyle
                        ? { ...statusCardStyle, borderRadius: CARD_RADIUS }
                        : {
                            backgroundColor: "var(--card-bg)",
                            borderRadius: CARD_RADIUS,
                            borderColor: "var(--card-border)",
                            boxShadow: "var(--card-shadow)",
                          }
                    }
                  >
                    {!isHighContrast && (
                      <div className="absolute inset-0 overflow-hidden rounded-xl" aria-hidden>
                        <div className={`pointer-events-none absolute inset-0 rounded-xl ${tintClass}`} />
                        <div
                          className="pointer-events-none absolute inset-0 rounded-xl opacity-60"
                          style={{
                            background: "linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 50%)",
                          }}
                        />
                      </div>
                    )}
                    <div
                      className={`relative z-10 flex min-w-0 flex-1 items-center gap-2 overflow-visible p-3 sm:items-start sm:gap-3 sm:p-4 ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
                    >
                      <div className={`relative shrink-0 ${isAvatarMenuOpen ? "z-[105]" : ""}`}>
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
                              className={`relative block h-10 w-10 overflow-hidden rounded-full bg-zinc-700 ring-2 ring-zinc-600 transition-shadow hover:ring-emerald-500/50 md:h-12 md:w-12 ${deletingAvatarId === p.id ? "opacity-70" : ""}`}
                              title="Photo options"
                            >
                              {avatarUrl ? (
                                <img
                                  src={avatarUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div
                                  className={`flex h-full w-full items-center justify-center text-lg font-semibold ${isHighContrast ? "text-white/80" : "text-zinc-400"}`}
                                >
                                  {monogram}
                                </div>
                              )}
                            </button>
                            {isAvatarMenuOpen && (
                              <div className="absolute left-0 top-full z-[110] mt-1 min-w-[160px] rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
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
                              <div className="relative h-10 w-10 overflow-hidden rounded-full bg-zinc-700 ring-2 ring-zinc-600 md:h-12 md:w-12">
                                {avatarUrl ? (
                                  <img
                                    src={avatarUrl}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div
                                    className={`flex h-full w-full items-center justify-center text-lg font-semibold ${isHighContrast ? "text-white/80" : "text-zinc-400"}`}
                                  >
                                    {monogram}
                                  </div>
                                )}
                              </div>
                            )}
                      </div>
                      <div className="min-w-0 flex-1 overflow-hidden md:overflow-visible">
                        <p className="truncate font-medium text-white">{displayName}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 sm:mt-2 sm:gap-2">
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
                            {label}
                          </span>
                          {isAdmin && (
                            <div className="relative z-[100] inline-block">
                              <button
                                type="button"
                                onClick={() => {
                                  setAvatarMenuOpenId(null);
                                  setStatusError(null);
                                  setPendingStatusPlayerId(null);
                                  setDropdownOpenId(isOpen ? null : p.id);
                                }}
                                disabled={isSaving}
                                className={`rounded border px-2 py-0.5 text-xs disabled:opacity-50 ${isHighContrast ? "border-white/30 bg-white/10 text-white/90 hover:bg-white/20" : "border-zinc-600 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
                              >
                                {isSaving ? "Saving…" : "Change status ▾"}
                              </button>
                              {isOpen && (
                                <div className="absolute left-0 top-full z-[100] mt-1 w-72 rounded-lg border border-zinc-700 bg-zinc-900 p-2 shadow-xl">
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
                                            setStatusOverrides((prev) => {
                                              const next = { ...prev };
                                              delete next[p.id];
                                              return next;
                                            });
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
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onStatusSave(p, pendingStatusValue);
                                          }}
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
                          <p
                            className={`mt-1.5 line-clamp-2 text-xs ${isHighContrast ? "text-white/90" : "text-zinc-500"}`}
                            title={p.status_notes}
                          >
                            {p.status_notes}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
                </div>
                {!playersGridExpanded && playersSortedByStatus.length > DESKTOP_PLAYERS_INITIAL && (
                  <div
                    className="pointer-events-none absolute bottom-0 left-0 right-0 h-24"
                    style={{
                      background: "linear-gradient(to top, rgba(24,24,28,0.85) 0%, rgba(24,24,28,0.5) 50%, transparent 100%)",
                    }}
                    aria-hidden
                  />
                )}
              </div>
              {playersSortedByStatus.length > DESKTOP_PLAYERS_INITIAL && (
                <button
                  type="button"
                  onClick={() => {
                    const wasExpanded = playersGridExpanded;
                    if (!wasExpanded) expandScrollLockRef.current = window.scrollY;
                    setPlayersGridExpanded((e) => !e);
                    if (wasExpanded) {
                      setTimeout(() => {
                        playersSectionRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
                      }, 320);
                    }
                  }}
                  className="relative z-10 mt-2 flex w-full items-center justify-center rounded-full border border-white/10 bg-white/5 py-2 text-white outline-none transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
                  aria-label={playersGridExpanded ? "Show less" : "Show more"}
                >
                  {playersGridExpanded ? (
                    <ChevronUp className="h-6 w-6" />
                  ) : (
                    <ChevronDown className="h-6 w-6" />
                  )}
                </button>
              )}
            </div>

            {/* Mobile only: Players bottom sheet */}
            {playersSheetOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 overflow-hidden md:hidden"
                  style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.98) 50%, black 100%)", touchAction: "none" }}
                  aria-hidden
                  onTouchMove={(e) => e.preventDefault()}
                  onClick={() => {
                    setPlayersSheetOpen(false);
                    setDropdownOpenId(null);
                    setDropdownSheetButtonRect(null);
                  }}
                />
                <div
                  className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[85vh] flex-col overflow-hidden rounded-t-2xl border-t border-zinc-700/80 shadow-2xl md:hidden"
                  style={{
                    height: "calc(85vh + env(safe-area-inset-bottom, 0px))",
                    minHeight: "85vh",
                    paddingBottom: "env(safe-area-inset-bottom, 0px)",
                    ...(themeId === "neon"
                      ? { background: "linear-gradient(135deg, #041311, #020617)", borderColor: "rgba(255,255,255,0.08)" }
                      : themeId === "matt"
                        ? { ...MATT_CARD_STYLE, borderColor: "rgba(255,255,255,0.2)" }
                        : { backgroundColor: "var(--card-bg)" }),
                  }}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="players-sheet-title"
                >
                  <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
                    <h2 id="players-sheet-title" className="flex items-center gap-2 text-lg font-semibold text-white">
                      <Users className="h-5 w-5 shrink-0 text-white/90" aria-hidden />
                      All players
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setPlayersSheetOpen(false);
                        setDropdownOpenId(null);
                        setDropdownSheetButtonRect(null);
                      }}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10"
                      aria-label="Close"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div
                    className="flex-1 overflow-y-auto overscroll-contain p-4 pb-8"
                    style={{
                      paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
                      minHeight: 0,
                      ...(themeId === "neon"
                        ? { background: "linear-gradient(135deg, #041311, #020617)" }
                        : themeId === "matt"
                          ? MATT_CARD_STYLE
                          : { backgroundColor: "var(--card-bg)" }),
                    }}
                  >
                    <ul className="flex flex-col gap-2">
                      {playersSortedByStatus.map((p) => {
                        const effectiveStatus = statusOverrides[p.id] ?? p.status;
                        const { badgeClass, label, borderLClass } = getStatusStyle(effectiveStatus);
                        const displayName = (p.full_name && p.full_name.trim()) || p.email;
                        const avatarUrl = avatarOverrides[p.id] ?? p.avatar_url ?? null;
                        const monogram = (displayName[0] ?? "?").toUpperCase();
                        const isSaving = savingPlayerId === p.id;
                        const isOpen = dropdownOpenId === p.id;
                        const statusCardStyle = isHighContrast ? getStatusCardStyle(themeId, effectiveStatus) : null;
                        return (
                          <li
                            key={p.id}
                            className={`flex items-center gap-3 rounded-xl border-l-4 py-2.5 pr-2 pl-3 ${isOpen ? "z-10" : ""} ${!statusCardStyle ? borderLClass : ""}`}
                            style={
                              statusCardStyle
                                ? { ...statusCardStyle, borderRadius: 10 }
                                : { backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }
                            }
                          >
                            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-zinc-700 ring-2 ring-zinc-600">
                              {avatarUrl ? (
                                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className={`flex h-full w-full items-center justify-center text-sm font-semibold ${isHighContrast ? "text-white/80" : "text-zinc-400"}`}>
                                  {monogram}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-white">{displayName}</p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                <span className={`rounded px-2 py-0.5 text-xs font-medium ${badgeClass}`}>{label}</span>
                                {isAdmin && (
                                  <div className="relative inline-block">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        setAvatarMenuOpenId(null);
                                        setStatusError(null);
                                        setPendingStatusPlayerId(null);
                                        const opening = !isOpen;
                                        setDropdownOpenId(opening ? p.id : null);
                                        if (opening) {
                                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                          setDropdownSheetButtonRect({ top: rect.top, left: rect.left, bottom: rect.bottom });
                                        } else {
                                          setDropdownSheetButtonRect(null);
                                        }
                                      }}
                                      disabled={isSaving}
                                      className={`rounded border px-2 py-0.5 text-xs disabled:opacity-50 ${isHighContrast ? "border-white/30 bg-white/10 text-white/90 hover:bg-white/20" : "border-zinc-600 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
                                    >
                                      {isSaving ? "Saving…" : "Status ▾"}
                                    </button>
                                    {/* In-sheet dropdown is rendered via portal below so it is not clipped */}
                                  </div>
                                )}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
                {/* Portal: status dropdown so it is not clipped by sheet scroll (mobile) */}
                {playersSheetOpen &&
                  dropdownOpenId &&
                  dropdownSheetButtonRect &&
                  (() => {
                    const p = playersWithStatus.find((x) => x.id === dropdownOpenId);
                    if (!p) return null;
                    const effectiveStatus = statusOverrides[p.id] ?? p.status;
                    const isNotesStep = pendingStatusPlayerId === p.id;
                    const vv = visualViewportBox;
                    const winW = typeof window !== "undefined" ? window.innerWidth : 400;
                    const spaceBelow = vv.offsetTop + vv.height - (dropdownSheetButtonRect.bottom + 4) - 16;
                    const spaceAbove = dropdownSheetButtonRect.top - vv.offsetTop - 8 - 16;
                    const openAbove = spaceBelow < 220 && spaceAbove >= 120;
                    const optionsMaxH = openAbove
                      ? Math.max(120, Math.min(200, spaceAbove))
                      : Math.max(120, Math.min(320, spaceBelow));
                    const gap = openAbove ? 0 : 2;
                    const optionsTop = openAbove
                      ? dropdownSheetButtonRect.top - optionsMaxH - gap
                      : Math.max(vv.offsetTop + 8, dropdownSheetButtonRect.bottom + gap);
                    return createPortal(
                      <div
                        ref={playersSheetDropdownRef}
                        className={`fixed z-[100] rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl ${isNotesStep ? "w-[min(92vw,340px)] p-3 pb-4" : "w-64 overflow-y-auto rounded-lg p-2"}`}
                        style={{
                          top: isNotesStep ? Math.max(12, vv.offsetTop + 8) : optionsTop,
                          left: isNotesStep
                            ? "50%"
                            : Math.max(8, Math.min(dropdownSheetButtonRect.left, winW - 272)),
                          transform: isNotesStep ? "translateX(-50%)" : undefined,
                          maxHeight: isNotesStep ? Math.min(320, vv.height - 40) : optionsMaxH,
                          overflow: isNotesStep ? "visible" : undefined,
                        }}
                      >
                        {isNotesStep ? (
                          <div className="flex min-h-0 flex-col">
                            <p className="mb-1.5 shrink-0 text-xs text-zinc-400">
                              Status: <span className="font-semibold text-white">{STATUS_OPTIONS.find((o) => o.value === pendingStatusValue)?.label ?? pendingStatusValue}</span>
                            </p>
                            <label className="mb-1 shrink-0 text-xs font-medium text-zinc-400">Notes (optional)</label>
                            <textarea
                              value={pendingNotes}
                              onChange={(e) => setPendingNotes(e.target.value)}
                              placeholder="e.g. ankle, 2 weeks"
                              rows={2}
                              className="mb-3 shrink-0 w-full resize-none rounded-lg border border-zinc-600 bg-zinc-800 px-2.5 py-2 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
                            />
                            <div className="flex shrink-0 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setPendingStatusPlayerId(null);
                                  setPendingStatusValue("");
                                  setPendingNotes("");
                                }}
                                className="flex-1 rounded-lg border border-zinc-600 px-3 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
                              >
                                Back
                              </button>
                              <button
                                type="button"
                                onClick={() => onStatusSave(p)}
                                className="flex-1 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
                              >
                                Save
                              </button>
                            </div>
                          </div>
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
                      </div>,
                      document.body
                    );
                  })()}
              </>
            )}
          </div>
        )}

        {/* SECTION 1 – TOP KPI ROW */}
        {/* Mobile: 2×2 circles with circular progress strip (ring) on edge; High risk = red ring */}
        {(() => {
          const R = 17;
          const C = 2 * Math.PI * R;
          const ringStroke = 3;
          const trackColor = themeId === "neon" ? "rgba(255,255,255,0.12)" : themeId === "matt" ? "rgba(255,255,255,0.08)" : "#3f3f46";
          const greenColor = themeId === "neon" ? "#10b981" : themeId === "matt" ? "rgba(255,255,255,0.35)" : "#22c55e";
          const redColor = themeId === "neon" ? "#ef4444" : themeId === "matt" ? "rgba(239,68,68,0.8)" : "#ef4444";
          const pctSubmitted = totalPlayers ? (submitted / totalPlayers) * 100 : 0;
          const pctWellness = avgWellness != null ? Math.min(100, (avgWellness / 10) * 100) : 0;
          const pctLoad = 0;
          return (
            <div
              className={`mt-6 border-t pt-6 md:mt-0 md:border-t-0 md:pt-0 ${isHighContrast ? "border-white/15" : "border-zinc-700/80"}`}
            >
              <p className={`mb-4 text-center text-xs font-medium uppercase tracking-wide md:hidden ${isHighContrast ? "text-white/60" : "text-zinc-500"}`}>
                Today
              </p>
              <div className="grid grid-cols-2 gap-6 md:hidden">
              {[
                {
                  pct: pctSubmitted,
                  stroke: greenColor,
                  label: "Submitted",
                  value: `${submitted}/${totalPlayers}`,
                  innerBg: themeId === "neon" ? "rgba(16,185,129,0.12)" : themeId === "matt" ? "rgba(255,255,255,0.06)" : undefined,
                },
                {
                  pct: pctWellness,
                  stroke: greenColor,
                  label: "Wellness",
                  value: avgWellness != null ? avgWellness.toFixed(1) : "—",
                  innerBg: themeId === "neon" ? "rgba(16,185,129,0.12)" : themeId === "matt" ? "rgba(255,255,255,0.06)" : undefined,
                },
                {
                  pct: pctLoad,
                  stroke: greenColor,
                  label: "Load",
                  value: String(totalLoad),
                  innerBg: themeId === "neon" ? "rgba(16,185,129,0.12)" : themeId === "matt" ? "rgba(255,255,255,0.06)" : undefined,
                },
                {
                  pct: highRiskCount > 0 ? 100 : 0,
                  stroke: redColor,
                  label: "High risk",
                  value: String(highRiskCount),
                  innerBg: highRiskCount > 0 ? (themeId === "neon" ? "rgba(239,68,68,0.12)" : themeId === "matt" ? "rgba(239,68,68,0.08)" : "rgba(239,68,68,0.1)") : themeId === "neon" ? "rgba(16,185,129,0.12)" : themeId === "matt" ? "rgba(255,255,255,0.06)" : undefined,
                },
              ].map((item, idx) => {
                const isSubmitted = idx === 0;
                const isHighRisk = idx === 3;
                const isTappable = isSubmitted || isHighRisk;
                const Wrapper = isTappable ? "button" : "div";
                const wrapperProps = isTappable
                  ? {
                      type: "button" as const,
                      onClick: () => setMobileKpiSheet(isSubmitted ? "submitted" : "highrisk"),
                      className: "flex flex-col items-center touch-manipulation cursor-pointer text-left md:cursor-default",
                    }
                  : { className: "flex flex-col items-center" };
                return (
                  <Wrapper key={idx} {...wrapperProps}>
                    <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
                      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 40 40">
                        <circle cx="20" cy="20" r={R} fill="none" stroke={trackColor} strokeWidth={ringStroke} />
                        <circle
                          cx="20"
                          cy="20"
                          r={R}
                          fill="none"
                          stroke={item.stroke}
                          strokeWidth={ringStroke}
                          strokeLinecap="round"
                          strokeDasharray={`${(item.pct / 100) * C} ${C}`}
                          strokeDashoffset={0}
                        />
                      </svg>
                      <div
                        className={`relative z-10 flex h-14 w-14 items-center justify-center rounded-full text-base font-bold tabular-nums text-white ${!item.innerBg ? "bg-zinc-800/95" : ""}`}
                        style={item.innerBg ? { backgroundColor: item.innerBg } : undefined}
                      >
                        {item.value}
                      </div>
                    </div>
                    <p className={`mt-2 text-center text-xs font-medium ${isHighContrast ? "text-white/85" : "text-zinc-400"}`}>
                      {item.label}
                    </p>
                  </Wrapper>
                );
              })}
              </div>
            </div>
          );
        })()}

        {/* Mobile only: centered modal for Who submitted / High risk; background not scrollable */}
        {mobileKpiSheet && (
          <>
            <div
              className="fixed inset-0 z-40 overflow-hidden md:hidden"
              style={{
                background: "linear-gradient(to bottom, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.98) 50%, black 100%)",
                touchAction: "none",
                overflow: "hidden",
              }}
              aria-hidden
              onTouchMove={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={() => setMobileKpiSheet(null)}
            />
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 md:hidden"
              role="dialog"
              aria-modal="true"
              aria-labelledby="kpi-sheet-title"
              onClick={(e) => e.target === e.currentTarget && setMobileKpiSheet(null)}
            >
              <div
                className="flex max-h-[70vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-zinc-700/80 shadow-2xl"
                style={{
                  ...(themeId === "neon"
                    ? { background: "linear-gradient(135deg, #041311, #020617)", borderColor: "rgba(255,255,255,0.08)" }
                    : themeId === "matt"
                      ? { ...MATT_CARD_STYLE, borderColor: "rgba(255,255,255,0.2)" }
                      : { backgroundColor: "var(--card-bg)" }),
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={`flex items-center justify-between border-b px-4 py-3 ${isHighContrast ? "border-white/10" : "border-zinc-700/80"}`}>
                  <h2 id="kpi-sheet-title" className="flex items-center gap-2 text-lg font-semibold text-white">
                    {mobileKpiSheet === "submitted" ? (
                      <>
                        <CheckCircle className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
                        Who submitted
                      </>
                    ) : (
                      <>
                        <Flag className="h-5 w-5 shrink-0 text-red-400" aria-hidden />
                        High risk
                      </>
                    )}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setMobileKpiSheet(null)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4"
                  style={
                    themeId === "neon"
                      ? { background: "linear-gradient(135deg, #041311, #020617)" }
                      : themeId === "matt"
                        ? MATT_CARD_STYLE
                        : { backgroundColor: "var(--card-bg)" }
                  }
                >
                  {mobileKpiSheet === "submitted" ? (
                    <p className={`text-sm leading-relaxed ${isHighContrast ? "text-white/90" : "text-zinc-300"}`}>
                      {submittedNames.length > 0 ? submittedNames.join(", ") : "—"}
                    </p>
                  ) : (
                    <div className={`space-y-3 text-sm ${isHighContrast ? "text-white/90" : "text-zinc-300"}`}>
                      {atRisk.length > 0 ? (
                        atRisk.map((p) => (
                          <div key={p.user_id} className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                            <p className="font-medium text-white">{p.full_name?.trim() || p.email}</p>
                            {p.reason && (
                              <p className={`mt-1 text-xs ${isHighContrast ? "text-red-300/90" : "text-red-400/90"}`}>
                                {p.reason}
                              </p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p>—</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Desktop: full KPI cards */}
        <div className="hidden grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:grid">
          <div
            className={`w-full rounded-xl p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-[var(--card-shadow-hover)] md:p-5 ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
            style={
              themeId === "neon"
                ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
                : themeId === "matt"
                  ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS }
                  : { backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS, boxShadow: "var(--card-shadow)" }
            }
          >
            <p className={`flex min-w-0 items-center gap-2 text-sm font-medium ${isHighContrast ? "text-white/90" : "text-zinc-400"}`}>
              <span className="shrink-0 text-emerald-400" aria-hidden>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              </span>
              <span className="truncate">Players Submitted Today</span>
            </p>
            <p className="mt-2 text-lg font-bold tabular-nums text-white sm:text-2xl">
              {submitted} <span className={isHighContrast ? "text-white/70" : "text-zinc-500"}>/ {totalPlayers}</span>
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
            className={`w-full rounded-xl p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-[var(--card-shadow-hover)] md:p-5 ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
            style={
              themeId === "neon"
                ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
                : themeId === "matt"
                  ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS }
                  : { backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS, boxShadow: "var(--card-shadow)" }
            }
          >
            <p className={`flex min-w-0 items-center gap-2 text-sm font-medium ${isHighContrast ? "text-white/90" : "text-zinc-400"}`}>
              <span className="shrink-0 text-emerald-400" aria-hidden>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
              </span>
              <span className="truncate">Average Wellness Score Today</span>
            </p>
            <p className={`mt-2 text-xl font-bold tabular-nums sm:text-3xl ${isHighContrast ? "text-white" : ""} ${wellnessColor}`}>
              {avgWellness != null ? avgWellness.toFixed(1) : "—"}
            </p>
          </div>

          <div
            className={`w-full rounded-xl p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-[var(--card-shadow-hover)] md:p-5 ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
            style={
              themeId === "neon"
                ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
                : themeId === "matt"
                  ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS }
                  : { backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS, boxShadow: "var(--card-shadow)" }
            }
          >
            <p className={`flex min-w-0 items-center gap-2 text-sm font-medium ${isHighContrast ? "text-white/90" : "text-zinc-400"}`}>
              <span className="shrink-0 text-emerald-400" aria-hidden>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
              </span>
              <span className="truncate">Total Team Load Today</span>
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-white">{totalLoad}</p>
          </div>

          <div
            className={`w-full rounded-xl p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-[var(--card-shadow-hover)] md:p-5 ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
            style={
              themeId === "neon"
                ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
                : themeId === "matt"
                  ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS }
                  : { backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS, boxShadow: "var(--card-shadow)" }
            }
          >
            <p className={`flex min-w-0 items-center gap-2 text-sm font-medium ${isHighContrast ? "text-white/90" : "text-zinc-400"}`}>
              <span className="shrink-0 text-red-400" aria-hidden>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              </span>
              <span className="truncate">High Risk Players</span>
            </p>
            <p className="mt-2 text-xl font-bold tabular-nums text-white sm:text-3xl">
              {highRiskCount}
              {highRiskCount > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full bg-red-500/20 px-2 py-0.5 text-sm font-medium text-red-400">
                  Alert
                </span>
              )}
            </p>
          </div>
        </div>

        {/* SECTION 2 – AT RISK PLAYERS PANEL (desktop only; on mobile the High risk circle is enough) */}
        <div
          className={`hidden w-full rounded-xl p-4 transition-all duration-200 hover:shadow-[var(--card-shadow-hover)] md:block md:p-5 ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
          style={
            themeId === "neon"
              ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
              : themeId === "matt"
                ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS }
                : { backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS, boxShadow: "var(--card-shadow)" }
          }
        >
          <h2 className="mb-3 flex items-center gap-2 border-b border-zinc-700/80 pb-2 text-xl font-semibold text-white md:mb-4">
            <Flag className="h-5 w-5 shrink-0 text-red-400" aria-hidden />
            <span>At risk players</span>
          </h2>
          {atRisk.length > 0 ? (
            <ul className="mt-3 space-y-2 md:mt-4 md:space-y-3">
              {atRisk.map((p) => {
                const w = p.wellness ?? 0;
                const f = p.fatigue ?? 0;
                const critical = w < 5 || f > 7;
                const badge = critical ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400";
                const leftBorder = critical ? "border-l-red-500" : "border-l-amber-500";
                const riskStatusStyle = isHighContrast ? getStatusCardStyle(themeId, critical ? "injured" : "limited") : null;
                return (
                  <li
                    key={p.user_id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border-l-4 px-4 py-3 ${isHighContrast ? (themeId === "neon" ? "neon-card-text" : "matt-card-text") : "bg-zinc-900/60"} ${leftBorder}`}
                    style={riskStatusStyle ? { ...riskStatusStyle, borderRadius: 8 } : undefined}
                  >
                    <div className="min-w-0">
                      <p className={`text-xs font-medium uppercase tracking-wide ${isHighContrast ? "text-white/80" : "text-zinc-500"}`}>At risk player</p>
                      <Link
                        href={`/players/${p.user_id}`}
                        className="font-semibold text-white hover:text-emerald-400 hover:underline"
                      >
                        {(p.full_name && p.full_name.trim()) || p.email}
                      </Link>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <span className={`rounded px-2 py-1 tabular-nums ${isHighContrast ? "bg-white/10 text-white/90" : "bg-zinc-800/80 text-zinc-300"}`}>
                        <span className={isHighContrast ? "text-white/70" : "text-zinc-500"}>Wellness:</span> {p.wellness != null ? p.wellness.toFixed(1) : "—"}
                      </span>
                      <span className={`rounded px-2 py-1 tabular-nums ${isHighContrast ? "bg-white/10 text-white/90" : "bg-zinc-800/80 text-zinc-300"}`}>
                        <span className={isHighContrast ? "text-white/70" : "text-zinc-500"}>Fatigue:</span> {p.fatigue ?? "—"}
                      </span>
                      <span className={`rounded px-2 py-1 tabular-nums ${isHighContrast ? "bg-white/10 text-white/90" : "bg-zinc-800/80 text-zinc-300"}`}>
                        <span className={isHighContrast ? "text-white/70" : "text-zinc-500"}>Load:</span> {p.load ?? 0}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${badge}`}
                      >
                        {critical ? "Critical" : "Warning"}
                      </span>
                      {p.reason != null && p.reason.includes("pain") && (
                        <span className="rounded bg-red-600/30 px-2 py-0.5 text-xs font-semibold text-red-300">
                          Pain
                        </span>
                      )}
                      {p.reason != null && p.reason.includes("illness") && (
                        <span className="rounded bg-red-600/30 px-2 py-0.5 text-xs font-semibold text-red-300">
                          Illness
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={`mt-4 rounded-lg px-4 py-3 ${isHighContrast ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-500/10 text-emerald-400"}`}>
              All players within safe range
            </p>
          )}
        </div>

        {/* SECTION 3 – MINI CHARTS ROW */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div
            className={`w-full rounded-xl p-4 transition-all duration-200 hover:scale-[1.01] hover:shadow-[var(--card-shadow-hover)] md:p-5 ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
            style={
              themeId === "neon"
                ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
                : themeId === "matt"
                  ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS }
                  : { backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS, boxShadow: "var(--card-shadow)" }
            }
          >
            <h3 className={`border-b pb-2 text-base font-semibold text-white ${isHighContrast ? "border-white/25" : "border-zinc-700/50"}`}>
              Last 7 days – Average wellness
            </h3>
            <p className={`mt-1 text-xs ${isHighContrast ? "text-white/90" : "text-zinc-500"}`}>Team average</p>
            <div className={`mt-3 h-[180px] md:h-40 md:min-h-[160px] ${isHighContrast ? "chart-high-contrast" : ""}`}>
              {chartDataWellness.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartDataWellness} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="wellnessLineGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#34d399" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                    <XAxis dataKey="date" stroke={chartAxisStroke} tick={chartTickStyle} />
                    <YAxis stroke={chartAxisStroke} tick={chartTickStyle} domain={[0, 10]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card-bg)",
                        border: "1px solid #27272a",
                        borderRadius: "8px",
                        color: "#fafafa",
                      }}
                      itemStyle={{ color: "#fafafa" }}
                      labelStyle={{ color: "#fafafa" }}
                      formatter={(v: number) => [v.toFixed(1), "Wellness"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="wellness"
                      stroke="url(#wellnessLineGradient)"
                      strokeWidth={2}
                      dot={{ fill: "#10b981", strokeWidth: 0 }}
                      isAnimationActive
                      animationDuration={600}
                      animationEasing="ease-out"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className={`flex h-full items-center justify-center text-sm ${isHighContrast ? "text-white/70" : "text-zinc-500"}`}>
                  No data
                </div>
              )}
            </div>
          </div>

          <div
            className={`w-full rounded-xl p-4 transition-all duration-200 hover:scale-[1.01] hover:shadow-[var(--card-shadow-hover)] md:p-5 ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
            style={
              themeId === "neon"
                ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
                : themeId === "matt"
                  ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS }
                  : { backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS, boxShadow: "var(--card-shadow)" }
            }
          >
            <h3 className={`border-b pb-2 text-base font-semibold text-white ${isHighContrast ? "border-white/25" : "border-zinc-700/50"}`}>
              Last 7 days – Team load
            </h3>
            <p className={`mt-1 text-xs ${isHighContrast ? "text-white/90" : "text-zinc-500"}`}>Team total</p>
            <div className={`mt-3 h-[180px] md:h-40 md:min-h-[160px] ${isHighContrast ? "chart-high-contrast" : ""}`}>
              {chartDataLoad.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDataLoad} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="loadBarGradient" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
                    <XAxis dataKey="date" stroke={chartAxisStroke} tick={chartTickStyle} />
                    <YAxis stroke={chartAxisStroke} tick={chartTickStyle} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card-bg)",
                        border: "1px solid #27272a",
                        borderRadius: "8px",
                        color: "#fafafa",
                      }}
                      itemStyle={{ color: "#fafafa" }}
                      labelStyle={{ color: "#fafafa" }}
                      formatter={(v: number) => [v, "Load"]}
                    />
                    <Bar
                      dataKey="load"
                      fill="url(#loadBarGradient)"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive
                      animationDuration={600}
                      animationEasing="ease-out"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className={`flex h-full items-center justify-center text-sm ${isHighContrast ? "text-white/70" : "text-zinc-500"}`}>
                  No data
                </div>
              )}
            </div>
          </div>

          <div
            className={`w-full rounded-xl p-4 transition-all duration-200 hover:scale-[1.01] hover:shadow-[var(--card-shadow-hover)] md:p-5 ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
            style={
              themeId === "neon"
                ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
                : themeId === "matt"
                  ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS }
                  : { backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS, boxShadow: "var(--card-shadow)" }
            }
          >
            <h3 className={`border-b pb-2 text-base font-semibold text-white ${isHighContrast ? "border-white/25" : "border-zinc-700/50"}`}>
              Submission compliance %
            </h3>
            <p className={`mt-1 flex min-w-0 items-center gap-2 text-xs ${isHighContrast ? "text-white/90" : "text-zinc-500"}`}>
              <span className="shrink-0 text-lg font-bold tabular-nums text-emerald-400">{submissionPct}%</span>
              <span className="truncate">submitted today</span>
            </p>
            <div className={`mt-3 h-[180px] md:h-40 md:min-h-[160px] ${isHighContrast ? "chart-high-contrast" : ""}`}>
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
                      isAnimationActive
                      animationDuration={500}
                      animationEasing="ease-out"
                    >
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={(props) => (
                        <DonutTooltipContent
                          active={props.active}
                          payload={props.payload as Array<{ name?: string; value?: number }> | undefined}
                          totalPlayers={totalPlayers}
                        />
                      )}
                      contentStyle={{ padding: 0, border: "none", background: "none" }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className={`flex h-full items-center justify-center text-sm ${isHighContrast ? "text-white/70" : "text-zinc-500"}`}>
                  No players
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            href="/wellness"
            className={`flex w-full min-w-0 items-start gap-3 rounded-xl p-3 transition-all duration-200 hover:scale-[1.02] hover:shadow-[var(--card-shadow-hover)] md:p-4 ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
            style={
              themeId === "neon"
                ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
                : themeId === "matt"
                  ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS }
                  : { backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS, boxShadow: "var(--card-shadow)" }
            }
          >
            <span className="text-emerald-400" aria-hidden>
              <HeartPulse className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-white">Wellness summary</span>
              <p className={`mt-1 text-sm ${isHighContrast ? "text-white/95" : "text-zinc-400"}`}>View and manage all wellness entries</p>
            </div>
          </Link>
          <Link
            href="/rpe"
            className={`flex w-full min-w-0 items-start gap-3 rounded-xl p-3 transition-all duration-200 hover:scale-[1.02] hover:shadow-[var(--card-shadow-hover)] md:p-4 ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
            style={
              themeId === "neon"
                ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
                : themeId === "matt"
                  ? { ...MATT_CARD_STYLE, borderRadius: CARD_RADIUS }
                  : { backgroundColor: "var(--card-bg)", borderRadius: CARD_RADIUS, boxShadow: "var(--card-shadow)" }
            }
          >
            <span className="shrink-0 text-emerald-400" aria-hidden>
              <Activity className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-white">RPE / sessions</span>
              <p className={`mt-1 text-sm ${isHighContrast ? "text-white/95" : "text-zinc-400"}`}>View and manage RPE sessions</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
