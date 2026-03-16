"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Activity, BarChart2, Calendar, CalendarCheck, HeartPulse, Pause, Play, TrendingUp } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { MATT_CARD_STYLE, NEON_CARD_STYLE } from "@/lib/themes";
import { createClient } from "@/lib/supabase/client";
import { MetricCard } from "@/components/MetricCard";
import { formatSleepDuration } from "@/utils/sleep";
import { RedFlagsCard } from "@/components/RedFlagsCard";
import { ScheduleBottomSheet, useIsMobile } from "@/components/ScheduleBottomSheet";
import { ScheduleIcon } from "@/components/ScheduleIcon";
import { getScheduleActivityBg } from "@/components/scheduleColors";
import dynamic from "next/dynamic";

const TrendCharts = dynamic(
  () => import("@/components/TrendCharts").then((m) => ({ default: m.TrendCharts })),
  { ssr: true }
);

const StaffDashboard = dynamic(
  () => import("@/components/StaffDashboard").then((m) => ({ default: m.StaffDashboard })),
  { ssr: false, loading: () => <div className="flex min-h-[280px] items-center justify-center text-zinc-400">Loading…</div> }
);

type AttentionPlayer = { user_id: string; email: string; reason?: string; wellness?: number | null; fatigue?: number | null; load?: number };
type PlayerWithStatus = {
  id: string;
  email: string;
  full_name: string | null;
  status: string;
  avatar_url?: string | null;
  status_notes?: string | null;
};

type ScheduleItemToday = {
  id: string;
  activity_type: string;
  sort_order: number;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  opponent?: string | null;
  team_a?: string | null;
  team_b?: string | null;
};

type DashboardData = {
  role?: string;
  userDisplayName?: string;
  teamSettings?: { team_name: string | null; team_logo_url: string | null };
  metrics: any;
  chart7: { date: string; load: number; wellness: number | null }[];
  chart28: any[];
  attentionToday?: {
    missingWellness: AttentionPlayer[];
    atRisk: AttentionPlayer[];
  } | null;
  todayScheduleItem?: { activity_type: string } | null;
  todayScheduleItems?: ScheduleItemToday[];
  playersWithStatus?: PlayerWithStatus[];
};

function dashboardNeonCardStyle(type: string, isMatch: boolean) {
  if (isMatch || type === "match") {
    return {
      backgroundImage:
        "radial-gradient(circle at left, rgba(251, 191, 36, 0.26) 0, transparent 55%), linear-gradient(135deg, #141006, #0a0502)",
      boxShadow:
        "0 0 0 1px rgba(255,255,255,0.05), 0 0 0 1px rgba(251, 191, 36, 0.2), 0 5px 16px rgba(180, 83, 9, 0.08)",
    };
  }

  const glowByType: Record<string, string> = {
    breakfast: "rgba(16, 185, 129, 0.26)",
    lunch: "rgba(16, 185, 129, 0.26)",
    dinner: "rgba(16, 185, 129, 0.26)",
    arrival: "rgba(249, 115, 22, 0.30)",
    training: "rgba(16, 185, 129, 0.30)",
    gym: "rgba(132, 204, 22, 0.28)",
    recovery: "rgba(56, 189, 248, 0.30)",
    pre_activation: "rgba(245, 158, 11, 0.30)",
    video_analysis: "rgba(139, 92, 246, 0.30)",
    traveling: "rgba(245, 158, 11, 0.30)",
    physio: "rgba(56, 189, 248, 0.30)",
    medical: "rgba(244, 63, 94, 0.30)",
    meeting: "rgba(79, 70, 229, 0.30)",
    media: "rgba(217, 70, 239, 0.30)",
    team_building: "rgba(147, 51, 234, 0.30)",
    rest_off: "rgba(59, 130, 246, 0.26)",
    individual: "rgba(52, 211, 153, 0.30)",
  };

  const glow = glowByType[type] ?? "rgba(16, 185, 129, 0.26)";

  return {
    backgroundImage: `radial-gradient(circle at left, ${glow} 0, transparent 55%), linear-gradient(135deg, #041311, #020617)`,
    boxShadow:
      "0 0 0 1px rgba(255,255,255,0.05), 0 0 0 1px rgba(16, 185, 129, 0.2), 0 5px 16px rgba(6, 95, 70, 0.08)",
  };
}

function LocationPinIcon({ className, ...props }: { className?: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { themeId } = useTheme();
  const isHighContrast = themeId === "neon" || themeId === "matt";
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadDashboard = async () => {
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      const json = (await res.json()) as DashboardData & { errorCode?: string; error?: string };
      if (!res.ok) {
        const msg = json?.error ?? `Dashboard API error: ${res.status}`;
        const code = json?.errorCode ?? "DASHBOARD_ERROR";
        setErr(`${code}: ${msg}`);
        return;
      }
      setData(json);
      setErr(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setErr(msg);
    }
  };

  useEffect(() => {
    const run = async () => {
      try {
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) throw sessionErr;

        if (!sessionData.session) {
          router.replace("/login");
          return;
        }

        await loadDashboard();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setErr(msg);
      } finally {
        setLoading(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleFirstPartRef = useRef<HTMLDivElement>(null);
  const [scheduleSegmentWidth, setScheduleSegmentWidth] = useState(0);
  const [scheduleAutoPaused, setScheduleAutoPaused] = useState(false);
  const [scheduleSheetOpen, setScheduleSheetOpen] = useState(false);
  const isMobile = useIsMobile();
  const todayScheduleItemsForEffect = data?.todayScheduleItems ?? [];

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
  }, [data, todayScheduleItemsForEffect]);

  if (loading) {
    return (
      <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ backgroundColor: "var(--page-bg)" }}>
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="h-9 w-64 animate-pulse rounded bg-zinc-800" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded bg-zinc-800" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-zinc-800/80" style={{ borderRadius: 12 }} />
            ))}
          </div>
          <div className="h-48 animate-pulse rounded-xl bg-zinc-800/80" style={{ borderRadius: 12 }} />
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ backgroundColor: "var(--page-bg)" }}>
        <div className="mx-auto max-w-md">
          <div
            className="rounded-xl border border-red-900/50 bg-red-950/20 p-6"
            style={{ backgroundColor: "var(--card-bg)", borderRadius: 12 }}
          >
            <h2 className="text-lg font-semibold text-red-400">Dashboard error</h2>
            <p className="mt-2 text-sm text-zinc-400">{err}</p>
            <button
              type="button"
              onClick={() => {
                setErr(null);
                loadDashboard();
              }}
              className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  type Chart7Point = { date: string; load: number; wellness: number | null; sleepHours: number | null };
  const role = data.role ?? "player";
  const metrics = data.metrics ?? {};
  const chart7: Chart7Point[] = (Array.isArray(data.chart7) ? data.chart7 : []) as Chart7Point[];
  const chart28 = (Array.isArray(data.chart28) ? data.chart28 : []) as Chart7Point[];
  const isPlayer = role === "player";

  const readiness = metrics.readiness;
  const readinessVariant =
    readiness != null ? (readiness >= 70 ? "success" : readiness < 50 ? "danger" : "default") : "default";

  if (!isPlayer) {
    return (
      <StaffDashboard
        metrics={{
          todayWellnessCount: metrics.todayWellnessCount,
          totalPlayers: metrics.totalPlayers,
          todayWellness: metrics.todayWellness,
          totalTeamLoadToday: metrics.totalTeamLoadToday,
        }}
        attentionToday={data.attentionToday ?? null}
        chart7={chart7}
        playersWithStatus={data.playersWithStatus ?? []}
        isAdmin={role === "admin"}
        todayScheduleItems={data.todayScheduleItems ?? []}
        onRefreshData={loadDashboard}
        userDisplayName={data.userDisplayName ?? undefined}
        teamSettings={data.teamSettings ?? undefined}
      />
    );
  }

  // Player dashboard: Today's status + metrics + trends
  const todayISO = new Date().toISOString().slice(0, 10);
  const wellnessSubmitted = metrics.todayWellness != null;
  const rpeSubmitted = chart7.some((p) => p.date === todayISO && (p.load ?? 0) > 0);
  const allDone = wellnessSubmitted && rpeSubmitted;

  const CARD_BG = "var(--card-bg)";
  const CARD_RADIUS = "12px";
  const todayScheduleItems = data.todayScheduleItems ?? [];

  const SCHEDULE_ACTIVITY_LABELS: Record<string, string> = {
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
  const SCHEDULE_PILL_COLORS: Record<string, string> = {
    arrival: "bg-sky-500/40",
    breakfast: "bg-amber-500/40",
    lunch: "bg-amber-500/40",
    dinner: "bg-amber-500/40",
    training: "bg-blue-500/40",
    gym: "bg-purple-500/40",
    recovery: "bg-emerald-500/40",
    pre_activation: "bg-orange-500/40",
    video_analysis: "bg-cyan-500/40",
    meeting: "bg-sky-500/40",
    traveling: "bg-amber-600/40",
    physio: "bg-teal-500/40",
    medical: "bg-red-500/40",
    media: "bg-pink-500/40",
    rest_off: "bg-zinc-500/40",
    match: "bg-rose-500/40",
    team_building: "bg-violet-500/40",
    individual: "bg-lime-500/40",
  };

  const teamSettings = data.teamSettings;
  const userDisplayName = data.userDisplayName ?? "User";

  return (
    <div className="min-h-screen min-w-0 -mx-4 overflow-x-hidden px-3 py-6 sm:mx-0 sm:px-6 sm:py-8 lg:px-8" style={{ backgroundColor: "var(--page-bg)" }}>
      <div className="mx-auto max-w-6xl space-y-4 md:space-y-8">
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
          <p className="flex min-w-0 flex-1 items-center gap-2 truncate text-base font-bold tracking-tight text-white md:flex-initial sm:text-xl lg:text-2xl">
            <span className="truncate">Welcome, {userDisplayName}!</span>
            <span aria-hidden className="shrink-0">👋</span>
          </p>
          {(teamSettings?.team_name || teamSettings?.team_logo_url) && (
            <div
              className="ml-auto flex shrink-0 items-center justify-end gap-2 text-white md:gap-3 md:-mr-1 lg:-mr-2"
              style={isHighContrast ? { textShadow: "0 1px 3px rgba(0,0,0,0.5)" } : undefined}
            >
              {teamSettings?.team_name && (
                <span className="hidden text-lg font-bold text-white md:inline">{teamSettings.team_name}</span>
              )}
              {teamSettings?.team_logo_url && (
                <img
                  src={teamSettings.team_logo_url}
                  alt="Team logo"
                  className="mt-0.5 h-8 w-auto object-contain md:h-10"
                />
              )}
            </div>
          )}
        </div>

        {!allDone && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <span className="text-sm font-medium text-amber-400">To do:</span>
            {!wellnessSubmitted && (
              <Link
                href="/wellness"
                className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-sm font-medium text-amber-300 hover:bg-amber-500/30"
              >
                Wellness
              </Link>
            )}
            {!rpeSubmitted && (
              <Link
                href="/rpe"
                className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-sm font-medium text-amber-300 hover:bg-amber-500/30"
              >
                RPE
              </Link>
            )}
          </div>
        )}

        {/* Today's Schedule – horizontal timeline strip */}
        <section>
          <h2 className={`mb-3 flex flex-wrap items-center gap-2 border-b pb-2 text-lg font-semibold text-white md:mb-4 ${isHighContrast ? "border-white/25" : "border-zinc-700/80"}`}>
            <Calendar className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
            <span>Today&apos;s Schedule</span>
            {todayScheduleItems.length > 0 && (
              <button
                type="button"
                onClick={() => setScheduleAutoPaused((p) => !p)}
                className={`ml-auto flex items-center justify-center rounded-lg p-1.5 transition-colors ${isHighContrast ? "text-white/90 hover:bg-white/10" : "text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"}`}
                aria-label={scheduleAutoPaused ? "Start auto-scroll" : "Stop auto-scroll"}
              >
                {scheduleAutoPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </button>
            )}
          </h2>
          <div
            className={`overflow-hidden rounded-xl border ${isHighContrast ? "border-transparent " + (themeId === "neon" ? "neon-card-text" : "matt-card-text") : ""}`}
            style={
              themeId === "neon"
                ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
                : themeId === "matt"
                  ? { ...MATT_CARD_STYLE, border: "1px solid rgba(255,255,255,0.2)", borderRadius: CARD_RADIUS }
                  : { backgroundColor: CARD_BG, borderRadius: CARD_RADIUS, borderColor: "var(--card-border)" }
            }
          >
            {todayScheduleItems.length === 0 ? (
              <p className={`px-5 py-6 ${isHighContrast ? "text-white/80" : "text-zinc-400"}`}>No schedule items today.</p>
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
                  <div ref={scheduleFirstPartRef} className={`flex shrink-0 flex-row ${isHighContrast ? "gap-3 sm:gap-5" : "gap-3"}`}>
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
                    const baseLabel = SCHEDULE_ACTIVITY_LABELS[item.activity_type] ?? item.activity_type;
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
                          <div className="schedule-card-text min-w-0 flex-1 space-y-1 px-2.5 py-2 sm:space-y-1.5 sm:px-3 sm:py-2.5">
                            <p
                              className={`tabular-nums font-bold text-sm sm:text-base tracking-[0.03em] ${isMatch ? "text-amber-700" : "text-emerald-300"}`}
                            >
                              {item.start_time}
                              {item.end_time != null ? <span className="inline-block px-1">–</span> : null}
                              {item.end_time != null ? item.end_time : null}
                            </p>
                            <p className="flex items-center gap-2 text-sm font-medium text-white">
                              {!isMatch && (
                                <span className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 ${getScheduleActivityBg(item.activity_type)}`}>
                                  <ScheduleIcon type={item.activity_type} className="shrink-0 text-white/90" />
                                </span>
                              )}
                              <span>{label}</span>
                            </p>
                            {notes ? (
                              <p className="flex items-center gap-1.5 text-xs text-white/90">
                                <LocationPinIcon className="h-3.5 w-3.5 shrink-0 text-white/80" aria-hidden />
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
                          <div className="matt-card-text min-w-0 flex-1 space-y-1 px-2.5 py-2 sm:space-y-1.5 sm:px-3 sm:py-2.5">
                            <p
                              className={`tabular-nums font-bold text-sm sm:text-base ${isMatch ? "text-amber-700" : "text-emerald-300"}`}
                            >
                              {timeStr}
                            </p>
                            <p className="flex items-center gap-2 text-sm font-medium text-white">
                              {!isMatch && (
                                <span className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 ${getScheduleActivityBg(item.activity_type)}`}>
                                  <ScheduleIcon type={item.activity_type} className="shrink-0 text-white/90" />
                                </span>
                              )}
                              <span>{label}</span>
                            </p>
                            {notes ? (
                              <p className="flex items-center gap-1.5 text-xs text-white/90">
                                <LocationPinIcon className="h-3.5 w-3.5 shrink-0 text-white/80" aria-hidden />
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
                        <div className="min-w-0 flex-1 px-2.5 py-2 sm:px-3 sm:py-2.5">
                          <p
                            className={`tabular-nums font-bold text-sm sm:text-base ${isMatch ? "text-amber-700" : "text-emerald-300"}`}
                          >
                            {timeStr}
                          </p>
                          <p
                            className={`mt-1 flex items-center gap-2 font-medium text-zinc-300 ${
                              isMatch ? "text-sm" : "text-xs"
                            }`}
                          >
                            {!isMatch && (
                              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 ${getScheduleActivityBg(item.activity_type)}`}>
                                <ScheduleIcon type={item.activity_type} className="shrink-0" />
                              </span>
                            )}
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
                  <div className={`flex shrink-0 flex-row ${isHighContrast ? "gap-3 sm:gap-5" : "gap-3"}`} aria-hidden>
                    <div className="flex shrink-0 items-center justify-center px-8 py-2 sm:px-10">
                      <div className="relative h-20 w-px shrink-0" style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.55) 0%, rgba(16,185,129,0.45) 35%, rgba(16,185,129,0.45) 65%, rgba(255,255,255,0.55) 100%)", boxShadow: "0 0 12px rgba(16,185,129,0.4), 0 0 6px rgba(16,185,129,0.3)" }}>
                        <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/50" aria-hidden />
                      </div>
                    </div>
                    {todayScheduleItems.map((item, idx) => {
                      const baseLabel = SCHEDULE_ACTIVITY_LABELS[item.activity_type] ?? item.activity_type;
                      const label = item.activity_type === "match" && item.team_a?.trim() && item.team_b?.trim() ? `${item.team_a.trim()} vs. ${item.team_b.trim()}` : item.activity_type === "match" && item.opponent?.trim() ? `${baseLabel} vs. ${item.opponent.trim()}` : baseLabel;
                      const timeStr = item.start_time != null ? (item.end_time != null ? `${item.start_time} – ${item.end_time}` : item.start_time) : "—";
                      const notes = item.notes?.trim();
                      const isMatch = item.activity_type === "match";
                      if (themeId === "neon") {
                        return (
                          <div
                            key={`dup-${item.id}-${idx}`}
                            className={`flex shrink-0 rounded-xl border border-transparent shadow-[var(--card-shadow)] ${isMatch ? "w-44 sm:w-52" : "w-40 sm:w-44"}`}
                            style={dashboardNeonCardStyle(item.activity_type, isMatch)}
                          >
                            <div className="schedule-card-text min-w-0 flex-1 space-y-1 px-2.5 py-2 sm:space-y-1.5 sm:px-3 sm:py-2.5">
                              <p className={`tabular-nums font-bold text-sm sm:text-base tracking-[0.03em] ${isMatch ? "text-amber-700" : "text-emerald-300"}`}>{item.start_time}{item.end_time != null ? <span className="inline-block px-1">–</span> : null}{item.end_time != null ? item.end_time : null}</p>
                              <p className="flex items-center gap-2 text-sm font-medium text-white">
                                {!isMatch && (
                                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 ${getScheduleActivityBg(item.activity_type)}`}>
                                    <ScheduleIcon type={item.activity_type} className="shrink-0 text-white/90" />
                                  </span>
                                )}
                                <span>{label}</span>
                              </p>
                              {notes ? <p className="flex items-center gap-1.5 text-xs text-white/90"><LocationPinIcon className="h-3.5 w-3.5 shrink-0 text-white/80" aria-hidden />{notes}</p> : null}
                            </div>
                          </div>
                        );
                      }
                      if (themeId === "matt") {
                        return (
                          <div key={`dup-${item.id}-${idx}`} className={`flex shrink-0 rounded-xl border border-transparent ${isMatch ? "w-44 sm:w-52" : "w-40 sm:w-44"}`} style={isMatch ? { backgroundImage: "radial-gradient(circle at left, rgba(251, 191, 36, 0.28) 0, transparent 55%), linear-gradient(135deg, #141006, #0a0802)", boxShadow: "0 0 0 1px rgba(255,255,255,0.2), 0 0 0 1px rgba(251, 191, 36, 0.2), 0 5px 16px rgba(180, 83, 9, 0.08)", borderRadius: 12 } : { ...MATT_CARD_STYLE, borderRadius: 12 }}>
                            <div className="matt-card-text min-w-0 flex-1 space-y-1 px-2.5 py-2 sm:space-y-1.5 sm:px-3 sm:py-2.5">
                              <p className={`tabular-nums font-bold text-sm sm:text-base ${isMatch ? "text-amber-700" : "text-emerald-300"}`}>{timeStr}</p>
                              <p className="flex items-center gap-2 text-sm font-medium text-white">
                                {!isMatch && (
                                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 ${getScheduleActivityBg(item.activity_type)}`}>
                                    <ScheduleIcon type={item.activity_type} className="shrink-0 text-white/90" />
                                  </span>
                                )}
                                <span>{label}</span>
                              </p>
                              {notes ? <p className="flex items-center gap-1.5 text-xs text-white/90"><LocationPinIcon className="h-3.5 w-3.5 shrink-0 text-white/80" aria-hidden />{notes}</p> : null}
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={`dup-${item.id}-${idx}`} className={`flex shrink-0 rounded-lg border border-zinc-700/80 shadow-[var(--card-shadow)] ${isMatch ? "w-40 border-l-[6px] border-l-amber-500/70 bg-amber-500/10 sm:w-48" : "w-36 border-l-4 border-l-emerald-500/60 bg-zinc-800/80 sm:w-40"}`}>
                          <div className="min-w-0 flex-1 px-2.5 py-2 sm:px-3 sm:py-2.5">
                            <p className={`tabular-nums font-bold text-sm sm:text-base ${isMatch ? "text-amber-700" : "text-emerald-300"}`}>{timeStr}</p>
                            <p className={`mt-1 flex items-center gap-2 font-medium text-zinc-300 ${isMatch ? "text-sm" : "text-xs"}`}>
                              {!isMatch && (
                                <span className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 ${getScheduleActivityBg(item.activity_type)}`}>
                                  <ScheduleIcon type={item.activity_type} className="shrink-0" />
                                </span>
                              )}
                              <span>{label}</span>
                            </p>
                            {notes ? <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500"><LocationPinIcon className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />{notes}</p> : null}
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

        {/* Today's status – Wellness & RPE only */}
        <section>
          <h2 className={`mb-3 flex items-center gap-2 border-b pb-2 text-lg font-semibold text-white md:mb-4 ${isHighContrast ? "border-white/25" : ""}`}>
            <CalendarCheck className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
            Today&apos;s status
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" style={{ contain: "layout paint" }}>
            <div
              className={`w-full rounded-xl border p-4 md:p-5 ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
              style={
                themeId === "neon"
                  ? wellnessSubmitted
                    ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
                    : {
                        backgroundImage: "radial-gradient(circle at left, rgba(251, 191, 36, 0.26) 0, transparent 55%), linear-gradient(135deg, #141006, #0a0502)",
                        boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 0 1px rgba(251, 191, 36, 0.2), 0 5px 16px rgba(180, 83, 9, 0.08)",
                        borderRadius: CARD_RADIUS,
                      }
                  : themeId === "matt"
                    ? { ...MATT_CARD_STYLE, border: "1px solid rgba(255,255,255,0.2)", borderRadius: CARD_RADIUS }
                    : {
                        backgroundColor: wellnessSubmitted ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.12)",
                        borderColor: wellnessSubmitted ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)",
                        borderRadius: CARD_RADIUS,
                      }
              }
            >
              <p className={`flex items-center gap-2 text-sm font-medium ${isHighContrast ? "text-white/90" : "text-zinc-400"}`}>
                <HeartPulse className="h-4 w-4 text-emerald-400/80" aria-hidden />
                <span>Wellness</span>
              </p>
              <p className="mt-2 flex items-center gap-2 text-base font-bold text-white sm:text-xl">
                {wellnessSubmitted ? (
                  <>
                    <span className="text-emerald-300" aria-hidden>✔</span>
                    <span>Submitted today</span>
                  </>
                ) : (
                  "Not submitted"
                )}
              </p>
              {wellnessSubmitted ? (
                <Link
                  href="/wellness"
                  className="mt-3 inline-block text-sm font-medium text-emerald-400/90 hover:text-emerald-300"
                >
                  View
                </Link>
              ) : (
                <Link
                  href="/wellness"
                  className="mt-3 inline-block rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  Fill wellness
                </Link>
              )}
            </div>
            <div
              className={`w-full rounded-xl border p-4 md:p-5 ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
              style={
                themeId === "neon"
                  ? rpeSubmitted
                    ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
                    : {
                        backgroundImage: "radial-gradient(circle at left, rgba(251, 191, 36, 0.26) 0, transparent 55%), linear-gradient(135deg, #141006, #0a0502)",
                        boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 0 1px rgba(251, 191, 36, 0.2), 0 5px 16px rgba(180, 83, 9, 0.08)",
                        borderRadius: CARD_RADIUS,
                      }
                  : themeId === "matt"
                    ? { ...MATT_CARD_STYLE, border: "1px solid rgba(255,255,255,0.2)", borderRadius: CARD_RADIUS }
                    : {
                        backgroundColor: rpeSubmitted ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.12)",
                        borderColor: rpeSubmitted ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)",
                        borderRadius: CARD_RADIUS,
                      }
              }
            >
              <p className={`flex items-center gap-2 text-sm font-medium ${isHighContrast ? "text-white/90" : "text-zinc-400"}`}>
                <Activity className="h-4 w-4 text-emerald-400/80" aria-hidden />
                <span>RPE</span>
              </p>
              <p className="mt-2 flex items-center gap-2 text-base font-bold text-white sm:text-xl">
                {rpeSubmitted ? (
                  <>
                    <span className="text-emerald-300" aria-hidden>✔</span>
                    <span>Submitted today</span>
                  </>
                ) : (
                  "Not submitted"
                )}
              </p>
              {rpeSubmitted ? (
                <Link
                  href="/rpe"
                  className="mt-3 inline-block text-sm font-medium text-emerald-400/90 hover:text-emerald-300"
                >
                  View
                </Link>
              ) : (
                <Link
                  href="/rpe"
                  className="mt-3 inline-block rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  Log session
                </Link>
              )}
            </div>
          </div>

          {!allDone && (
            <div className="mt-6">
              <Link
                href={!wellnessSubmitted ? "/wellness" : "/rpe"}
                className="inline-flex items-center rounded-xl bg-emerald-600 px-6 py-3.5 text-base font-semibold text-white hover:bg-emerald-500"
                style={{ borderRadius: CARD_RADIUS }}
              >
                Complete today&apos;s check-in
              </Link>
            </div>
          )}
        </section>

        <RedFlagsCard flags={metrics.redFlags ?? []} />

        {/* Trends: 7-day Load then 28-day (one metric at a time) */}
        <section
          className={`rounded-xl p-4 md:p-6 ${themeId === "neon" ? "neon-card-text" : themeId === "matt" ? "matt-card-text" : ""}`}
          style={
            themeId === "neon"
              ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
              : themeId === "matt"
                ? { ...MATT_CARD_STYLE, border: "1px solid rgba(255,255,255,0.2)", borderRadius: CARD_RADIUS }
                : { backgroundColor: CARD_BG, borderRadius: CARD_RADIUS }
          }
        >
          <h2 className={`mb-3 flex items-center gap-2 border-b pb-2 font-semibold text-white md:mb-4 ${isHighContrast ? "border-white/25" : ""}`}>
            <TrendingUp className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
            Trends
          </h2>
          <div style={{ contain: "layout paint" }}>
            <TrendCharts chart7={chart7} chart28={chart28} />
          </div>
        </section>

        {/* Metrics: primary first, then collapsible detailed – tighter on mobile (player) */}
        <section
          className={themeId === "neon" ? "rounded-xl p-3 neon-card-text md:p-6" : themeId === "matt" ? "rounded-xl p-3 matt-card-text md:p-6" : ""}
          style={
            themeId === "neon"
              ? { ...NEON_CARD_STYLE, borderRadius: CARD_RADIUS }
              : themeId === "matt"
                ? { ...MATT_CARD_STYLE, border: "1px solid rgba(255,255,255,0.2)", borderRadius: CARD_RADIUS }
                : undefined
          }
        >
          <h2 className={`mb-2 flex items-center gap-2 border-b pb-1.5 text-base font-semibold text-white md:mb-4 md:pb-2 md:text-lg ${isHighContrast ? "border-white/25" : ""}`}>
            <BarChart2 className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
            Metrics
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
            <MetricCard title="Today wellness" value={metrics.todayWellness ?? "—"} />
            <MetricCard title="Readiness" value={readiness ?? "—"} suffix={readiness != null ? "/100" : ""} variant={readinessVariant} />
          </div>
          <details className="mt-3 md:mt-4">
            <summary className="cursor-pointer text-sm font-medium text-zinc-500 hover:text-zinc-400">
              More metrics
            </summary>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3 md:mt-3 md:gap-4">
              <MetricCard
                title="Avg sleep (7d)"
                value={metrics.avgSleepHours != null ? `${formatSleepDuration(metrics.avgSleepHours)} h` : "—"}
                subtitle="hours per night"
              />
              <MetricCard title="Monotony" value={metrics.monotony ?? "—"} subtitle="load variation" />
              <MetricCard title="Strain" value={metrics.strain ?? "—"} subtitle="weekly load stress" />
            </div>
          </details>
        </section>
      </div>
    </div>
  );
}
