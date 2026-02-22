import { getAppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { runQuery } from "@/lib/supabase/safeQuery";
import { Card } from "@/components/Card";
import { DailyWellnessForm } from "@/components/DailyWellnessForm";
import type { WellnessRow } from "@/lib/types";
import { StaffWellnessView } from "./components/StaffWellnessView";

export default async function WellnessPage() {
  const user = await getAppUser();
  if (!user) return null;

  const supabase = await createClient();
  const isPlayer = user.role === "player";

  let query = supabase
    .from("wellness")
    .select("*")
    .order("date", { ascending: false })
    .limit(isPlayer ? 14 : 100);

  if (isPlayer) {
    query = query.eq("user_id", user.id);
  }

  const { data: rows, error: loadError } = await runQuery("wellness-list", () =>
    query.then((r) => ({ data: r.data ?? [], error: r.error }))
  );
  const list = (rows ?? []) as WellnessRow[];

  if (loadError) {
    return (
      <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ backgroundColor: "#0b0f14" }}>
        <div className="mx-auto max-w-2xl space-y-6">
          <h1 className="text-2xl font-bold tracking-tight text-white">Wellness</h1>
          <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4" style={{ borderRadius: 12 }}>
            <p className="font-medium text-red-400">Something went wrong</p>
            <p className="mt-1 text-sm text-zinc-400">Code: {loadError.code}</p>
            <p className="mt-1 text-sm text-zinc-400">{loadError.message}</p>
          </div>
        </div>
      </div>
    );
  }

  let emailByUserId: Record<string, string> = {};
  let totalPlayers: number | null = null;
  if (!isPlayer) {
    if (list.length > 0) {
      const userIds = [...new Set(list.map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds);
      if (profiles) {
        for (const p of profiles) {
          emailByUserId[p.id] = p.email ?? "—";
        }
      }
    }
    const { count } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "player");
    totalPlayers = count ?? null;
  }

  if (isPlayer) {
    const today = new Date().toISOString().slice(0, 10);
    const hasSubmittedToday = list.some((r) => r.date === today);
    return (
      <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ backgroundColor: "#0b0f14" }}>
        <div className="mx-auto max-w-2xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Wellness
            </h1>
            <p className="mt-1 text-zinc-400">
              Submit once per day. Bed/wake time, sleep quality, fatigue, soreness, stress, mood (1–10).
            </p>
          </div>

          {hasSubmittedToday && (
            <div
              className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 px-4 py-3"
              style={{ borderRadius: 12 }}
            >
              <p className="flex items-center gap-2 font-medium text-emerald-400">
                <span>✔</span> You&apos;ve already submitted today
              </p>
            </div>
          )}

          <DailyWellnessForm hasSubmittedToday={hasSubmittedToday} />

          <Card title="Recent entries">
            {list.length === 0 ? (
              <p className="text-zinc-400">No wellness entries yet.</p>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-700 text-zinc-400">
                    <th className="pb-2 pr-4 font-medium">Date</th>
                    <th className="pb-2 pr-4 font-medium">Bed time</th>
                    <th className="pb-2 pr-4 font-medium">Wake time</th>
                    <th className="pb-2 pr-4 font-medium">Sleep (h)</th>
                    <th className="pb-2 pr-4 font-medium">Sleep quality</th>
                    <th className="pb-2 pr-4 font-medium">Fatigue</th>
                    <th className="pb-2 pr-4 font-medium">Soreness</th>
                    <th className="pb-2 pr-4 font-medium">Stress</th>
                    <th className="pb-2 font-medium">Mood</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-300">
                  {list.map((r) => (
                    <tr key={r.id} className="border-b border-zinc-800">
                      <td className="py-3 pr-4">{r.date}</td>
                      <td className="py-3 pr-4">{r.bed_time ?? "—"}</td>
                      <td className="py-3 pr-4">{r.wake_time ?? "—"}</td>
                      <td className="py-3 pr-4">{r.sleep_duration != null ? `${r.sleep_duration}h` : "—"}</td>
                      <td className="py-3 pr-4">{r.sleep_quality ?? "—"}</td>
                      <td className="py-3 pr-4">{r.fatigue ?? "—"}</td>
                      <td className="py-3 pr-4">{r.soreness ?? "—"}</td>
                      <td className="py-3 pr-4">{r.stress ?? "—"}</td>
                      <td className="py-3">{r.mood ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </Card>
        </div>
      </div>
    );
  }

  return (
    <StaffWellnessView
      list={list}
      emailByUserId={emailByUserId}
      totalPlayers={totalPlayers}
    />
  );
}
