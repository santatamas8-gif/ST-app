import { getAppUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getPlayerDetail } from "@/lib/playerDetail";
import { PlayerWellnessTrend } from "./PlayerWellnessTrend";

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const user = await getAppUser();
  if (!user) return null;

  const { error, playerEmail, displayName, wellness, sessions, from, to } = await getPlayerDetail(
    userId,
    user.id,
    user.role
  );
  if (error || !playerEmail) notFound();

  const loadByDate: Record<string, number> = {};
  sessions.forEach((s) => {
    loadByDate[s.date] = (loadByDate[s.date] ?? 0) + (s.load ?? 0);
  });

  const dates: string[] = [];
  const d = new Date(from!);
  const end = new Date(to!);
  while (d <= end) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  dates.reverse();

  return (
    <div className="min-w-0 w-[calc(100%+2rem)] -ml-4 overflow-x-hidden space-y-6 px-4 py-8 sm:w-full sm:ml-0 sm:mr-0 sm:px-4" style={{ backgroundColor: "var(--page-bg)", color: "var(--foreground)" }}>
      <div className="flex gap-4 text-sm">
        <Link href="/players" className="opacity-80 hover:opacity-100 transition-opacity">← Players</Link>
        <Link href="/wellness" className="opacity-80 hover:opacity-100 transition-opacity">Wellness</Link>
      </div>
      <h1 className="text-lg font-bold tracking-tight sm:text-xl lg:text-2xl" style={{ color: "var(--foreground)" }}>{displayName}</h1>
      <p className="text-xs opacity-70">Pick 7/28 days to see averages. Bars = daily values.</p>

      <PlayerWellnessTrend wellness={wellness} dates={dates} loadByDate={loadByDate} />
    </div>
  );
}
