import { getAppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { RpeForm } from "@/components/RpeForm";
import type { SessionRow } from "@/lib/types";

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

  const { data: rows } = await query;
  const list = (rows ?? []) as SessionRow[];

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
            RPE
          </h1>
          <p className="mt-1 text-zinc-400">
            Log session duration and RPE; load is calculated automatically.
          </p>
        </div>

        <RpeForm />

        <Card title="Recent sessions">
          {list.length === 0 ? (
            <p className="text-zinc-400">No sessions yet.</p>
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
                      <td className="py-3 pr-4">{r.date}</td>
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
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          RPE
        </h1>
        <p className="mt-1 text-zinc-400">
          Összesítés: minden, amit a játékosok rögzítenek (dátum, időtartam, RPE, load).
        </p>
      </div>

      <Card title="Játékosok RPE / edzés bejegyzései">
        {list.length === 0 ? (
          <p className="text-zinc-400">Még nincs rögzített edzés.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-700 text-zinc-400">
                  <th className="pb-2 pr-4 font-medium">Játékos</th>
                  <th className="pb-2 pr-4 font-medium">Dátum</th>
                  <th className="pb-2 pr-4 font-medium">Duration (min)</th>
                  <th className="pb-2 pr-4 font-medium">RPE</th>
                  <th className="pb-2 font-medium">Load</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {list.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-800">
                    <td className="py-3 pr-4">{emailByUserId[r.user_id] ?? r.user_id}</td>
                    <td className="py-3 pr-4">{r.date}</td>
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
  );
}
