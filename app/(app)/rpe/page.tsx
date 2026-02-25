import { getAppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { runQuery } from "@/lib/supabase/safeQuery";
import { Card } from "@/components/Card";
import { RpeForm } from "@/components/RpeForm";
import type { SessionRow } from "@/lib/types";
import { getDateContextLabel } from "@/lib/dateContext";
import { StaffLoadView } from "./components/StaffLoadView";

export default async function RpePage() {
  const user = await getAppUser();
  if (!user) return null;

  const supabase = await createClient();
  const isPlayer = user.role === "player";

  let query = supabase
    .from("sessions")
    .select("*")
    .order("date", { ascending: false })
    .limit(isPlayer ? 14 : 100);

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
  if (!isPlayer && list.length > 0) {
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

  if (isPlayer) {
    const today = new Date().toISOString().slice(0, 10);
    const hasSubmittedToday = list.some((r) => r.date === today);
    return (
      <div className="min-h-screen px-4 py-8 sm:px-6 lg:px-8" style={{ backgroundColor: "#0b0f14" }}>
        <div className="mx-auto max-w-2xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              RPE
            </h1>
            <p className="mt-1 text-zinc-400">
              Log session duration and RPE; load is calculated automatically.
            </p>
          </div>

          <RpeForm hasSubmittedToday={hasSubmittedToday} />

          <Card title="Recent sessions">
            {list.length === 0 ? (
              <p className="py-6 text-center text-zinc-400">No sessions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-700 text-zinc-400">
                      <th className="pb-2 pr-4 font-medium">Date</th>
                      <th className="pb-2 pr-4 font-medium">Duration (min)</th>
                      <th className="pb-2 pr-4 font-medium">RPE</th>
                      <th className="pb-2 font-medium">Load</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-300">
                    {list.map((r) => (
                      <tr key={r.id} className="border-b border-zinc-800">
                        <td className="py-3 pr-4">{r.date}<span className="text-zinc-500">{getDateContextLabel(r.date)}</span></td>
                        <td className="py-3 pr-4">{r.duration}</td>
                        <td className="py-3 pr-4">{r.rpe ?? "—"}</td>
                        <td className="py-3">{r.load ?? "—"}</td>
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
    <StaffLoadView list={list} emailByUserId={emailByUserId} />
  );
}
