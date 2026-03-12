import Link from "next/link";
import { Users, MousePointerClick } from "lucide-react";
import { getAppUser } from "@/lib/auth";
import { formatDate } from "@/lib/formatDate";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/Card";
import { HintStrip } from "@/components/HintStrip";

export default async function PlayersListPage() {
  const user = await getAppUser();
  if (!user) redirect("/login");
  if (user.role !== "admin" && user.role !== "staff") redirect("/dashboard");

  const supabase = await createClient();
  const { data: players, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, created_at")
    .eq("role", "player")
    .order("email", { ascending: true });

  const playerIds = (players ?? []).map((p) => p.id);
  const statusByUserId = new Map<string, string>();
  if (playerIds.length > 0) {
    const { data: statusRows } = await supabase
      .from("player_status")
      .select("user_id, status")
      .in("user_id", playerIds);
    if (statusRows) {
      for (const r of statusRows) {
        statusByUserId.set(r.user_id, (r.status as string) ?? "available");
      }
    }
  }

  const displayName = (p: { full_name?: string | null; email?: string | null }) => {
    const name = (p.full_name ?? "").trim();
    return name ? name : (p.email ?? "—");
  };

  const STATUS_ORDER = ["available", "limited", "unavailable", "injured", "rehab"] as const;
  const STATUS_LABELS: Record<string, string> = {
    available: "Available",
    limited: "Limited",
    unavailable: "Unavailable",
    injured: "Injured",
    rehab: "Rehab",
  };
  const STATUS_BADGE_CLASS: Record<string, string> = {
    available: "bg-emerald-500/20 text-emerald-400",
    limited: "bg-amber-500/20 text-amber-400",
    unavailable: "bg-orange-500/20 text-orange-400",
    injured: "bg-red-500/20 text-red-400",
    rehab: "bg-sky-500/20 text-sky-400",
  };
  const STATUS_BORDER_COLOR: Record<string, string> = {
    available: "rgba(16, 185, 129, 0.5)",
    limited: "rgba(245, 158, 11, 0.5)",
    unavailable: "rgba(249, 115, 22, 0.5)",
    injured: "rgba(239, 68, 68, 0.5)",
    rehab: "rgba(14, 165, 233, 0.5)",
  };
  const getStatusBadge = (status: string) => {
    const s = (status ?? "available").toLowerCase();
    const label = STATUS_LABELS[s] ?? s;
    const cls = STATUS_BADGE_CLASS[s] ?? "bg-zinc-600/40 text-zinc-400";
    return { label, className: cls };
  };
  const getStatusBorderColor = (status: string) =>
    STATUS_BORDER_COLOR[(status ?? "available").toLowerCase()] ?? "rgba(82, 82, 91, 0.5)";
  const sortedPlayers = [...(players ?? [])].sort((a, b) => {
    const sa = statusByUserId.get(a.id) ?? "available";
    const sb = statusByUserId.get(b.id) ?? "available";
    const ia = STATUS_ORDER.indexOf(sa as (typeof STATUS_ORDER)[number]);
    const ib = STATUS_ORDER.indexOf(sb as (typeof STATUS_ORDER)[number]);
    const orderA = ia === -1 ? 999 : ia;
    const orderB = ib === -1 ? 999 : ib;
    return orderA - orderB;
  });

  return (
    <div className="min-w-0 -mx-4 overflow-x-hidden space-y-6 px-3 sm:mx-0 sm:px-0">
      <HintStrip icon={<MousePointerClick className="h-6 w-6" aria-hidden />}>
        Click a player for 7/28 day averages (wellness &amp; load).
      </HintStrip>

      <Card>
        <div className="-mx-5 -mt-5 mb-0 flex items-center gap-2 border-b border-zinc-800/80 px-5 py-4">
          <Users className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
          <h2 className="text-lg font-semibold tracking-tight text-white">All players</h2>
        </div>
        {error ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <span className="text-red-400" aria-hidden>⚠</span>
            <p className="text-red-400">Failed to load players.</p>
          </div>
        ) : !players?.length ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Users className="h-10 w-10 text-zinc-500" aria-hidden />
            <p className="text-zinc-400">No players yet.</p>
            <p className="text-xs text-zinc-500">Add players to get started.</p>
          </div>
        ) : (
          <>
            {/* Mobile: card grid, name (status color) + status badge; sorted: Available first */}
            <div className="flex flex-col gap-3 md:hidden">
              {sortedPlayers.map((p) => {
                const status = statusByUserId.get(p.id) ?? "available";
                const badge = getStatusBadge(status);
                const borderColor = getStatusBorderColor(status);
                return (
                  <Link
                    key={p.id}
                    href={`/players/${p.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-700/80 border-l-4 bg-zinc-800/50 px-4 py-3 text-left font-medium text-white transition-colors hover:bg-zinc-800/80 active:bg-zinc-700/80"
                    style={{ borderLeftColor: borderColor }}
                  >
                    <span className="text-white">{displayName(p)}</span>
                    <span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${badge.className}`}>
                      {badge.label}
                    </span>
                  </Link>
                );
              })}
            </div>
            {/* Desktop: table with status (read-only; only admin can change status on dashboard) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-700 text-zinc-400">
                    <th className="pb-2 pr-4 font-medium">Player</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-300">
                  {sortedPlayers.map((p) => {
                    const status = statusByUserId.get(p.id) ?? "available";
                    const badge = getStatusBadge(status);
                    const borderColor = getStatusBorderColor(status);
                    return (
                      <tr key={p.id} className="border-b border-zinc-800">
                        <td
                          className="py-3 pr-4 border-l-4"
                          style={{ borderLeftColor: borderColor }}
                        >
                          <Link
                            href={`/players/${p.id}`}
                            className="text-white hover:underline"
                          >
                            {displayName(p)}
                          </Link>
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`inline-block rounded-lg px-2 py-0.5 text-xs font-semibold ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3">
                          {formatDate(p.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
