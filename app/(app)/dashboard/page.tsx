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
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        // 1) session check (CLIENT -> működik biztosan)
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) throw sessionErr;

        if (!sessionData.session) {
          router.replace("/login");
          return;
        }

        // 2) load dashboard data from API route (server fetch)
        const res = await fetch("/api/dashboard", { cache: "no-store" });
        if (!res.ok) throw new Error(`Dashboard API error: ${res.status}`);
        const json = (await res.json()) as DashboardData;

        setData(json);
      } catch (e: any) {
        setErr(e?.message ?? "Unknown error");
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

  type Chart7Point = { date: string; load: number; wellness: number | null };
  const role = data.role ?? "player";
  const metrics = data.metrics ?? {};
  const chart7: Chart7Point[] = (Array.isArray(data.chart7) ? data.chart7 : []) as Chart7Point[];
  const chart28 = data.chart28 ?? [];
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

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ backgroundColor: "#0b0f14" }}>
      <div className="mx-auto max-w-6xl space-y-8">
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
