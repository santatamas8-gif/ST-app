import { getAppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { runQuery } from "@/lib/supabase/safeQuery";
import type { SessionRow } from "@/lib/types";
import { StaffLoadView } from "./components/StaffLoadView";
import { PlayerLoadView } from "./components/PlayerLoadView";

export default async function RpePage() {
  const user = await getAppUser();
  if (!user) return null;

  const supabase = await createClient();
  const isPlayer = user.role === "player";

  let query = supabase
    .from("sessions")
    .select("*")
    .order("date", { ascending: false })
    .limit(isPlayer ? 35 : 100);

  if (isPlayer) {
    query = query.eq("user_id", user.id);
  }

  const { data: rows, error: loadError } = await runQuery("rpe-list", () =>
    query.then((r) => ({ data: r.data ?? [], error: r.error }))
  );
  const list = (rows ?? []) as SessionRow[];

  if (loadError) {
    return (
      <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ backgroundColor: "#0b0f14" }}>
        <div className="mx-auto max-w-2xl space-y-6">
          <h1 className="text-2xl font-bold tracking-tight text-white">RPE</h1>
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
  if (!isPlayer && list.length > 0) {
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
          name && typeof name === "string" && name.trim() ? name.trim() : email;
      }
    }
  }

  if (isPlayer) {
    const today = new Date().toISOString().slice(0, 10);
    const hasSubmittedToday = list.some((r) => r.date === today);
    return (
      <PlayerLoadView list={list} hasSubmittedToday={hasSubmittedToday} />
    );
  }

  return (
    <StaffLoadView
      list={list}
      emailByUserId={emailByUserId}
      displayNameByUserId={displayNameByUserId}
    />
  );
}
