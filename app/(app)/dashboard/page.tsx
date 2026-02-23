"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MetricCard } from "@/components/MetricCard";
import { RedFlagsCard } from "@/components/RedFlagsCard";
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
};

type DashboardData = {
  role?: string;
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
      <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ backgroundColor: "#0b0f14" }}>
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
      <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ backgroundColor: "#0b0f14" }}>
        <div className="mx-auto max-w-md">
          <div
            className="rounded-xl border border-red-900/50 bg-red-950/20 p-6"
            style={{ backgroundColor: "#11161c", borderRadius: 12 }}
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
  const todayScheduleItem = data.todayScheduleItem ?? null;

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
      />
    );
  }

  // Player dashboard: Today's status + metrics + trends
  const todayISO = new Date().toISOString().slice(0, 10);
  const wellnessSubmitted = metrics.todayWellness != null;
  const rpeSubmitted = chart7.some((p) => p.date === todayISO && (p.load ?? 0) > 0);
  const allDone = wellnessSubmitted && rpeSubmitted;
  const scheduleLabel = todayScheduleItem
    ? todayScheduleItem.activity_type.charAt(0).toUpperCase() + todayScheduleItem.activity_type.slice(1).replace(/_/g, " ")
    : "No sessions today";

  const CARD_BG = "#11161c";
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
  };
  const SCHEDULE_PILL_COLORS: Record<string, string> = {
    breakfast: "bg-amber-500/40",
    lunch: "bg-amber-500/40",
    dinner: "bg-amber-500/40",
    training: "bg-blue-500/40",
    gym: "bg-purple-500/40",
    recovery: "bg-emerald-500/40",
    pre_activation: "bg-orange-500/40",
  };

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ backgroundColor: "#0b0f14" }}>
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Today's Schedule – horizontal timeline strip */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">Today&apos;s Schedule</h2>
          <div
            className="overflow-hidden rounded-xl border border-zinc-800"
            style={{ backgroundColor: CARD_BG, borderRadius: CARD_RADIUS }}
          >
            {todayScheduleItems.length === 0 ? (
              <p className="px-5 py-6 text-zinc-400">No schedule items today.</p>
            ) : (
              <div className="overflow-x-auto p-4">
                <div className="flex gap-3" style={{ minWidth: "min-content" }}>
                  {todayScheduleItems.map((item) => {
                    const label = SCHEDULE_ACTIVITY_LABELS[item.activity_type] ?? item.activity_type;
                    const pill = SCHEDULE_PILL_COLORS[item.activity_type] ?? "bg-zinc-500/40";
                    const timeStr =
                      item.start_time != null
                        ? item.end_time != null
                          ? `${item.start_time}–${item.end_time}`
                          : item.start_time
                      : "—";
                    return (
                      <div
                        key={item.id}
                        className="flex w-40 shrink-0 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800/80"
                      >
                        <div className={`w-1 shrink-0 ${pill}`} aria-hidden />
                        <div className="min-w-0 flex-1 px-3 py-2">
                          <p className="truncate font-medium text-white text-sm">{label}</p>
                          <p className="text-xs text-zinc-400">{timeStr}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Today's status */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">Today&apos;s status</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div
              className="rounded-xl p-5"
              style={{ backgroundColor: CARD_BG, borderRadius: CARD_RADIUS }}
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
              className="rounded-xl p-5"
              style={{ backgroundColor: CARD_BG, borderRadius: CARD_RADIUS }}
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
            <div
              className="rounded-xl p-5"
              style={{ backgroundColor: CARD_BG, borderRadius: CARD_RADIUS }}
            >
              <p className="text-sm font-medium text-zinc-400">Next schedule item</p>
              <p className="mt-2 text-xl font-bold text-white">{scheduleLabel}</p>
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

        {/* Metrics */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">Metrics</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard title="Today wellness" value={metrics.todayWellness ?? "—"} />
            <MetricCard title="Avg sleep (7d)" value={metrics.avgSleepHours != null ? `${metrics.avgSleepHours} h` : "—"} />
            <MetricCard title="Readiness" value={readiness ?? "—"} suffix={readiness != null ? "/100" : ""} variant={readinessVariant} />
            <MetricCard title="Monotony" value={metrics.monotony ?? "—"} />
            <MetricCard title="Strain" value={metrics.strain ?? "—"} />
          </div>
        </section>

        <RedFlagsCard flags={metrics.redFlags ?? []} />

        <section
          className="rounded-xl p-6"
          style={{ backgroundColor: CARD_BG, borderRadius: CARD_RADIUS }}
        >
          <h2 className="mb-4 font-semibold text-white">Trends</h2>
          <TrendCharts chart7={chart7} chart28={chart28} />
        </section>
      </div>
    </div>
  );
}
