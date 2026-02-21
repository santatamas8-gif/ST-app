"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/Card";
import { MetricCard } from "@/components/MetricCard";
import { RedFlagsCard } from "@/components/RedFlagsCard";
import { TrendCharts } from "@/components/TrendCharts";

type DashboardData = {
  role?: string;
  metrics: any;
  chart7: any[];
  chart28: any[];
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
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Card>
          <div className="p-6 text-zinc-300">Loading dashboard…</div>
        </Card>
      </div>
    );
  }

  if (err) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Card>
          <div className="p-6">
            <div className="text-red-400 font-medium">Dashboard error</div>
            <div className="mt-2 text-zinc-300 text-sm">{err}</div>
            <button
              className="mt-4 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-white"
              onClick={() => router.refresh()}
            >
              Retry
            </button>
          </div>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const role = data.role ?? "player";
  const metrics = data.metrics ?? {};
  const chart7 = data.chart7 ?? [];
  const chart28 = data.chart28 ?? [];
  const isPlayer = role === "player";

  const readiness = metrics.readiness;
  const readinessVariant =
    readiness != null ? (readiness >= 70 ? "success" : readiness < 50 ? "danger" : "default") : "default";

  if (!isPlayer) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
        <p className="text-zinc-400">Summary: today&apos;s wellness and session entries.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard title="Today wellness (count)" value={metrics.todayWellnessCount ?? 0} />
          <MetricCard title="Today sessions/RPE (count)" value={metrics.todaySessionsCount ?? 0} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/wellness"
            className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-left transition hover:border-emerald-600/50 hover:bg-zinc-800/50"
          >
            <div className="font-semibold text-white">Wellness summary</div>
            <div className="mt-1 text-sm text-zinc-400">Players&apos; daily wellness data</div>
          </Link>
          <Link
            href="/rpe"
            className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-left transition hover:border-emerald-600/50 hover:bg-zinc-800/50"
          >
            <div className="font-semibold text-white">RPE / sessions summary</div>
            <div className="mt-1 text-sm text-zinc-400">Players&apos; training and RPE entries</div>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      {metrics.todayWellness == null && (
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-zinc-300">No wellness entry for today yet.</p>
            <Link
              href="/wellness"
              className="inline-flex shrink-0 rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-500"
            >
              Fill wellness form
            </Link>
          </div>
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard title="Today wellness" value={metrics.todayWellness ?? "—"} />
        <MetricCard title="Avg sleep (7d)" value={metrics.avgSleepHours != null ? `${metrics.avgSleepHours} h` : "—"} />
        <MetricCard title="Readiness" value={readiness ?? "—"} suffix={readiness != null ? "/100" : ""} variant={readinessVariant} />
        <MetricCard title="Monotony" value={metrics.monotony ?? "—"} />
        <MetricCard title="Strain" value={metrics.strain ?? "—"} />
      </div>

      <RedFlagsCard flags={metrics.redFlags ?? []} />

      <Card>
        <div className="p-6">
          <div className="mb-4 font-semibold text-white">Trends</div>
          <TrendCharts chart7={chart7} chart28={chart28} />
        </div>
      </Card>
    </div>
  );
}
