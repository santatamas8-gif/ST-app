import { getAppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { runQuery } from "@/lib/supabase/safeQuery";
import { DailyWellnessForm } from "@/components/DailyWellnessForm";
import type { WellnessRow } from "@/lib/types";
import { StaffWellnessView } from "./components/StaffWellnessView";
import { PlayerWellnessTrend } from "../players/[userId]/PlayerWellnessTrend";

export default async function WellnessPage() {
  const user = await getAppUser();
  if (!user) return null;

  const supabase = await createClient();
  const isPlayer = user.role === "player";

  let query = supabase
    .from("wellness")
    .select("*")
    .order("date", { ascending: false })
    .limit(isPlayer ? 28 : 100);

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
  let displayNameByUserId: Record<string, string> = {};
  let totalPlayers: number | null = null;
  if (!isPlayer) {
    if (list.length > 0) {
      const userIds = [...new Set(list.map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);
      if (profiles) {
        for (const p of profiles) {
          const email = p.email ?? "—";
          emailByUserId[p.id] = email;
          const name = (p as { full_name?: string | null }).full_name;
          displayNameByUserId[p.id] =
            (name && typeof name === "string" && name.trim()) ? name.trim() : email;
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

    const dates: string[] = [];
    const end = new Date();
    for (let i = 0; i < 28; i++) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
    const from = dates[dates.length - 1];
    const to = dates[0];
    const { data: sessionRows } = await supabase
      .from("sessions")
      .select("date, load")
      .eq("user_id", user.id)
      .gte("date", from)
      .lte("date", to);
    const loadByDate: Record<string, number> = {};
    (sessionRows ?? []).forEach((s: { date: string; load: number | null }) => {
      loadByDate[s.date] = (loadByDate[s.date] ?? 0) + (s.load ?? 0);
    });

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

          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white">Your 7-day & 28-day averages</h2>
            {list.length === 0 ? (
              <p className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-6 text-zinc-400" style={{ borderRadius: 12 }}>
                No wellness entries yet. Submit your first entry above to see your trends here.
              </p>
            ) : (
              <PlayerWellnessTrend wellness={list} dates={dates} loadByDate={loadByDate} />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <StaffWellnessView
      list={list}
      emailByUserId={emailByUserId}
      displayNameByUserId={displayNameByUserId}
      totalPlayers={totalPlayers}
    />
  );
}
