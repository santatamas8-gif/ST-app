import { getAppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { runQuery } from "@/lib/supabase/safeQuery";
import type { WellnessRow } from "@/lib/types";
import { StaffWellnessView } from "./components/StaffWellnessView";
import { WellnessPlayerContent } from "./components/WellnessPlayerContent";

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
      <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ backgroundColor: "var(--page-bg)" }}>
        <div className="mx-auto max-w-2xl space-y-6">
          <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl lg:text-2xl">Wellness</h1>
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
  let allPlayerIds: string[] = [];
  if (!isPlayer) {
    const { data: playerProfiles } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("role", "player");
    if (playerProfiles) {
      totalPlayers = playerProfiles.length;
      allPlayerIds = playerProfiles.map((p: { id: string }) => p.id);
      for (const p of playerProfiles) {
        const email = p.email ?? "—";
        emailByUserId[p.id] = email;
        const name = (p as { full_name?: string | null }).full_name;
        displayNameByUserId[p.id] =
          (name && typeof name === "string" && name.trim()) ? name.trim() : email;
      }
    }
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
      <WellnessPlayerContent
        hasSubmittedToday={hasSubmittedToday}
        list={list}
        dates={dates}
        loadByDate={loadByDate}
      />
    );
  }

  return (
    <StaffWellnessView
      list={list}
      emailByUserId={emailByUserId}
      displayNameByUserId={displayNameByUserId}
      totalPlayers={totalPlayers}
      allPlayerIds={allPlayerIds}
    />
  );
}
