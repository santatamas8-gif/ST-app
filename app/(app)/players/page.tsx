import Link from "next/link";
import { getAppUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";

export default async function PlayersListPage() {
  const user = await getAppUser();
  if (!user) redirect("/login");
  if (user.role !== "admin" && user.role !== "staff") redirect("/dashboard");

  const supabase = await createClient();
  const { data: players, error } = await supabase
    .from("profiles")
    .select("id, email, created_at")
    .eq("role", "player")
    .order("email", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Players</h1>
        <p className="mt-1 text-zinc-400">
          All players in the app. Click a name to set availability (Available / Injured / Unavailable) per day.
        </p>
      </div>

      <Card title="All players">
        {error ? (
          <p className="text-red-400">Failed to load players.</p>
        ) : !players?.length ? (
          <p className="text-zinc-400">No players yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-700 text-zinc-400">
                  <th className="pb-2 pr-4 font-medium">Player</th>
                  <th className="pb-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {players.map((p) => (
                  <tr key={p.id} className="border-b border-zinc-800">
                    <td className="py-3 pr-4">
                      <Link
                        href={`/players/${p.id}`}
                        className="text-emerald-400 hover:underline"
                      >
                        {p.email ?? "—"}
                      </Link>
                    </td>
                    <td className="py-3">
                      {p.created_at
                        ? new Date(p.created_at).toLocaleDateString()
                        : "—"}
                    </td>
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
