"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MetricCard } from "@/components/MetricCard";
import { RedFlagsCard } from "@/components/RedFlagsCard";
import { ScheduleIcon } from "@/components/ScheduleIcon";
import { TrendCharts } from "@/components/TrendCharts";
import { StaffDashboard } from "@/components/StaffDashboard";

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
              onClick={() => router.refresh()}
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

  const summaryLine = allDone
    ? "You're all set for today."
    : !wellnessSubmitted && !rpeSubmitted
      ? "Complete your check-in: wellness and RPE."
      : !wellnessSubmitted
        ? "Fill in wellness to complete today."
        : "Log your session (RPE) to complete today.";

  const teamSettings = data.teamSettings;
  const userDisplayName = data.userDisplayName ?? "User";

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ backgroundColor: "var(--page-bg)" }}>
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <p className="text-2xl font-bold tracking-tight text-white">Welcome, {userDisplayName}!</p>
          {(teamSettings?.team_name || teamSettings?.team_logo_url) && (
            <div className="flex flex-wrap items-center gap-3">
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
            </div>
          )}
        </div>
        <p className="text-zinc-400">{summaryLine}</p>

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
          <h2 className="mb-4 text-lg font-semibold text-white">Today&apos;s Schedule</h2>
          <div
            className="overflow-hidden rounded-xl border"
            style={{ backgroundColor: CARD_BG, borderRadius: CARD_RADIUS, borderColor: "var(--card-border)" }}
          >
            {todayScheduleItems.length === 0 ? (
              <p className="px-5 py-6 text-zinc-400">No schedule items today.</p>
            ) : (
              <div className="overflow-x-auto p-4">
                <div className="flex gap-3" style={{ minWidth: "min-content" }}>
                  {todayScheduleItems.map((item) => {
                    const baseLabel = SCHEDULE_ACTIVITY_LABELS[item.activity_type] ?? item.activity_type;
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
                        className={`flex shrink-0 rounded-lg border border-zinc-700/80 shadow-[var(--card-shadow)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[var(--card-shadow-hover)] ${
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

        {/* Today's status – Wellness & RPE only */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">Today&apos;s status</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div
              className="rounded-xl border p-5"
              style={{
                backgroundColor: wellnessSubmitted ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.12)",
                borderColor: wellnessSubmitted ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)",
                borderRadius: CARD_RADIUS,
              }}
            >
              <p className="text-sm font-medium text-zinc-400">Wellness</p>
              <p className="mt-2 text-xl font-bold text-white">
                {wellnessSubmitted ? "Submitted today" : "Not submitted"}
              </p>
              {!wellnessSubmitted && (
                <Link
                  href="/wellness"
                  className="mt-3 inline-block rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  Fill wellness
                </Link>
              )}
            </div>
            <div
              className="rounded-xl border p-5"
              style={{
                backgroundColor: rpeSubmitted ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.12)",
                borderColor: rpeSubmitted ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)",
                borderRadius: CARD_RADIUS,
              }}
            >
              <p className="text-sm font-medium text-zinc-400">RPE</p>
              <p className="mt-2 text-xl font-bold text-white">
                {rpeSubmitted ? "Submitted today" : "Not submitted"}
              </p>
              {!rpeSubmitted && (
                <Link
                  href="/rpe"
                  className="mt-3 inline-block rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  Log session
                </Link>
              )}
            </div>
          </div>

          <div className="mt-6">
            {allDone ? (
              <div
                className="flex items-center gap-3 rounded-xl px-5 py-4"
                style={{ backgroundColor: "rgba(16, 185, 129, 0.12)", borderRadius: CARD_RADIUS }}
              >
                <span className="text-2xl">✔</span>
                <span className="text-lg font-semibold text-emerald-400">All done for today</span>
              </div>
            ) : (
              <Link
                href={!wellnessSubmitted ? "/wellness" : "/rpe"}
                className="inline-flex items-center rounded-xl bg-emerald-600 px-6 py-3.5 text-base font-semibold text-white hover:bg-emerald-500"
                style={{ borderRadius: CARD_RADIUS }}
              >
                Complete today&apos;s check-in
              </Link>
            )}
          </div>
        </section>

        <RedFlagsCard flags={metrics.redFlags ?? []} />

        {/* Trends: 7-day Load then 28-day (one metric at a time) */}
        <section
          className="rounded-xl p-6"
          style={{ backgroundColor: CARD_BG, borderRadius: CARD_RADIUS }}
        >
          <h2 className="mb-4 font-semibold text-white">Trends</h2>
          <TrendCharts chart7={chart7} chart28={chart28} />
        </section>

        {/* Metrics: primary first, then collapsible detailed */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">Metrics</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <MetricCard title="Today wellness" value={metrics.todayWellness ?? "—"} />
            <MetricCard title="Readiness" value={readiness ?? "—"} suffix={readiness != null ? "/100" : ""} variant={readinessVariant} />
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-zinc-500 hover:text-zinc-400">
              More metrics
            </summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <MetricCard
                title="Avg sleep (7d)"
                value={metrics.avgSleepHours != null ? `${metrics.avgSleepHours} h` : "—"}
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
