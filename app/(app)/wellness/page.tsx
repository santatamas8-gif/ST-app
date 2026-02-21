import Link from "next/link";
import { getAppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { DailyWellnessForm } from "@/components/DailyWellnessForm";
import type { WellnessRow } from "@/lib/types";

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

  const { data: rows } = await query;
  const list = (rows ?? []) as WellnessRow[];

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
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Wellness
          </h1>
          <p className="mt-1 text-zinc-400">
            Submit once per day. Bed/wake time, sleep quality, fatigue, soreness, stress, mood (1–10).
          </p>
        </div>

        <DailyWellnessForm />

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
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Wellness
        </h1>
        <p className="mt-1 text-zinc-400">
          Summary: all fields players submit (bed/wake time, sleep h, sleep quality, fatigue, soreness, stress, mood). Same on mobile app.
        </p>
      </div>

      <Card title="Players wellness entries">
        {list.length === 0 ? (
          <p className="text-zinc-400">No wellness entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-700 text-zinc-400">
                  <th className="pb-2 pr-4 font-medium">Player</th>
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
                    <td className="py-3 pr-4">
                      <Link href={`/players/${r.user_id}`} className="text-emerald-400 hover:underline">
                        {emailByUserId[r.user_id] ?? r.user_id}
                      </Link>
                    </td>
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
  );
}
